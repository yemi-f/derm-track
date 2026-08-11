import { createClient } from "@supabase/supabase-js";

const BUCKET = "visit-images";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// Fetch a YouCam result image and re-host it in our PRIVATE bucket. Returns the storage
// PATH, not a URL — YouCam's download links expire 2 hours after task success.
export async function rehostImage(youcamUrl, path) {
  const res = await fetch(youcamUrl);
  if (!res.ok) {
    throw new Error(`Failed to download YouCam result image (${res.status})`);
  }
  const blob = await res.blob();
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || "image/png",
    upsert: true,
  });
  if (error) throw error;
  return path;
}

// Resolve a storage PATH to a short-lived signed URL, generated fresh at the point of use.
// Never persist the result — regenerate it every time it's needed.
export async function getSignedUrl(path, { expiresInSeconds = 3600 } = {}) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
