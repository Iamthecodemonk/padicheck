import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let client: pg.PoolClient | undefined;
let locked = false;
try {
  client = await pool.connect();
  await client.query("SET lock_timeout = '5s'");
  await client.query("SET statement_timeout = '30s'");
  await client.query('SELECT pg_advisory_lock($1)', [721934201]);
  locked = true;
  const sql = await readFile(new URL('../db/migrations/002_align_legacy_schema.sql', import.meta.url), 'utf8');
  await client.query(sql);
  console.log('Applied 002_align_legacy_schema.sql.');
} catch (error) {
  if (client) await client.query('ROLLBACK');
  // PostgreSQL messages for this migration contain schema information only.
  const failure = error as { code?: string; message?: string };
  console.error('Alignment failed:', failure.code ?? 'connection_or_file_error', failure.code ? failure.message : 'Check configuration and database availability');
  process.exitCode = 1;
} finally {
  if (client) {
    if (locked) await client.query('SELECT pg_advisory_unlock($1)', [721934201]);
    client.release();
  }
  await pool.end();
}
