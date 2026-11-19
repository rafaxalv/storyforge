import type pg from "pg";

export type DbStatus =
  { ok: true; durationMs: number } | { ok: false; durationMs: number; reason: "timeout" | "error" };

/** Runs `SELECT 1` and reports within `timeoutMs`; never throws. */
export async function checkDatabase(pool: pg.Pool, timeoutMs = 2_000): Promise<DbStatus> {
  const started = performance.now();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  try {
    const outcome = await Promise.race([pool.query("SELECT 1").then(() => "ok" as const), timeout]);
    const durationMs = Math.round(performance.now() - started);
    return outcome === "ok"
      ? { ok: true, durationMs }
      : { ok: false, durationMs, reason: "timeout" };
  } catch {
    return { ok: false, durationMs: Math.round(performance.now() - started), reason: "error" };
  } finally {
    clearTimeout(timer);
  }
}
