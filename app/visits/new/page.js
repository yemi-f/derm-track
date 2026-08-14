import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UserMenu from "@/components/UserMenu";
import NewVisitFlow from "@/components/NewVisitFlow";

const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Your Clinic";

export default async function NewVisitPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: "0 24px" }}>
      <div style={topLinks}>
        <Link href="/visits" style={backLink}>
          ← Back to visits
        </Link>
        <UserMenu email={user.email} />
      </div>

      <h1 style={{ marginTop: 4, marginBottom: 4 }}>New Visit</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        Take a clear, front-facing selfie for your skin analysis.
      </p>

      <NewVisitFlow />
    </main>
  );
}

const topLinks = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
};

const backLink = {
  fontSize: 13,
  color: "var(--color-primary-dark)",
  textDecoration: "none",
};

const eyebrow = {
  color: "var(--color-text-muted)",
  fontSize: 13,
  margin: 0,
};
