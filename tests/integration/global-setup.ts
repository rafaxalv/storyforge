import pg from "pg";
import { runMigrations } from "@/server/db/migrate";
import { testDatabaseUrl } from "../helpers";

/** Fails fast with a clear message when Postgres is not running, then migrates the test DB. */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 3_000 });
  try {
    await client.connect();
  } catch {
    throw new Error(
      "Integration tests need Postgres at DATABASE_URL_TEST. Start it with `docker compose up -d` (see doc/README.md).",
    );
  } finally {
    await client.end().catch(() => undefined);
  }
  await runMigrations(url);
}
