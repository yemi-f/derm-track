"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { validateMinDimensions } from "@/lib/imageValidation";
import CameraKitCapture from "@/components/CameraKitCapture";
import CropStep from "@/components/CropStep";
import ConcernScoreCard from "@/components/ConcernScoreCard";
import concernConfig from "@/lib/concern-treatment-config.json";

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
  const [errorMessage, setErrorMessage] = useState(null);
  const [statusIndex, setStatusIndex] = useState(0);

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
      setStep("results");
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong. Please try again.");
      setStep("error");
    }
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
                maskImageUrl={r.maskImageUrl}
              />
            ))}
          </div>
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
