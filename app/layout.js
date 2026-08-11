import "./globals.css";

const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Your Clinic";

export const metadata = {
  title: `${clinicName} — Skin Journey`,
  description: `Track your skin treatment journey with ${clinicName}.`,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
