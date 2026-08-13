"use client";

import { useCallback, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip);

// Literal hex, not CSS var() — see the matching comment in app/visits/page.js.
const BORDER_COLOR = "#EFE0D7"; // --color-border
const TEXT_MUTED_COLOR = "#8A7873"; // --color-text-muted

export default function VisitTrendChart({ data, series }) {
  const tooltipRef = useRef(null);

  const chartData = {
    labels: data.map((d) => d.date),
    datasets: series.map((s) => ({
      label: s.label,
      data: data.map((d) => (d[s.id] ?? null)),
      borderColor: s.color,
      backgroundColor: s.color,
      pointBackgroundColor: "#ffffff",
      pointBorderColor: s.color,
      pointRadius: 4,
      pointHoverRadius: 8,
      spanGaps: true,
      tension: 0.3,
    })),
  };

  // Chart.js's canvas tooltip can't render arbitrary HTML (e.g. the visit photo), so we
  // disable it and drive a plain positioned <div> ourselves via the documented "external"
  // tooltip hook. See https://www.chartjs.org/docs/latest/configuration/tooltip.html#external-custom-tooltips
  const externalTooltipHandler = useCallback(
    ({ chart, tooltip }) => {
      const el = tooltipRef.current;
      if (!el) return;

      if (tooltip.opacity === 0) {
        el.style.opacity = 0;
        return;
      }

      const dataIndex = tooltip.dataPoints?.[0]?.dataIndex;
      const point = dataIndex != null ? data[dataIndex] : null;

      el.replaceChildren();
      if (point) {
        if (point.imageUrl) {
          const img = document.createElement("img");
          img.src = point.imageUrl;
          img.alt = `Visit on ${point.date}`;
          Object.assign(img.style, thumbDom);
          el.appendChild(img);
        }

        const info = document.createElement("div");
        const dateEl = document.createElement("div");
        Object.assign(dateEl.style, dateDom);
        dateEl.textContent = point.date;
        info.appendChild(dateEl);

        for (const dp of tooltip.dataPoints) {
          const row = document.createElement("div");
          row.style.fontSize = "12px";
          row.style.marginTop = "2px";

          const concern = document.createElement("span");
          concern.style.color = dp.dataset.borderColor;
          concern.style.fontWeight = "600";
          concern.textContent = dp.dataset.label;

          const score = document.createElement("span");
          score.style.color = "var(--color-text)";
          score.textContent = `: ${dp.formattedValue}`;

          row.appendChild(concern);
          row.appendChild(score);
          info.appendChild(row);
        }
        el.appendChild(info);
      }

      Object.assign(el.style, {
        opacity: 1,
        left: `${chart.canvas.offsetLeft + tooltip.caretX}px`,
        top: `${chart.canvas.offsetTop + tooltip.caretY}px`,
      });
    },
    [data]
  );

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.618,
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        grid: { color: BORDER_COLOR },
        ticks: { color: TEXT_MUTED_COLOR },
      },
      y: {
        max: 100,
        grid: { color: BORDER_COLOR },
        ticks: { color: TEXT_MUTED_COLOR },
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, font: { size: 13 } },
      },
      tooltip: {
        enabled: false,
        external: externalTooltipHandler,
      },
    },
  };

  return (
    <div style={chartWrapper}>
      <Line data={chartData} options={options} />
      <div ref={tooltipRef} style={tooltip} />
    </div>
  );
}

const chartWrapper = {
  position: "relative",
};

const tooltip = {
  position: "absolute",
  pointerEvents: "none",
  transform: "translate(-50%, -110%)",
  opacity: 0,
  transition: "opacity 0.1s ease",
  background: "var(--color-surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--color-border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-soft)",
  padding: 12,
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  whiteSpace: "nowrap",
};

const thumbDom = {
  width: "48px",
  height: "48px",
  objectFit: "cover",
  borderRadius: "10px",
  flexShrink: "0",
};

const dateDom = {
  fontSize: "12px",
  color: "var(--color-text-muted)",
  marginBottom: "4px",
};
