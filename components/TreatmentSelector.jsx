const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Your Clinic";

export default function TreatmentSelector({ treatments, selectedTreatmentId, onSelect }) {
  return (
    <div>
      <p style={heading}>Your provider may recommend:</p>
      <div style={list}>
        {treatments.map((t) => {
          const active = t.id === selectedTreatmentId;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={active ? { ...option, ...optionActive } : option}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <p style={footnote}>Recommendations from {clinicName}, not app-generated advice.</p>
    </div>
  );
}

const heading = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-text-muted)",
  margin: "0 0 10px",
};

const list = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const option = {
  textAlign: "left",
  padding: "10px 14px",
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: 14,
  cursor: "pointer",
};

const optionActive = {
  borderColor: "var(--color-primary)",
  background: "var(--color-bg)",
  fontWeight: 600,
};

const footnote = {
  fontSize: 12,
  color: "var(--color-text-muted)",
  marginTop: 10,
};
