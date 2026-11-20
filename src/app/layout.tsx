import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Spectral } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// The Manuscript Desk's fonts, self-hosted by Next (fetched at build time, never from the
// browser): Spectral for the text, Public Sans for the interface, IBM Plex Mono for ids.
const text = Spectral({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--ff-text",
  display: "swap",
});
const ui = Public_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-ui",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--ff-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "storyforge",
  description: "A writing desk for authors.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${text.variable} ${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
