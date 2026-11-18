import { Writable } from "node:stream";
import { existsSync } from "node:fs";
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

/** Test database URL: DATABASE_URL_TEST from the environment or .env. */
export function testDatabaseUrl(): string {
  if (!process.env.DATABASE_URL_TEST && existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set (see .env.example)");
  return url;
}

/** A Postgres URL where nothing listens (port 1 on loopback). */
export const UNREACHABLE_DB_URL = "postgres://nobody:nothing@127.0.0.1:1/none";
