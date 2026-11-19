import Link from "next/link";
import type { ReactNode } from "react";
import { requirePageActor } from "@/server/auth/page-actor";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

/** Second, authoritative layer of page protection: the session is checked in the database. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const actor = await requirePageActor();

  return (
    <div style={{ maxWidth: "40rem", margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "baseline",
          borderBottom: "1px solid #ddd",
          paddingBottom: "0.5rem",
          marginBottom: "2rem",
        }}
      >
        <Link href="/" style={{ fontWeight: "bold", marginRight: "auto" }}>
          storyforge
        </Link>
        <span data-testid="user-name">{actor.name}</span>
        <Link href="/settings">Settings</Link>
        <form action={signOutAction}>
          <button type="submit">Sign out</button>
        </form>
      </header>
      {children}
    </div>
  );
}
