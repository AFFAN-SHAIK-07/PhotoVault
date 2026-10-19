import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {}),
  max: 10,
  idleTimeoutMillis: 30_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
