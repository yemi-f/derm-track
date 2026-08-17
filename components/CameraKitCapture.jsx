"use client";

import { useEffect, useRef, useState } from "react";
import { primaryButtonColors } from "@/lib/buttonStyles";

const SDK_URL = "https://plugins-media.makeupar.com/v2.5-camera-kit/sdk.js";
const SCRIPT_ID = "ymk-camera-kit-sdk";
const LOAD_TIMEOUT_MS = 10000;

const CAMERA_FAILED_MESSAGES = {
  error_permission_denied:
    "Camera access is blocked. Enable camera permission for this site in your browser settings, then try again.",
  error_access_failed: "We couldn't access a camera on this device.",
  error_resolution_unsupported:
    "Your camera doesn't meet the resolution needed for skin analysis.",
};

const SDK_LOAD_ERROR =
  "Couldn't load the camera module. Check your connection, or try disabling ad-blocking/privacy extensions for this site, then try again.";

export default function CameraKitCapture({ onCaptured }) {
  const [status, setStatus] = useState("loading"); // loading | ready | opened | error
  const [error, setError] = useState(null);
  const [errorKind, setErrorKind] = useState(null); // "sdk" | "camera"
  const [retryKey, setRetryKey] = useState(0);
  const listenerIdsRef = useRef([]);
  const openedRef = useRef(false);

  useEffect(() => {
    let settled = false;

    function handleReady() {
      if (settled) return;
      settled = true;
      setStatus("ready");
    }

    function handleLoadFailure(reason) {
      if (settled) return;
      settled = true;
      console.error("[CameraKitCapture] Camera Kit SDK failed to load:", reason);
      setStatus("error");
      setErrorKind("sdk");
      setError(SDK_LOAD_ERROR);
    }

    const timeoutId = setTimeout(() => {
      handleLoadFailure("timed out waiting for window.YMK after " + LOAD_TIMEOUT_MS + "ms");
    }, LOAD_TIMEOUT_MS);

    // The vendor docs' own example doesn't actually gate on window.YMKAsyncInit firing
    // before calling YMK.init() — it's registered as a place to put setup code, not a
    // guaranteed callback. So treat readiness as "whichever signal comes first": the
    // AsyncInit hook (if it does fire), the script's load event, or a short poll —
    // all just checking that window.YMK exists.
    function checkYmkReady() {
      if (window.YMK) handleReady();
    }

    const pollId = setInterval(checkYmkReady, 200);

    if (window.YMK) {
      handleReady();
    } else {
      window.YMKAsyncInit = handleReady;

      let script = document.getElementById(SCRIPT_ID);
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SDK_URL;
        script.async = true;
        document.body.appendChild(script);
      }
      script.addEventListener("load", checkYmkReady);
      script.addEventListener("error", () => handleLoadFailure("script tag 'error' event"));
    }

    return () => {
      clearTimeout(timeoutId);
      clearInterval(pollId);
      listenerIdsRef.current.forEach((id) => window.YMK?.removeEventListener(id));
      listenerIdsRef.current = [];
      if (openedRef.current) {
        window.YMK?.close();
        openedRef.current = false;
      }
    };
  }, [retryKey]);

  function retryLoad() {
    setError(null);
    setErrorKind(null);
    setStatus("loading");
    document.getElementById(SCRIPT_ID)?.remove();
    setRetryKey((k) => k + 1);
  }

  function openCamera() {
    setError(null);
    setErrorKind(null);

    window.YMK.init({
      faceDetectionMode: "skincare",
      imageFormat: "blob",
      qualityLevel: "moderate",
      width: 480,
      height: 640,
    });

    const capturedId = window.YMK.addEventListener("faceDetectionCaptured", (result) => {
      const first = result.images?.[0];
      if (first) {
        listenerIdsRef.current.forEach((id) => window.YMK?.removeEventListener(id));
        listenerIdsRef.current = [];
        window.YMK?.close();
        openedRef.current = false;
        onCaptured(first.image, { width: first.width, height: first.height });
      }
    });

    const failedId = window.YMK.addEventListener("cameraFailed", (err) => {
      console.error("[CameraKitCapture] cameraFailed:", err);
      setStatus("error");
      setErrorKind("camera");
      setError(
        CAMERA_FAILED_MESSAGES[err?.code] ||
          "We couldn't open your camera. Please try again."
      );
    });

    // Fired when the user exits the Camera Kit's own UI without capturing or
    // erroring — without this, there's no path back to "ready" and the page
    // goes blank (no camera view, no Start Camera button).
    const closedId = window.YMK.addEventListener("closed", () => {
      listenerIdsRef.current.forEach((id) => window.YMK?.removeEventListener(id));
      listenerIdsRef.current = [];
      openedRef.current = false;
      setStatus((current) => (current === "error" ? current : "ready"));
    });

    listenerIdsRef.current.push(capturedId, failedId, closedId);

    window.YMK.openCameraKit();
    openedRef.current = true;
    setStatus("opened");
  }

  return (
    <div style={{ textAlign: "center" }}>
      <div id="YMK-module" style={{ margin: "0 auto" }} />

      {status === "loading" && (
        <p style={{ color: "var(--color-text-muted)" }}>Loading camera…</p>
      )}

      {status === "ready" && (
        <button style={primaryButton} onClick={openCamera}>
          Start Camera
        </button>
      )}

      {status === "error" && (
        <div>
          <p style={{ color: "#a13a34" }}>{error}</p>
          <button
            style={primaryButton}
            onClick={errorKind === "sdk" ? retryLoad : openCamera}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

const primaryButton = {
  marginTop: 16,
  padding: "12px 20px",
  borderRadius: 10,
  border: "none",
  ...primaryButtonColors,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
