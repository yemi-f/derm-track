import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import ExpandableImage from "@/components/ExpandableImage";
import VisitConcernExplorer from "@/components/VisitConcernExplorer";

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
  const initialTreatmentSelections = Object.fromEntries(
    [...latestTreatmentByConcern.values()].map((t) => [t.concern_key, t.treatment_id])
  );

  const latestSimByConcernIntensity = latestByKey(
    visit.simulations || [],
    (s) => `${s.concern_key}:${s.intensity}`
  );
  const initialSimulations = {};
  for (const sim of latestSimByConcernIntensity.values()) {
    const urls = initialSimulations[sim.concern_key] || {};
    urls[String(sim.intensity)] = await getSignedUrl(sim.simulated_image_path, {
      expiresInSeconds: 3600,
    });
    initialSimulations[sim.concern_key] = urls;
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: "0 24px" }}>
      <Link href="/visits" style={backLink}>
        ← Back to visits
      </Link>

      <h1 style={{ marginBottom: 4 }}>{formatDate(visit.created_at)}</h1>
      {visit.notes && <p style={{ color: "var(--color-text-muted)" }}>{visit.notes}</p>}

      <ExpandableImage src={originalImageUrl} style={heroImage} />

      <VisitConcernExplorer
        visitId={visit.id}
        imagePath={visit.original_image_path}
        originalImageUrl={originalImageUrl}
        scores={scores}
        initialTreatmentSelections={initialTreatmentSelections}
        initialSimulations={initialSimulations}
      />
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
