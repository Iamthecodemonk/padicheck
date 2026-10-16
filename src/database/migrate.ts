import 'dotenv/config';
import { logger as rootLogger } from '../logger.js';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
const logger = rootLogger.child({ component: 'migrate' });


// The supplied baseline includes BEGIN/COMMIT and must remain unchanged.
// This initial runner applies it once to an empty public schema. It does not
// introduce a migration-history table into the supplied data model.
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
  const existing = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' LIMIT 1",
  );
  if (existing.rowCount) {
    throw new Error('Baseline requires an empty public schema. Refusing to modify an existing database.');
  }
  const sql = await readFile(new URL('../../db/migrations/001_baseline.sql', import.meta.url), 'utf8');
  await client.query(sql);
  logger.info('Applied 001_baseline.sql without schema modifications.');
} catch (error) {
  if (client) await client.query('ROLLBACK');
  throw error;
} finally {
  if (client) {
    if (locked) await client.query('SELECT pg_advisory_unlock($1)', [721934201]);
    client.release();
  }
  await pool.end();
}
