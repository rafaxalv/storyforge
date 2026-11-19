import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { simpleParser } from "mailparser";
import pg from "pg";
import { SMTPServer } from "smtp-server";
import { loadEnv } from "../../src/server/env";

/** Where the sink writes received messages (one JSON file each) for the specs to read. */
export const SINK_DIR = join(process.cwd(), "test-results", "smtp-sink");
export const SMTP_PORT = 2526;

/**
 * Playwright global setup: a local SMTP server that accepts every message, so the
 * production build can send sign-in links through its real SMTP transport. Also clears the
 * test database's rate-limit counters so repeated e2e runs don't hit the sign-in limit.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  loadEnv();
  await rm(SINK_DIR, { recursive: true, force: true });
  await mkdir(SINK_DIR, { recursive: true });

  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set (see .env.example)");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query(`TRUNCATE "rate_limit"`);
  await client.end();

  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS", "AUTH"],
    logger: false,
    onData(stream, _session, callback) {
      simpleParser(stream)
        .then(async (mail) => {
          const to = Array.isArray(mail.to) ? mail.to[0]?.text : mail.to?.text;
          const file = join(SINK_DIR, `${Date.now()}-${crypto.randomUUID()}.json`);
          await writeFile(file, JSON.stringify({ to, subject: mail.subject, text: mail.text }));
          callback();
        })
        .catch((err: Error) => callback(err));
    },
  });
  await new Promise<void>((resolve) => server.listen(SMTP_PORT, "127.0.0.1", resolve));
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
