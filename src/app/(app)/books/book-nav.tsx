"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ConceptPanelToggle } from "./concept-editor";

function Tabs({ bookId }: { bookId: string }) {
  const pathname = usePathname();
  const panel = useSearchParams().get("panel");
  const keep = panel ? `?panel=${encodeURIComponent(panel)}` : "";
  const tabs = [
    { href: `/books/${bookId}`, label: "Outline" },
    { href: `/books/${bookId}/profile`, label: "Profile" },
    { href: `/books/${bookId}/concept`, label: "Concept" },
  ];
  return (
    <nav className="tabs" aria-label="Book">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.label === "Concept" ? t.href : `${t.href}${keep}`}
          aria-current={pathname === t.href ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
      {!pathname.endsWith("/concept") && (
        <span className="panel-toggle">
          <ConceptPanelToggle />
        </span>
      )}
    </nav>
  );
}

export function BookNav({ bookId }: { bookId: string }) {
  return (
    <Suspense fallback={<nav className="tabs" aria-label="Book" />}>
      <Tabs bookId={bookId} />
    </Suspense>
  );
}
