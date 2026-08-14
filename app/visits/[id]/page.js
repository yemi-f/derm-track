import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { latestByKey } from "@/lib/latestByKey";
import ExpandableImage from "@/components/ExpandableImage";
import VisitConcernExplorer from "@/components/VisitConcernExplorer";
import UserMenu from "@/components/UserMenu";

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 24px" }}>
      <div style={topLinks}>
        <Link href="/visits" style={backLink}>
          ← Back to visits
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href={`/visits/${visit.id}/share`} style={backLink}>
            Share with provider
          </Link>
          <UserMenu email={user.email} />
        </div>
      </div>

      <h1 style={{ marginBottom: 4 }}>{formatDate(visit.created_at)}</h1>
      {visit.notes && <p style={{ color: "var(--color-text-muted)" }}>{visit.notes}</p>}

      <VisitConcernExplorer
        visitId={visit.id}
        imagePath={visit.original_image_path}
        originalImageUrl={originalImageUrl}
        heroImage={<ExpandableImage src={originalImageUrl} style={heroImageStyle} />}
        scores={scores}
        initialTreatmentSelections={initialTreatmentSelections}
        initialSimulations={initialSimulations}
      />
    </main>
  );
}

const topLinks = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
  flexWrap: "wrap",
  gap: 8,
};

const backLink = {
  display: "inline-block",
  fontSize: 13,
  color: "var(--color-primary-dark)",
  textDecoration: "none",
};

const heroImageStyle = {
  width: "100%",
  maxHeight: 360,
  objectFit: "cover",
  borderRadius: "var(--radius)",
  marginBottom: 24,
};
