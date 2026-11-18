import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

interface DbHolder {
  pool: pg.Pool;
  db: Database;
}

// One pool per process, shared across the server bundle and Next's route bundles.
const KEY = Symbol.for("storyforge.db");
type Holder = { [KEY]?: DbHolder };

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 30_000,
  });
}

function holder(): DbHolder {
  const g = globalThis as Holder;
  if (!g[KEY]) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const pool = createPool(url);
    g[KEY] = { pool, db: drizzle(pool, { schema }) };
  }
  return g[KEY];
}

export function getPool(): pg.Pool {
  return holder().pool;
}

export function getDb(): Database {
  return holder().db;
}

export async function closeDb(): Promise<void> {
  const g = globalThis as Holder;
  const h = g[KEY];
  g[KEY] = undefined;
  await h?.pool.end();
}
