import { CONCERN_KEY_MAP } from "@/lib/concernKeyMap";
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

  const { imagePath, visitId, concern, treatmentId, intensity } = await req.json();
  if (!imagePath || !visitId || !concern || !treatmentId || intensity == null) {
    return Response.json(
      { error: "imagePath, visitId, concern, treatmentId and intensity are required" },
      { status: 400 }
    );
  }

  const simKey = CONCERN_KEY_MAP[concern]?.simulation;
  if (!simKey) {
    return Response.json({ error: `Unknown concern "${concern}"` }, { status: 400 });
  }

  // Same File API push approach as /api/youcam/analyze — pushing bytes ourselves avoids
  // the src_file_url download-reliability problem for this endpoint too.
  const imageBlob = await downloadImage(imagePath);
  const fileId = await uploadToYoucam(imageBlob, {
    contentType: imageBlob.type || "image/jpeg",
    fileName: "original.jpg",
  });

  const createRes = await fetch(
    `${process.env.YOUCAM_API_BASE}/s2s/v2.0/task/skin-simulation`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.YOUCAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        src_file_id: fileId,
        [simKey]: intensity,
      }),
    }
  );
  const createJson = await createRes.json();

  if (!createRes.ok) {
    console.error(
      "[simulate] create-task failed:",
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
      `${process.env.YOUCAM_API_BASE}/s2s/v2.0/task/skin-simulation/${taskId}`
    );
  } catch (err) {
    if (!(err instanceof YoucamTaskError)) throw err;
    console.error("[simulate] task failed:", err.code, err.message);
    return Response.json({ error: friendlyYoucamError(err.code) }, { status: 502 });
  }

  // Confirmed response shape: { data: { results: { url }, task_status: "success" } }.
  const resultUrl = taskData.results?.url;
  if (!resultUrl) {
    console.error("[simulate] no result url in task data:", JSON.stringify(taskData));
    return Response.json(
      { error: "Simulation completed but no result image was returned." },
      { status: 502 }
    );
  }

  try {
    const simulatedImagePath = `visits/${visitId}/simulations/${concern}_${intensity}.jpg`;
    await rehostImage(resultUrl, simulatedImagePath, "image/jpeg");
    const simulatedImageUrl = await getSignedUrl(simulatedImagePath, {
      expiresInSeconds: 3600,
    });

    const { error: insertError } = await supabase.from("simulations").insert({
      visit_id: visitId,
      concern_key: concern,
      treatment_id: treatmentId,
      intensity,
      simulated_image_path: simulatedImagePath,
    });
    if (insertError) throw insertError;

    return Response.json({ simulatedImageUrl, intensity });
  } catch (err) {
    console.error("[simulate] saving result failed:", err);
    return Response.json(
      { error: "Simulation completed but we couldn't save the result. Please try again." },
      { status: 500 }
    );
  }
}
