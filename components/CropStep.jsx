"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { resizeIfNeeded, canvasToBlob } from "@/lib/imageValidation";

export default function CropStep({ imageBlob, onConfirm, onRetake }) {
  // Object URL is created *inside* the effect, paired 1:1 with its own revoke — creating
  // it during render (e.g. via useMemo) and revoking in a separately-keyed cleanup breaks
  // under React Strict Mode's dev-only double-invoke: the cleanup fires immediately after
  // the first simulated mount, revoking the only URL that ever gets created, since useMemo
  // won't produce a new one on the second mount (imageBlob hasn't changed).
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    const url = URL.createObjectURL(imageBlob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageBlob]);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [exporting, setExporting] = useState(false);

  const handleCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setExporting(true);
    try {
      const canvas = await getCroppedCanvas(imageUrl, croppedAreaPixels);
      const resized = resizeIfNeeded(canvas);
      const blob = await canvasToBlob(resized);
      onConfirm(blob);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div style={{ position: "relative", width: "100%", height: 420, background: "#000", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {imageUrl && (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={3 / 4}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        )}
      </div>

      <div style={{ margin: "16px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ flex: 1 }}
        />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button style={secondaryButton} onClick={onRetake} disabled={exporting}>
          Retake Photo
        </button>
        <button style={primaryButton} onClick={handleConfirm} disabled={exporting || !croppedAreaPixels}>
          {exporting ? "Processing…" : "Use This Photo"}
        </button>
      </div>
    </div>
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function getCroppedCanvas(imageUrl, croppedAreaPixels) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height
  );
  return canvas;
}

const primaryButton = {
  flex: 1,
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  background: "var(--color-primary)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButton = {
  flex: 1,
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: 15,
  cursor: "pointer",
};
