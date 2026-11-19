import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { createPool } from "./client";
import { log } from "../log";
import { startProcess } from "../startup";

/**
 * SQL migrations, next to this module: src/server/db/migrations under tsx, and
 * dist/migrations in the build (scripts/build-server.mjs copies them there).
 */
const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations", import.meta.url));

/** Applies pending SQL migrations to the given database. */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = createPool(databaseUrl);
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await pool.end();
  }
}

// CLI: `npm run db:migrate` (or `node dist/migrate.js` in the image)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const env = startProcess("migrate");
  const logger = log("db");
  runMigrations(env.DATABASE_URL)
    .then(() => logger.info({ event: "db.migrated" }, "migrations applied"))
    .catch((err: unknown) => {
      logger.error({ event: "db.migrate.failed", err }, "migrations failed");
      process.exitCode = 1;
    });
}
