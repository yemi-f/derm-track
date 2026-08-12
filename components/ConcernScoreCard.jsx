export default function ConcernScoreCard({ label, uiScore, originalImageUrl, maskImageUrl }) {
  return (
    <div style={card}>
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
