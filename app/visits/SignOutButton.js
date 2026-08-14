"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { secondaryButtonColors } from "@/lib/buttonStyles";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        padding: "10px 16px",
        borderRadius: 10,
        ...secondaryButtonColors,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
