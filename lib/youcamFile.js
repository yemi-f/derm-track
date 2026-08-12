// Uploads image bytes directly to YouCam's File API, returning a file_id usable as
// src_file_id in a task request. This is the primary, documented upload flow — unlike
// src_file_url, it never requires YouCam's servers to fetch anything from us, so it isn't
// exposed to network reachability issues between their infrastructure and ours.
export async function uploadToYoucam(blob, { contentType, fileName }) {
  const createRes = await fetch(`${process.env.YOUCAM_API_BASE}/s2s/v2.0/file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.YOUCAM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: [
        {
          content_type: contentType,
          file_name: fileName,
          file_size: blob.size,
        },
      ],
    }),
  });
  const createJson = await createRes.json();

  if (!createRes.ok) {
    throw new Error(
      `YouCam File API create failed (${createRes.status}): ${JSON.stringify(createJson)}`
    );
  }

  const file = createJson.data.files[0];
  const uploadRequest = file.requests[0];

  const putRes = await fetch(uploadRequest.url, {
    method: uploadRequest.method,
    headers: uploadRequest.headers,
    body: blob,
  });

  if (!putRes.ok) {
    throw new Error(`YouCam File API upload PUT failed (${putRes.status})`);
  }

  return file.file_id;
}
