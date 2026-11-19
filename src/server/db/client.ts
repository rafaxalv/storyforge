import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getEnv } from "../env";
import { log } from "../log";
import { peekProcessSingleton, processSingleton, setProcessSingleton } from "../singleton";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

interface DbHolder {
  pool: pg.Pool;
  db: Database;
}

export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 30_000,
  });
  // pg emits 'error' on the pool when an idle client loses its connection (Postgres
  // restart, network blip). Without a listener Node treats it as uncaught and the
  // process dies; with one, the client is discarded and the next query reconnects.
  pool.on("error", (err) => {
    log("db").warn({ event: "db.pool.error", err }, "idle database connection lost");
  });
  return pool;
}

// One pool per process, shared by the custom server and Next's route bundles, built from
// the validated env. Tests switch databases with withDatabaseUrl() (tests/helpers.ts).
function holder(): DbHolder {
  return processSingleton("db", () => {
    const pool = createPool(getEnv().DATABASE_URL);
    return { pool, db: drizzle(pool, { schema }) };
  });
}

export function getPool(): pg.Pool {
  return holder().pool;
}

export function getDb(): Database {
  return holder().db;
}

export async function closeDb(): Promise<void> {
  const h = peekProcessSingleton<DbHolder>("db");
  setProcessSingleton("db", undefined);
  await h?.pool.end();
}
