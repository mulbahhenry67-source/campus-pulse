import { Pool } from "pg";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  // Unexpected errors on idle clients — log and let the process supervisor decide
  // whether to restart; never crash silently.
  logger.error({ err }, "Unexpected error on idle Postgres client");
});

/**
 * Run a callback inside a transaction. Commits on success, rolls back on any
 * thrown error, and always releases the client back to the pool.
 */
export async function withTransaction<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
