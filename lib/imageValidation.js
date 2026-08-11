export async function getImageDimensions(file) {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

export function validateMinDimensions({ width, height }, tier = "SD") {
  const minShortSide = tier === "HD" ? 1080 : 480;
  const shortSide = Math.min(width, height);
  if (shortSide < minShortSide) {
    return {
      valid: false,
      message: `This photo is too low-resolution. Try a clearer, closer shot. (Short side must be at least ${minShortSide}px.)`,
    };
  }
  return { valid: true };
}

// After crop, before upload: resize via canvas if long side exceeds the cap —
// the API auto-resizes past 2560px anyway, so there's no benefit sending more.
export function resizeIfNeeded(canvas, maxLongSide = 2560) {
  const longSide = Math.max(canvas.width, canvas.height);
  if (longSide <= maxLongSide) return canvas;
  const scale = maxLongSide / longSide;
  const resized = document.createElement("canvas");
  resized.width = canvas.width * scale;
  resized.height = canvas.height * scale;
  resized.getContext("2d").drawImage(canvas, 0, 0, resized.width, resized.height);
  return resized;
}

export function canvasToBlob(canvas, type = "image/jpeg", quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to export image"))),
      type,
      quality
    );
  });
}
