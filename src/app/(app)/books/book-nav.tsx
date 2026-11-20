"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ConceptPanelToggle } from "./concept-editor";

/** The Desk's segmented tabs, in Desk order (later epics add Research, Writing styles, …). */
function Tabs({ bookId }: { bookId: string }) {
  const pathname = usePathname();
  const panel = useSearchParams().get("panel");
  const keep = panel ? `?panel=${encodeURIComponent(panel)}` : "";
  const tabs = [
    { href: `/books/${bookId}/concept`, label: "Concept", keepPanel: false },
    { href: `/books/${bookId}`, label: "Chapters", keepPanel: true },
    { href: `/books/${bookId}/profile`, label: "Profile", keepPanel: true },
  ];
  return (
    <>
      <nav className="tabs" aria-label="Book">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.keepPanel ? `${t.href}${keep}` : t.href}
            aria-current={pathname === t.href ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {!pathname.endsWith("/concept") && <ConceptPanelToggle />}
    </>
  );
}

export function BookNav({ bookId }: { bookId: string }) {
  return (
    <Suspense fallback={<nav className="tabs" aria-label="Book" />}>
      <Tabs bookId={bookId} />
    </Suspense>
  );
}
