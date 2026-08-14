// The one part of "primary button" styling that's identical everywhere. Uses
// --color-primary-dark (not the paler --color-primary) so white text stays legible —
// white on --color-primary was only ~2.6:1 contrast and read as a disabled button.
// Padding/fontSize intentionally stay local per file — they vary by context.
export const primaryButtonColors = {
  background: "var(--color-primary-dark)",
  color: "#fff",
};

// Outline/secondary style (Sign out, Share with provider, Retake) — was drifting
// out of sync across files (e.g. one copy bolded, others not), same risk as above.
export const secondaryButtonColors = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};
