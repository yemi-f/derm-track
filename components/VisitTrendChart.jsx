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
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -16 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
          width={36}
        />
        <Tooltip content={<ImagePreviewTooltip series={series} />} />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        {series.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Each chart row represents one visit — the photo is shared across every concern's
// point at that date, so it's shown once, with every active line's score listed below.
function ImagePreviewTooltip({ active, payload, label, series }) {
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
