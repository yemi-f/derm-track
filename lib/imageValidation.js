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
