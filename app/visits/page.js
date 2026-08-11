import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Your Clinic";

// Placeholder — replaced by the real visit history (list + trend graph) in a later milestone.
export default async function VisitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main style={{ maxWidth: 480, margin: "60px auto", padding: "0 24px" }}>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: 0 }}>
        {clinicName}
      </p>
      <h1 style={{ marginTop: 4 }}>You&apos;re signed in</h1>
      <p style={{ color: "var(--color-text-muted)" }}>{user.email}</p>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
        Visit history goes here.
      </p>
      <SignOutButton />
    </main>
  );
}
