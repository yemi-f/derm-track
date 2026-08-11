// Maps YouCam error codes to plain-language UI copy — never show a raw code or stack
// trace to the user. See IMPLEMENTATION.md §9.2.
const MESSAGES = {
  error_below_min_image_size: "This photo is too low-resolution. Try a clearer, closer shot.",
  error_exceed_max_image_size: "This photo is too large. Try a different shot.",
  error_src_face_too_small:
    "Your face needs to fill more of the frame — try moving closer.",
  error_src_face_out_of_bound:
    "We couldn't find your whole face in the frame — try centering yourself and moving back slightly.",
  error_lighting_dark: "The lighting is too dark — try a brighter spot.",
  InvalidParameters:
    "Something went wrong preparing your analysis request. Please try again.",
};

const DEFAULT_MESSAGE = "Something went wrong analyzing your photo. Please try again.";

export function friendlyYoucamError(code) {
  if (!code) return DEFAULT_MESSAGE;
  return MESSAGES[code] || DEFAULT_MESSAGE;
}
