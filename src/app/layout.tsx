import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "storyforge",
  description: "A writing desk for authors.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Georgia, serif", margin: 0, padding: "3rem 1rem" }}>
        {children}
      </body>
    </html>
  );
}
