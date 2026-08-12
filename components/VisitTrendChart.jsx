"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function VisitTrendChart({ data, series }) {
  return (
    <ResponsiveContainer width="100%" aspect={1.618}>
      <LineChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="date" stroke="var(--color-text-muted)" />
        <YAxis width="auto" domain={[0, 100]} stroke="var(--color-text-muted)" />
        <Tooltip cursor={{ stroke: "var(--color-border)" }} content={<ImagePreviewTooltip />} />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        {series.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.label}
            stroke={s.color}
            dot={{ fill: "var(--color-surface)" }}
            activeDot={{ r: 8, stroke: "var(--color-surface)" }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Each chart row represents one visit — the photo is shared across every concern's
// point at that date, so it's shown once, with every active line's score listed below.
function ImagePreviewTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div style={tooltip}>
      {point.imageUrl && <img src={point.imageUrl} alt={`Visit on ${label}`} style={thumb} />}
      <div>
        <div style={dateStyle}>{label}</div>
        {payload.map((entry) => (
          <div key={entry.dataKey} style={{ color: entry.color, fontSize: 12 }}>
            {entry.name}: {entry.value}
          </div>
        ))}
      </div>
    </div>
  );
}

const tooltip = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-soft)",
  padding: 12,
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
};

const thumb = {
  width: 48,
  height: 48,
  objectFit: "cover",
  borderRadius: 10,
  flexShrink: 0,
};

const dateStyle = {
  fontSize: 12,
  color: "var(--color-text-muted)",
  marginBottom: 4,
};
