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
    const results = await Promise.all(
      output.map(async (entry) => {
        const concernId = concernIdFromAnalysisKey(entry.type) || entry.type;
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

    const originalImageUrl = await getSignedUrl(imagePath, { expiresInSeconds: 3600 });

    return Response.json({ results, originalImageUrl });
  } catch (err) {
    console.error("[analyze] re-hosting results failed:", err);
    return Response.json(
      { error: "We analyzed your photo but couldn't save the results. Please try again." },
      { status: 500 }
    );
  }
}
