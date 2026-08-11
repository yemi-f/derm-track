export default function ConcernScoreCard({ label, uiScore, maskImageUrl }) {
  return (
    <div style={card}>
      {maskImageUrl && (
        <img src={maskImageUrl} alt={`${label} detection mask`} style={maskImg} />
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

const maskImg = {
  width: "100%",
  aspectRatio: "1",
  objectFit: "cover",
  borderRadius: 10,
  marginBottom: 10,
  background: "var(--color-bg)",
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
