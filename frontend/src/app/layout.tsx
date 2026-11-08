import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Downloaded at build time and served from assentry.io itself, so visitors'
// browsers never contact a third party for it.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Assentry: The Trust Infrastructure for the Agentic Internet",
  description:
    "Assentry connects people, AI agents and websites through a trusted identity and authorisation layer, making it possible for AI to act on your behalf while you remain in control.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
