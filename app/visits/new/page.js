"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { validateMinDimensions } from "@/lib/imageValidation";
import CameraKitCapture from "@/components/CameraKitCapture";
import CropStep from "@/components/CropStep";
import ConcernScoreCard from "@/components/ConcernScoreCard";
import TreatmentSelector from "@/components/TreatmentSelector";
import SimulationComparison from "@/components/SimulationComparison";
import concernConfig from "@/lib/concern-treatment-config.json";

const TREATMENTS_BY_CONCERN = Object.fromEntries(
  concernConfig.concerns.map((c) => [c.id, c.treatments])
);

const ANALYZING_MESSAGES = [
  "Calling Skin Analysis…",
  "Checking for redness…",
  "Measuring texture and pores…",
  "Almost done…",
];

const CONCERN_LABELS = Object.fromEntries(
  concernConfig.concerns.map((c) => [c.id, c.label])
);

export default function NewVisitPage() {
  const [step, setStep] = useState("capture"); // capture | crop | uploading | analyzing | results | error
  const [captureError, setCaptureError] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [results, setResults] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [imagePath, setImagePath] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [statusIndex, setStatusIndex] = useState(0);

  const [selectedConcern, setSelectedConcern] = useState(null);
  const [treatmentSelections, setTreatmentSelections] = useState({}); // concernId -> treatmentId
  const [simulationsByConcern, setSimulationsByConcern] = useState({}); // concernId -> { "0.3": url, "0.7": url }
  const [simLoading, setSimLoading] = useState(null); // { concern, intensity } | null
  const [panelError, setPanelError] = useState(null);

  const tempVisitIdRef = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now())
  );

  useEffect(() => {
    if (step !== "analyzing") return;
    const interval = setInterval(() => {
      setStatusIndex((i) => Math.min(i + 1, ANALYZING_MESSAGES.length - 1));
    }, 1800);
    return () => clearInterval(interval);
  }, [step]);

  function handleCaptured(blob, dimensions) {
    const check = validateMinDimensions(dimensions, "SD");
    if (!check.valid) {
      setCaptureError(check.message);
      return;
    }
    setCaptureError(null);
    setCapturedBlob(blob);
    setStep("crop");
  }

  function handleRetake() {
    setCapturedBlob(null);
    setStep("capture");
  }

  async function handleCropConfirm(finalBlob) {
    setStep("uploading");
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("You've been signed out. Please sign back in.");

      const imagePath = `visits/${user.id}/${tempVisitIdRef.current}/original.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("visit-images")
        .upload(imagePath, finalBlob, { contentType: "image/jpeg", upsert: true });

      if (uploadError) throw uploadError;

      setStep("analyzing");
      setStatusIndex(0);

      const res = await fetch("/api/youcam/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePath, tempVisitId: tempVisitIdRef.current }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Analysis failed. Please try again.");

      const sorted = [...data.results].sort((a, b) => a.uiScore - b.uiScore);
      setResults(sorted);
      setOriginalImageUrl(data.originalImageUrl);
      setImagePath(imagePath);
      setStep("results");
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong. Please try again.");
      setStep("error");
    }
  }

  function handleSelectConcern(concernId) {
    setPanelError(null);
    setSelectedConcern((current) => (current === concernId ? null : concernId));
  }

  async function handleSelectTreatment(concernId, treatmentId) {
    setPanelError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("treatment_selections").insert({
        visit_id: tempVisitIdRef.current,
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
            visitId: tempVisitIdRef.current,
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
    <main style={{ maxWidth: 640, margin: "40px auto", padding: "0 24px" }}>
      <h1 style={{ marginBottom: 4 }}>New Visit</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        Take a clear, front-facing selfie for your skin analysis.
      </p>

      {step === "capture" && (
        <div>
          {captureError && <p style={{ color: "#a13a34" }}>{captureError}</p>}
          <CameraKitCapture onCaptured={handleCaptured} />
        </div>
      )}

      {step === "crop" && capturedBlob && (
        <CropStep imageBlob={capturedBlob} onConfirm={handleCropConfirm} onRetake={handleRetake} />
      )}

      {step === "uploading" && <LoadingState text="Uploading your photo…" />}

      {step === "analyzing" && <LoadingState text={ANALYZING_MESSAGES[statusIndex]} />}

      {step === "error" && (
        <div>
          <p style={{ color: "#a13a34" }}>{errorMessage}</p>
          <button style={primaryButton} onClick={handleRetake}>
            Try Again
          </button>
        </div>
      )}

      {step === "results" && results && (
        <div>
          <h2 style={{ fontSize: 18 }}>Your Results</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 16,
            }}
          >
            {results.map((r) => (
              <ConcernScoreCard
                key={r.concern}
                label={CONCERN_LABELS[r.concern] || r.concern}
                uiScore={r.uiScore}
                originalImageUrl={originalImageUrl}
                maskImageUrl={r.maskImageUrl}
                selected={selectedConcern === r.concern}
                onClick={() => handleSelectConcern(r.concern)}
              />
            ))}
          </div>

          {selectedConcern && (
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
          )}
        </div>
      )}
    </main>
  );
}

function LoadingState({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "var(--color-text-muted)" }}>
      <p>{text}</p>
    </div>
  );
}

const panel = {
  marginTop: 20,
  padding: 20,
  background: "var(--color-surface)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-soft)",
};

const primaryButton = {
  padding: "12px 20px",
  borderRadius: 10,
  border: "none",
  background: "var(--color-primary)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
