"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { validateMinDimensions } from "@/lib/imageValidation";
import { primaryButtonColors } from "@/lib/buttonStyles";
import CameraKitCapture from "@/components/CameraKitCapture";

const ANALYZING_MESSAGES = [
  "Calling Skin Analysis…",
  "Checking for redness…",
  "Measuring texture and pores…",
  "Almost done…",
];

export default function NewVisitFlow() {
  const router = useRouter();
  const [step, setStep] = useState("capture"); // capture | uploading | analyzing | error
  const [captureError, setCaptureError] = useState(null);
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

  function handleRetake() {
    setStep("capture");
  }

  async function handleCaptured(blob, dimensions) {
    const check = validateMinDimensions(dimensions, "SD");
    if (!check.valid) {
      setCaptureError(check.message);
      return;
    }
    setCaptureError(null);
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
        .upload(imagePath, blob, { contentType: "image/jpeg", upsert: true });

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

      // The visit row (and its concern_scores) is already saved server-side by this
      // point — its detail page is the real destination, not an inline results screen.
      router.push(`/visits/${tempVisitIdRef.current}`);
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong. Please try again.");
      setStep("error");
    }
  }

  return (
    <div>
      {step === "capture" && (
        <div>
          {captureError && <p style={{ color: "#a13a34" }}>{captureError}</p>}
          <CameraKitCapture onCaptured={handleCaptured} />
        </div>
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
    </div>
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
  ...primaryButtonColors,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
