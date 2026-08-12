"use client";

import { useEffect } from "react";

export default function Lightbox({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={overlay} onClick={onClose}>
      <button style={closeButton} onClick={onClose} aria-label="Close">
        ×
      </button>
      <div style={content} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 24,
};

const content = {
  maxWidth: "90vw",
  maxHeight: "90vh",
  display: "flex",
  gap: 4,
};

const closeButton = {
  position: "fixed",
  top: 16,
  right: 20,
  background: "none",
  border: "none",
  color: "#fff",
  fontSize: 36,
  lineHeight: 1,
  cursor: "pointer",
  padding: 8,
};
