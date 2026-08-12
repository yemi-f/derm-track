import { ANALYSIS_DST_ACTIONS, concernIdFromAnalysisKey } from "@/lib/concernKeyMap";
import { getSignedUrl, rehostImage, downloadImage } from "@/lib/storage";
import { uploadToYoucam } from "@/lib/youcamFile";
import { pollTask, YoucamTaskError } from "@/lib/pollTask";
import { friendlyYoucamError } from "@/lib/youcamErrors";
import { createClient } from "@/lib/supabase/server";

export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { imagePath, tempVisitId } = await req.json();
  if (!imagePath || !tempVisitId) {
    return Response.json(
      { error: "imagePath and tempVisitId are required" },
      { status: 400 }
    );
  }

  // Push bytes to YouCam ourselves (File API) rather than handing them a URL to fetch —
  // see supabase/storage-policies.sql history / plan notes: src_file_url consistently
  // failed with error_download_image, most likely a network-reachability issue between
  // YouCam's infrastructure and Supabase's Cloudflare-fronted storage that we don't
  // control. This flow only requires outbound requests from our own server, which we've
  // verified work reliably.
  const imageBlob = await downloadImage(imagePath);
  const fileId = await uploadToYoucam(imageBlob, {
    contentType: imageBlob.type || "image/jpeg",
    fileName: "original.jpg",
  });

  const createRes = await fetch(
    `${process.env.YOUCAM_API_BASE}/s2s/v2.0/task/skin-analysis`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.YOUCAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        src_file_id: fileId,
        dst_actions: ANALYSIS_DST_ACTIONS,
        format: "json",
      }),
    }
  );
  const createJson = await createRes.json();

  if (!createRes.ok) {
    console.error(
      "[analyze] create-task failed:",
      createRes.status,
      JSON.stringify(createJson)
    );
    return Response.json(
      { error: friendlyYoucamError(createJson.error_code) },
      { status: 400 }
    );
  }

  const taskId = createJson.data.task_id;

  let taskData;
  try {
    taskData = await pollTask(
      `${process.env.YOUCAM_API_BASE}/s2s/v2.0/task/skin-analysis/${taskId}`
    );
  } catch (err) {
    if (!(err instanceof YoucamTaskError)) throw err;
    console.error("[analyze] task failed:", err.code, err.message);
    return Response.json({ error: friendlyYoucamError(err.code) }, { status: 502 });
  }

  const output = taskData.results?.output || [];

  try {
    const mapped = await Promise.all(
      output.map(async (entry) => {
        // YouCam's output[] includes entries beyond the 10 requested concerns — "all"
        // (overall score), "skin_age", "resize_image" (a preprocessing artifact, not a
        // concern) — none of which exist in CONCERN_KEY_MAP. Skip anything unrecognized
        // rather than falling back to the raw type string as a fake concern id.
        const concernId = concernIdFromAnalysisKey(entry.type);
        if (!concernId) {
          console.warn(`[analyze] skipping unrecognized output type "${entry.type}"`);
          return null;
        }

        // Not every requested concern is guaranteed a usable score for a given photo
        // (e.g. an angle/occlusion issue specific to that concern) — skip rather than
        // insert a row that violates concern_scores.ui_score's not-null constraint.
        if (entry.ui_score == null) {
          console.warn(
            `[analyze] skipping ${concernId}: no ui_score in response`,
            JSON.stringify(entry)
          );
          return null;
        }

        let maskImagePath = null;
        let maskImageUrl = null;

        if (entry.mask_urls?.[0]) {
          maskImagePath = `visits/${user.id}/${tempVisitId}/masks/${concernId}.png`;
          await rehostImage(entry.mask_urls[0], maskImagePath);
          maskImageUrl = await getSignedUrl(maskImagePath, { expiresInSeconds: 3600 });
        }

        return {
          concern: concernId,
          uiScore: entry.ui_score,
          rawScore: entry.raw_score,
          maskImagePath,
          maskImageUrl,
        };
      })
    );

    const results = mapped.filter(Boolean);

    const originalImageUrl = await getSignedUrl(imagePath, { expiresInSeconds: 3600 });

    // Persist now rather than deferring to a later "save visit" step — treatment
    // selection (next milestone) needs a real visits.id to attach to immediately, per
    // IMPLEMENTATION.md §8.1 Step E's "(if not already created in Step B)". Upsert on
    // visits so retrying analysis after a transient failure doesn't hit a duplicate key;
    // delete+insert on concern_scores so a retry doesn't leave stale duplicate rows.
    const { error: visitError } = await supabase
      .from("visits")
      .upsert({ id: tempVisitId, user_id: user.id, original_image_path: imagePath });
    if (visitError) throw visitError;

    const { error: deleteError } = await supabase
      .from("concern_scores")
      .delete()
      .eq("visit_id", tempVisitId);
    if (deleteError) throw deleteError;

    const { error: scoresError } = await supabase.from("concern_scores").insert(
      results.map((r) => ({
        visit_id: tempVisitId,
        concern_key: r.concern,
        ui_score: r.uiScore,
        raw_score: r.rawScore,
        mask_image_path: r.maskImagePath,
      }))
    );
    if (scoresError) throw scoresError;

    return Response.json({ results, originalImageUrl, visitId: tempVisitId });
  } catch (err) {
    console.error("[analyze] saving results failed:", err);
    return Response.json(
      { error: "We analyzed your photo but couldn't save the results. Please try again." },
      { status: 500 }
    );
  }
}
