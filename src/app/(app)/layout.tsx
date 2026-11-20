import type { ReactNode } from "react";
import { requirePageActor } from "@/server/auth/page-actor";

export const dynamic = "force-dynamic";

/**
 * Second, authoritative layer of page protection: the session is checked in the database.
 * Each page draws its own top bar (TopBar / SiteFrame), since book pages put the book's
 * title and tabs in it.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requirePageActor();
  return <div className="app">{children}</div>;
}
