import { describe, it, expect } from "vitest";
import { CONCERN_KEY_MAP, ANALYSIS_DST_ACTIONS, concernIdFromAnalysisKey } from "./concernKeyMap";

// The exact plural/singular quirks confirmed in IMPLEMENTATION.md §9.3 — the whole reason
// this map exists is to make sure these never get typo'd or assumed-identical.
const EXPECTED_SIMULATION_KEYS = {
  wrinkle: "wrinkle",
  acne: "acne",
  oiliness: "oiliness",
  eye_bag: "eye_bags",
  dark_circle_v2: "dark_circle",
  age_spot: "spots",
  pore: "pores",
  texture: "texture",
  redness: "redness",
  radiance: "radiance",
};

describe("CONCERN_KEY_MAP", () => {
  it("has exactly the 10 SD-tier concerns", () => {
    expect(Object.keys(CONCERN_KEY_MAP).sort()).toEqual(Object.keys(EXPECTED_SIMULATION_KEYS).sort());
  });

  it("every entry has non-empty analysis and simulation keys", () => {
    for (const [id, entry] of Object.entries(CONCERN_KEY_MAP)) {
      expect(entry.analysis, `${id}.analysis`).toBeTruthy();
      expect(entry.simulation, `${id}.simulation`).toBeTruthy();
    }
  });

  it("matches the confirmed analysis -> simulation key mapping exactly", () => {
    for (const [id, expectedSimKey] of Object.entries(EXPECTED_SIMULATION_KEYS)) {
      expect(CONCERN_KEY_MAP[id].simulation, id).toBe(expectedSimKey);
      // Canonical id doubles as the analysis key for every concern.
      expect(CONCERN_KEY_MAP[id].analysis, id).toBe(id);
    }
  });

  it("flags the known plural/singular mismatches specifically", () => {
    expect(CONCERN_KEY_MAP.eye_bag.simulation).toBe("eye_bags");
    expect(CONCERN_KEY_MAP.dark_circle_v2.simulation).toBe("dark_circle");
    expect(CONCERN_KEY_MAP.age_spot.simulation).toBe("spots");
    expect(CONCERN_KEY_MAP.pore.simulation).toBe("pores");
  });
});

describe("ANALYSIS_DST_ACTIONS", () => {
  it("matches the .analysis value of every CONCERN_KEY_MAP entry, in order", () => {
    expect(ANALYSIS_DST_ACTIONS).toEqual(Object.values(CONCERN_KEY_MAP).map((c) => c.analysis));
  });

  it("has no duplicates", () => {
    expect(new Set(ANALYSIS_DST_ACTIONS).size).toBe(ANALYSIS_DST_ACTIONS.length);
  });
});

describe("concernIdFromAnalysisKey", () => {
  it("round-trips every concern id through its analysis key", () => {
    for (const id of Object.keys(CONCERN_KEY_MAP)) {
      expect(concernIdFromAnalysisKey(CONCERN_KEY_MAP[id].analysis)).toBe(id);
    }
  });

  it("returns undefined for an unknown analysis key", () => {
    expect(concernIdFromAnalysisKey("not_a_real_concern")).toBeUndefined();
  });
});
