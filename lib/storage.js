import { createClient } from "@supabase/supabase-js";

const BUCKET = "visit-images";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// Fetch a YouCam result image and re-host it in our PRIVATE bucket. Returns the storage
// PATH, not a URL — YouCam's download links expire 2 hours after task success.
//
// contentType is explicit, not inferred from the fetched response: YouCam's mask
// download responses come back as generic binary/octet-stream, which the bucket's
// allowedMimeTypes restriction rejects outright.
export async function rehostImage(youcamUrl, path, contentType = "image/png") {
  const res = await fetch(youcamUrl);
  if (!res.ok) {
    throw new Error(`Failed to download YouCam result image (${res.status})`);
  }
  // Rebuild the Blob with the correct type rather than relying on the contentType
  // option alone — the fetched Blob carries YouCam's own (generic) response
  // Content-Type, and @supabase/storage-js appears to derive the upload's actual
  // Content-Type from the Blob object itself, not (only) from this option.
  const arrayBuffer = await res.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: contentType });
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType,
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

// Download an object's bytes server-side (secret key, bypasses RLS). Used to hand image
// bytes to YouCam's File API directly rather than asking a third party to fetch a URL
// from us — see lib/youcamFile.js.
export async function downloadImage(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return data; // Blob
}
