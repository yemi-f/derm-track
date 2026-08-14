import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import VisitTrendChart from "@/components/VisitTrendChart";
import concernConfig from "@/lib/concern-treatment-config.json";
import { primaryButtonColors, secondaryButtonColors } from "@/lib/buttonStyles";
import SignOutButton from "./SignOutButton";

const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Your Clinic";

const CONCERN_LABELS = Object.fromEntries(
  concernConfig.concerns.map((c) => [c.id, c.label])
);

// A few complementary muted tones from the design tokens, cycled per concern line —
// not saturated chart-library defaults. See IMPLEMENTATION.md §8.2 / §7. Literal hex
// (not CSS var() strings) because these feed a canvas-rendered chart (Chart.js), which
// doesn't reliably resolve CSS custom properties the way SVG/DOM styling does.
const LINE_COLORS = [
  "#D98C99", // --color-primary
  "#8FA88A", // --color-success
  "#D9A05B", // --color-warning
  "#E8B4A0", // --color-accent
  "#B96A78", // --color-primary-dark
  "#8A7873", // --color-text-muted
];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function VisitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: visits, error } = await supabase
    .from("visits")
    .select("id, created_at, original_image_path, concern_scores(concern_key, ui_score)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[visits] failed to load visits:", error);
  }

  const rows = visits || [];

  // One signed URL per visit, reused for both the chart tooltip and the list thumbnail.
  const thumbnailUrls = Object.fromEntries(
    await Promise.all(
      rows.map(async (v) => [v.id, await getSignedUrl(v.original_image_path, { expiresInSeconds: 3600 })])
    )
  );

  // Only chart concerns with 2+ data points, so a first visit doesn't render a
  // cluttered/empty-looking single-dot graph per concern.
  const pointCounts = {};
  for (const visit of rows) {
    for (const cs of visit.concern_scores || []) {
      pointCounts[cs.concern_key] = (pointCounts[cs.concern_key] || 0) + 1;
    }
  }
  const chartConcernIds = Object.keys(pointCounts).filter((id) => pointCounts[id] >= 2);
  const series = chartConcernIds.map((id, i) => ({
    id,
    label: CONCERN_LABELS[id] || id,
    color: LINE_COLORS[i % LINE_COLORS.length],
  }));

  const chartData = rows.map((visit) => {
    const row = { date: formatDate(visit.created_at), imageUrl: thumbnailUrls[visit.id] };
    for (const cs of visit.concern_scores || []) {
      if (chartConcernIds.includes(cs.concern_key)) row[cs.concern_key] = cs.ui_score;
    }
    return row;
  });

  const listItems = [...rows].reverse().map((visit) => ({
    id: visit.id,
    date: formatDateTime(visit.created_at),
    thumbnailUrl: thumbnailUrls[visit.id],
    concernCount: visit.concern_scores?.length || 0,
  }));

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 24px" }}>
      <div style={header}>
        <div>
          <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: 0 }}>
            {clinicName}
          </p>
          <h1 style={{ marginTop: 4, marginBottom: 0 }}>Your Visits</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {rows.length > 0 && (
            <>
              <Link href="/visits/share" style={secondaryButtonLink}>
                Share with provider
              </Link>
              <Link href="/visits/new" style={primaryButtonLink}>
                New Visit
              </Link>
            </>
          )}
          <SignOutButton />
        </div>
      </div>

      {rows.length === 0 && (
        <div>
          <p style={{ color: "var(--color-text-muted)" }}>
            No visits yet. Start your first one to begin tracking progress over time.
          </p>
          <Link href="/visits/new" style={{ ...primaryButtonLink, marginTop: 4 }}>
            New Visit
          </Link>
        </div>
      )}

      {series.length > 0 && (
        <section style={panel}>
          <h2 style={sectionTitle}>Trend</h2>
          <VisitTrendChart data={chartData} series={series} />
        </section>
      )}

      {rows.length > 0 && series.length === 0 && (
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
          Track another visit to start seeing your trend over time.
        </p>
      )}

      {listItems.length > 0 && (
        <section>
          <h2 style={sectionTitle}>History</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {listItems.map((item) => (
              <Link key={item.id} href={`/visits/${item.id}`} style={listCard}>
                {item.thumbnailUrl && (
                  <img src={item.thumbnailUrl} alt="" style={listThumb} />
                )}
                <div>
                  <div style={{ fontWeight: 600 }}>{item.date}</div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                    {item.concernCount} concern{item.concernCount === 1 ? "" : "s"} tracked
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 24,
  flexWrap: "wrap",
  gap: 12,
};

const primaryButtonLink = {
  display: "inline-block",
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  ...primaryButtonColors,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
};

const secondaryButtonLink = {
  display: "inline-block",
  padding: "10px 16px",
  borderRadius: 10,
  ...secondaryButtonColors,
  fontSize: 14,
  textDecoration: "none",
};

const panel = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-soft)",
  padding: 20,
  marginBottom: 28,
};

const sectionTitle = {
  fontSize: 16,
  marginTop: 0,
  marginBottom: 16,
};

const listCard = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: 14,
  background: "var(--color-surface)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-soft)",
  textDecoration: "none",
  color: "var(--color-text)",
};

const listThumb = {
  width: 56,
  height: 56,
  objectFit: "cover",
  borderRadius: 10,
  flexShrink: 0,
};
