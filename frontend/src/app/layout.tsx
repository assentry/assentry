import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAPI — The Trust Infrastructure for the Agentic Internet",
  description:
    "HAPI connects people, AI agents and websites through a trusted identity and authorisation layer — making it possible for AI to act on your behalf while you remain in control.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
