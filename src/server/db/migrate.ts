import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { createPool } from "./client";
import { log } from "../log";
import { getEnv } from "../env";

export const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations", import.meta.url));

/** Applies pending SQL migrations to the given database. */
export async function runMigrations(
  databaseUrl: string,
  migrationsFolder = MIGRATIONS_DIR,
): Promise<void> {
  const pool = createPool(databaseUrl);
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

// CLI: `npm run db:migrate` (or `node dist/migrate.js` in the image)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const logger = log("db");
  const env = getEnv();
  const folder = process.env.MIGRATIONS_DIR ?? MIGRATIONS_DIR;
  runMigrations(env.DATABASE_URL, folder)
    .then(() => logger.info({ event: "db.migrated" }, "migrations applied"))
    .catch((err: unknown) => {
      logger.error({ event: "db.migrate.failed", err }, "migrations failed");
      process.exitCode = 1;
    });
}
