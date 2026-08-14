"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ConcernScoreCard from "./ConcernScoreCard";
import TreatmentSelector from "./TreatmentSelector";
import SimulationComparison from "./SimulationComparison";
import concernConfig from "@/lib/concern-treatment-config.json";
import { primaryButtonColors } from "@/lib/buttonStyles";

const CONCERN_LABELS = Object.fromEntries(
  concernConfig.concerns.map((c) => [c.id, c.label])
);
const TREATMENTS_BY_CONCERN = Object.fromEntries(
  concernConfig.concerns.map((c) => [c.id, c.treatments])
);

// The interactive concern/treatment/simulation UI — used both for a visit just
// redirected to right after analysis (nothing selected yet) and a revisited older one
// (initial* props seeded from already-saved treatment_selections/simulations rows).
export default function VisitConcernExplorer({
  visitId,
  imagePath,
  originalImageUrl,
  heroImage,
  scores,
  initialTreatmentSelections = {},
  initialSimulations = {},
}) {
  const [selectedConcern, setSelectedConcern] = useState(null);
  const [treatmentSelections, setTreatmentSelections] = useState(initialTreatmentSelections);
  const [simulationsByConcern, setSimulationsByConcern] = useState(initialSimulations);
  const [simLoading, setSimLoading] = useState(null); // { concern, intensity } | null
  const [panelError, setPanelError] = useState(null);

  function handleSelectConcern(concernId) {
    setPanelError(null);
    setSelectedConcern((current) => (current === concernId ? null : concernId));
  }

  async function handleSelectTreatment(concernId, treatmentId) {
    setPanelError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("treatment_selections").insert({
        visit_id: visitId,
        concern_key: concernId,
        treatment_id: treatmentId,
      });
      if (error) throw error;
      setTreatmentSelections((prev) => ({ ...prev, [concernId]: treatmentId }));
    } catch (err) {
      setPanelError(err.message || "Couldn't save that selection. Please try again.");
    }
  }

  async function handleSimulate(concernId) {
    const treatmentId = treatmentSelections[concernId];
    if (!treatmentId || !imagePath) return;

    setPanelError(null);
    for (const intensity of [0.3, 0.7]) {
      setSimLoading({ concern: concernId, intensity: String(intensity) });
      try {
        const res = await fetch("/api/youcam/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imagePath,
            visitId,
            concern: concernId,
            treatmentId,
            intensity,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Simulation failed. Please try again.");

        setSimulationsByConcern((prev) => ({
          ...prev,
          [concernId]: { ...(prev[concernId] || {}), [String(intensity)]: data.simulatedImageUrl },
        }));
      } catch (err) {
        setPanelError(err.message || "Simulation failed. Please try again.");
        setSimLoading(null);
        return;
      }
    }
    setSimLoading(null);
  }

  return (
    <div className="visit-explorer-layout">
      <div>
        {heroImage}
        <h2 style={{ fontSize: 18 }}>Concern Scores</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 16,
          }}
        >
          {scores.map((s) => (
            <ConcernScoreCard
              key={s.concern}
              label={CONCERN_LABELS[s.concern] || s.concern}
              uiScore={s.uiScore}
              originalImageUrl={originalImageUrl}
              maskImageUrl={s.maskImageUrl}
              selected={selectedConcern === s.concern}
              onClick={() => handleSelectConcern(s.concern)}
            />
          ))}
        </div>
      </div>

      <div className="visit-explorer-panel">
        {selectedConcern ? (
          <div style={panel}>
            <h3 style={{ fontSize: 16, marginTop: 0 }}>
              {CONCERN_LABELS[selectedConcern] || selectedConcern}
            </h3>

            {panelError && <p style={{ color: "#a13a34", fontSize: 13 }}>{panelError}</p>}

            <TreatmentSelector
              treatments={TREATMENTS_BY_CONCERN[selectedConcern] || []}
              selectedTreatmentId={treatmentSelections[selectedConcern]}
              onSelect={(treatmentId) => handleSelectTreatment(selectedConcern, treatmentId)}
            />

            {treatmentSelections[selectedConcern] && (
              <>
                <button
                  style={{ ...primaryButton, marginTop: 16 }}
                  onClick={() => handleSimulate(selectedConcern)}
                  disabled={simLoading?.concern === selectedConcern}
                >
                  {simLoading?.concern === selectedConcern
                    ? simLoading.intensity === "0.3"
                      ? "Calling Skin Simulation — subtle…"
                      : "Calling Skin Simulation — dramatic…"
                    : simulationsByConcern[selectedConcern]
                    ? "Re-run Projection"
                    : "See Projection"}
                </button>

                {(simulationsByConcern[selectedConcern] ||
                  simLoading?.concern === selectedConcern) && (
                  <div style={{ marginTop: 16 }}>
                    <SimulationComparison
                      originalImageUrl={originalImageUrl}
                      simulations={simulationsByConcern[selectedConcern] || {}}
                      loadingIntensity={
                        simLoading?.concern === selectedConcern ? simLoading.intensity : null
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div style={emptyPanel}>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>
              Select a concern to see provider recommendations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const panel = {
  padding: 20,
  background: "var(--color-surface)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-soft)",
};

const emptyPanel = {
  ...panel,
  minHeight: 160,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};

const primaryButton = {
  padding: "12px 20px",
  borderRadius: 10,
  border: "none",
  ...primaryButtonColors,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
