import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getOptionalActor } from "@/server/auth/actor";
import { PATH_HEADER } from "@/shared/headers";
import { safeNext } from "@/shared/safe-next";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

/** Second, authoritative layer of page protection: the session is checked in the database. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const actor = await getOptionalActor();
  if (!actor) {
    // A cookie got past the middleware but the session is gone (signed out elsewhere,
    // deleted): back to sign-in, keeping the page that was asked for.
    const path = safeNext((await headers()).get(PATH_HEADER));
    redirect(path === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(path)}`);
  }

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
