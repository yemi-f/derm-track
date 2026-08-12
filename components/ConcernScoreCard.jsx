export default function ConcernScoreCard({
  label,
  uiScore,
  originalImageUrl,
  maskImageUrl,
  onClick,
  selected,
}) {
  return (
    <div
      style={selected ? { ...card, ...cardSelected } : card}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {originalImageUrl && (
        <div style={imageStack}>
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
    </div>
  );
}

const card = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-soft)",
  padding: 16,
  textAlign: "center",
  cursor: "pointer",
  border: "2px solid transparent",
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
