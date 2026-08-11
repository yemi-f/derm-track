import { ANALYSIS_DST_ACTIONS, concernIdFromAnalysisKey } from "@/lib/concernKeyMap";
import { getSignedUrl, rehostImage } from "@/lib/storage";
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

  const signedUrl = await getSignedUrl(imagePath, { expiresInSeconds: 300 });

  const createRes = await fetch(
    `${process.env.YOUCAM_API_BASE}/s2s/v2.0/task/skin-analysis`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.YOUCAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        src_file_url: signedUrl,
        dst_actions: ANALYSIS_DST_ACTIONS,
        format: "json",
      }),
    }
  );
  const createJson = await createRes.json();

  if (!createRes.ok) {
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
    if (err instanceof YoucamTaskError) {
      return Response.json({ error: friendlyYoucamError(err.code) }, { status: 502 });
    }
    throw err;
  }

  const output = taskData.results?.output || [];

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

  return Response.json({ results });
}
