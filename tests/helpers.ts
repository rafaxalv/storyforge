import { Writable } from "node:stream";
import { closeDb } from "@/server/db/client";
import { loadEnv, resetEnvForTests } from "@/server/env";
import { createRootLogger, setRootLogger, type Logger } from "@/server/log";
import type { LevelWithSilent } from "pino";

/** A logger that records parsed JSON lines, installed as the process root logger. */
export function captureLogs(level: LevelWithSilent = "trace"): {
  lines: Record<string, unknown>[];
  logger: Logger;
} {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      for (const raw of chunk.toString("utf8").split("\n")) {
        if (raw.trim()) lines.push(JSON.parse(raw) as Record<string, unknown>);
      }
      cb();
    },
  });
  const logger = createRootLogger({ level, stream });
  setRootLogger(logger);
  return { lines, logger };
}

/** Test database URL: DATABASE_URL_TEST from the environment or the .env files. */
export function testDatabaseUrl(): string {
  loadEnv();
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set (see .env.example)");
  return url;
}

/** A Postgres URL where nothing listens (port 1 on loopback). */
export const UNREACHABLE_DB_URL = "postgres://nobody:nothing@127.0.0.1:1/none";

/**
 * Points the app at another database: sets DATABASE_URL, forgets the validated env and
 * closes the pool, so the next getPool()/getEnv() use the new URL.
 */
export async function withDatabaseUrl(url: string): Promise<void> {
  process.env.DATABASE_URL = url;
  resetEnvForTests();
  await closeDb();
}
