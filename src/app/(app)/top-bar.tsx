import Link from "next/link";
import type { ReactNode } from "react";
import { requirePageActor } from "@/server/auth/page-actor";
import { signOutAction } from "./actions";

/**
 * The Manuscript Desk's top bar: brand on the left (the book's title on book pages), then
 * the tabs and any page controls, then the author's name, Settings and Sign out.
 */
export async function TopBar({
  brand,
  sub,
  children,
}: {
  brand?: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  const actor = await requirePageActor();
  return (
    <header className="bar">
      <div className="brand">
        {brand ?? (
          <Link href="/" className="book">
            storyforge
          </Link>
        )}
        {sub && <span className="sub">{sub}</span>}
      </div>
      {children}
      <div className="user">
        <span data-testid="user-name">{actor.name}</span>
        <Link href="/settings">Settings</Link>
        <form action={signOutAction}>
          <button type="submit">Sign out</button>
        </form>
      </div>
    </header>
  );
}

/** Pages outside a book: the bar and one centred column. */
export async function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <TopBar sub="A writing desk for authors" />
      <main className="single">
        <div className="page">{children}</div>
      </main>
    </>
  );
}
