import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Set DATABASE_URL before running database migrations.');
}

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationFile = path.resolve(here, '..', 'migrations', '0001_family_sharing.sql');
const migrationSql = await readFile(migrationFile, 'utf8');
const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();

try {
  await client.query('BEGIN');
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await client.query(
    'SELECT id FROM schema_migrations WHERE id = $1',
    ['0001_family_sharing'],
  );
  if (rows.length === 0) {
    await client.query(migrationSql);
    await client.query(
      'INSERT INTO schema_migrations (id) VALUES ($1)',
      ['0001_family_sharing'],
    );
    console.log('Applied migration 0001_family_sharing');
  } else {
    console.log('Database schema is up to date');
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
