import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import ConcernScoreCard from "@/components/ConcernScoreCard";
import SimulationComparison from "@/components/SimulationComparison";
import ExpandableImage from "@/components/ExpandableImage";
import concernConfig from "@/lib/concern-treatment-config.json";

const CONCERN_LABELS = Object.fromEntries(
  concernConfig.concerns.map((c) => [c.id, c.label])
);
const TREATMENTS_BY_CONCERN = Object.fromEntries(
  concernConfig.concerns.map((c) => [c.id, c.treatments])
);

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Keeps the latest row per key — treatment_selections/simulations have no uniqueness
// constraint (a user can change their pick), so history is append-only.
function latestByKey(rows, keyFn) {
  const byKey = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const existing = byKey.get(key);
    if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
      byKey.set(key, row);
    }
  }
  return byKey;
}

export default async function VisitDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: visit } = await supabase
    .from("visits")
    .select(
      `id, created_at, notes, original_image_path,
       concern_scores(concern_key, ui_score, raw_score, mask_image_path),
       treatment_selections(concern_key, treatment_id, created_at),
       simulations(concern_key, treatment_id, intensity, simulated_image_path, created_at)`
    )
    .eq("id", id)
    .single();

  if (!visit) {
    notFound();
  }

  const originalImageUrl = await getSignedUrl(visit.original_image_path, {
    expiresInSeconds: 3600,
  });

  const scores = await Promise.all(
    (visit.concern_scores || []).map(async (cs) => ({
      concern: cs.concern_key,
      uiScore: cs.ui_score,
      maskImageUrl: cs.mask_image_path
        ? await getSignedUrl(cs.mask_image_path, { expiresInSeconds: 3600 })
        : null,
    }))
  );
  scores.sort((a, b) => a.uiScore - b.uiScore);

  const latestTreatmentByConcern = latestByKey(
    visit.treatment_selections || [],
    (t) => t.concern_key
  );

  const latestSimByConcernIntensity = latestByKey(
    visit.simulations || [],
    (s) => `${s.concern_key}:${s.intensity}`
  );

  const simulationsByConcern = {};
  for (const sim of latestSimByConcernIntensity.values()) {
    const urls = simulationsByConcern[sim.concern_key] || {};
    urls[String(sim.intensity)] = await getSignedUrl(sim.simulated_image_path, {
      expiresInSeconds: 3600,
    });
    simulationsByConcern[sim.concern_key] = urls;
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: "0 24px" }}>
      <Link href="/visits" style={backLink}>
        ← Back to visits
      </Link>

      <h1 style={{ marginBottom: 4 }}>{formatDate(visit.created_at)}</h1>
      {visit.notes && <p style={{ color: "var(--color-text-muted)" }}>{visit.notes}</p>}

      <ExpandableImage src={originalImageUrl} style={heroImage} />

      <h2 style={sectionTitle}>Concern Scores</h2>
      <div style={grid}>
        {scores.map((s) => (
          <ConcernScoreCard
            key={s.concern}
            label={CONCERN_LABELS[s.concern] || s.concern}
            uiScore={s.uiScore}
            originalImageUrl={originalImageUrl}
            maskImageUrl={s.maskImageUrl}
          />
        ))}
      </div>

      {[...latestTreatmentByConcern.values()].map((treatment) => {
        const simulations = simulationsByConcern[treatment.concern_key];
        if (!simulations) return null;

        const treatmentLabel =
          TREATMENTS_BY_CONCERN[treatment.concern_key]?.find(
            (t) => t.id === treatment.treatment_id
          )?.label || treatment.treatment_id;

        return (
          <div key={treatment.concern_key} style={panel}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>
              {CONCERN_LABELS[treatment.concern_key] || treatment.concern_key} — {treatmentLabel}
            </h3>
            <SimulationComparison
              originalImageUrl={originalImageUrl}
              simulations={simulations}
              loadingIntensity={null}
            />
          </div>
        );
      })}
    </main>
  );
}

const backLink = {
  display: "inline-block",
  marginBottom: 16,
  fontSize: 13,
  color: "var(--color-primary-dark)",
  textDecoration: "none",
};

const heroImage = {
  width: "100%",
  maxHeight: 360,
  objectFit: "cover",
  borderRadius: "var(--radius)",
  marginBottom: 24,
};

const sectionTitle = {
  fontSize: 16,
  marginBottom: 12,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const panel = {
  marginTop: 16,
  padding: 20,
  background: "var(--color-surface)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-soft)",
};
