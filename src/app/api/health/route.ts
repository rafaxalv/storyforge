import { NextResponse } from "next/server";
import { getPool } from "@/server/db/client";
import { checkDatabase } from "@/server/db/health";
import { log } from "@/server/log";
import { appVersion } from "@/shared/version";

export const dynamic = "force-dynamic";

const logger = log("health");

export async function GET(): Promise<NextResponse> {
  const version = appVersion();
  const status = await checkDatabase(getPool());
  if (status.ok) {
    return NextResponse.json({ version, db: "ok" }, { headers: { "cache-control": "no-store" } });
  }
  logger.warn(
    { event: "health.db.failed", reason: status.reason, durationMs: status.durationMs },
    "database check failed",
  );
  return NextResponse.json(
    { version, db: "error" },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}
