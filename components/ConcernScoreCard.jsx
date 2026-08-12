"use client";

import { useState } from "react";
import Lightbox from "./Lightbox";

export default function ConcernScoreCard({
  label,
  uiScore,
  originalImageUrl,
  maskImageUrl,
  onClick,
  selected,
}) {
  const [expanded, setExpanded] = useState(false);

  function handleImageClick(e) {
    e.stopPropagation();
    setExpanded(true);
  }

  return (
    <div
      style={{
        ...card,
        ...(selected ? cardSelected : null),
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {originalImageUrl && (
        <div
          style={{ ...imageStack, cursor: "zoom-in" }}
          onClick={handleImageClick}
          role="button"
          aria-label={`Expand ${label} photo`}
        >
          <img src={originalImageUrl} alt="" style={layer} />
          {maskImageUrl && (
            <img src={maskImageUrl} alt={`${label} detection mask`} style={layer} />
          )}
        </div>
      )}
      <div style={scoreRow}>
        <span style={score}>{uiScore}</span>
        <span style={maxScore}>/100</span>
      </div>
      <div style={labelStyle}>{label}</div>

      <Lightbox open={expanded} onClose={() => setExpanded(false)}>
        <div style={expandedStack}>
          <img src={originalImageUrl} alt="" style={expandedLayer} />
          {maskImageUrl && (
            <img src={maskImageUrl} alt={`${label} detection mask`} style={expandedLayer} />
          )}
        </div>
      </Lightbox>
    </div>
  );
}

const card = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-soft)",
  padding: 16,
  textAlign: "center",
  borderWidth: 2,
  borderStyle: "solid",
  borderColor: "transparent",
};

const cardSelected = {
  borderColor: "var(--color-primary)",
};

const imageStack = {
  position: "relative",
  width: "100%",
  aspectRatio: "1",
  borderRadius: 10,
  marginBottom: 10,
  overflow: "hidden",
  background: "var(--color-bg)",
};

const layer = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const expandedStack = {
  position: "relative",
  width: "min(90vw, 480px)",
  height: "min(90vh, 480px)",
  borderRadius: 12,
  overflow: "hidden",
};

const expandedLayer = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain",
};

const scoreRow = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "center",
  gap: 2,
};

const score = {
  fontSize: 28,
  fontWeight: 700,
  color: "var(--color-text)",
};

const maxScore = {
  fontSize: 13,
  color: "var(--color-text-muted)",
};

const labelStyle = {
  marginTop: 4,
  fontSize: 14,
  color: "var(--color-text-muted)",
};
