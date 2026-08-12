"use client";

import { useState } from "react";
import Lightbox from "./Lightbox";

const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Your Clinic";

export default function SimulationComparison({ originalImageUrl, simulations, loadingIntensity }) {
  const [expanded, setExpanded] = useState(false);

  const columns = [
    { key: "original", label: "Start", url: originalImageUrl },
    { key: "0.3", label: "Mid", url: simulations["0.3"] },
    { key: "0.7", label: "End", url: simulations["0.7"] },
  ];
  const availableColumns = columns.filter((col) => col.url);

  return (
    <div>
      <div style={grid}>
        {columns.map((col) => (
          <div key={col.key} style={cell}>
            <div
              style={{ ...imageBox, cursor: col.url ? "zoom-in" : "default" }}
              onClick={col.url ? () => setExpanded(true) : undefined}
            >
              {col.url ? (
                <img src={col.url} alt={col.label} style={img} />
              ) : loadingIntensity === col.key ? (
                <span style={loadingText}>Simulating…</span>
              ) : (
                <span style={loadingText}>—</span>
              )}
            </div>
            <div style={label}>{col.label}</div>
          </div>
        ))}
      </div>
      <p style={disclaimer}>
        Simulated preview, not a guarantee. Check in with {clinicName} on your progress.
      </p>

      <Lightbox open={expanded} onClose={() => setExpanded(false)}>
        {availableColumns.map((col) => (
          <div key={col.key} style={lightboxCell}>
            <img src={col.url} alt={col.label} style={lightboxImg} />
            <div style={lightboxLabel}>{col.label}</div>
          </div>
        ))}
      </Lightbox>
    </div>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 10,
};

const cell = {
  textAlign: "center",
};

const imageBox = {
  aspectRatio: "3 / 4",
  borderRadius: 10,
  overflow: "hidden",
  background: "var(--color-bg)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const img = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const loadingText = {
  fontSize: 12,
  color: "var(--color-text-muted)",
};

const label = {
  marginTop: 6,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-text)",
};

const disclaimer = {
  marginTop: 12,
  fontSize: 12,
  color: "var(--color-text-muted)",
  textAlign: "center",
};

const lightboxCell = {
  flex: 1,
  minWidth: 0,
  textAlign: "center",
};

const lightboxImg = {
  width: "100%",
  maxHeight: "80vh",
  objectFit: "contain",
  borderRadius: 12,
};

const lightboxLabel = {
  marginTop: 8,
  fontSize: 14,
  fontWeight: 600,
  color: "#fff",
};
