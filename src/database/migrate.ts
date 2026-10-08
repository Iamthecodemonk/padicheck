import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

// The supplied baseline includes BEGIN/COMMIT and must remain unchanged.
// This initial runner applies it once to an empty public schema. It does not
// introduce a migration-history table into the supplied data model.
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock($1)', [721934201]);
  const existing = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' LIMIT 1",
  );
  if (existing.rowCount) {
    throw new Error('Baseline requires an empty public schema. Refusing to modify an existing database.');
  }
  const sql = await readFile(new URL('../../db/migrations/001_baseline.sql', import.meta.url), 'utf8');
  await client.query(sql);
  console.log('Applied 001_baseline.sql without schema modifications.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.query('SELECT pg_advisory_unlock($1)', [721934201]);
  client.release();
  await pool.end();
}
