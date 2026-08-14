"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UserMenu({ email }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = email ? email[0].toUpperCase() : "?";

  return (
    <div style={wrapper} ref={wrapperRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={avatar}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {initial}
      </button>

      {open && (
        <div style={dropdown} role="menu">
          <button style={menuItem} onClick={handleSignOut} role="menuitem">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const wrapper = {
  position: "relative",
};

const avatar = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: "none",
  background: "var(--color-text)",
  color: "#fff",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dropdown = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  background: "var(--color-surface)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-soft)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--color-border)",
  minWidth: 140,
  padding: 6,
  zIndex: 10,
};

const menuItem = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "8px 10px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "var(--color-text)",
  fontSize: 14,
  cursor: "pointer",
};
