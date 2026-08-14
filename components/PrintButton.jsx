"use client";

import { primaryButtonColors } from "@/lib/buttonStyles";

export default function PrintButton({ children = "Print / Save as PDF" }) {
  return (
    <button className="print-hide" style={button} onClick={() => window.print()}>
      {children}
    </button>
  );
}

const button = {
  padding: "12px 20px",
  borderRadius: 10,
  border: "none",
  ...primaryButtonColors,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
