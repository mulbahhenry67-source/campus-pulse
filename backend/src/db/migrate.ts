/**
 * Minimal, dependency-light migration runner.
 * Applies every .sql file in ./migrations in filename order that hasn't
 * already been recorded in the schema_migrations table.
 */
import fs from "fs";
import path from "path";
import { pool } from "./pool";
import { logger } from "../utils/logger";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const { rows } = await pool.query<{ filename: string }>("SELECT filename FROM schema_migrations");
  return new Set(rows.map((r) => r.filename));
}

async function run() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      logger.info(`Skipping already-applied migration: ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    logger.info(`Applying migration: ${file}`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      logger.info(`Applied: ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error({ err }, `Failed to apply migration: ${file}`);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  logger.info("All migrations applied.");
  await pool.end();
}

run().catch((err) => {
  logger.error({ err }, "Migration run failed");
  process.exit(1);
});
