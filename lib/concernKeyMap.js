// Analysis and Simulation use different concern-key vocabularies — this is the single
// source of truth translating between them. See IMPLEMENTATION.md §9.3.
export const CONCERN_KEY_MAP = {
  wrinkle: { analysis: "wrinkle", simulation: "wrinkle" },
  acne: { analysis: "acne", simulation: "acne" },
  oiliness: { analysis: "oiliness", simulation: "oiliness" },
  eye_bag: { analysis: "eye_bag", simulation: "eye_bags" },
  dark_circle_v2: { analysis: "dark_circle_v2", simulation: "dark_circle" },
  age_spot: { analysis: "age_spot", simulation: "spots" },
  pore: { analysis: "pore", simulation: "pores" },
  texture: { analysis: "texture", simulation: "texture" },
  redness: { analysis: "redness", simulation: "redness" },
  radiance: { analysis: "radiance", simulation: "radiance" },
};

export const ANALYSIS_DST_ACTIONS = Object.values(CONCERN_KEY_MAP).map((c) => c.analysis);

export function concernIdFromAnalysisKey(analysisKey) {
  return Object.keys(CONCERN_KEY_MAP).find(
    (id) => CONCERN_KEY_MAP[id].analysis === analysisKey
  );
}
