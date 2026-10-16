import 'dotenv/config';
import { logger as rootLogger } from '../src/logger.js';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
const logger = rootLogger.child({ component: 'align-database' });


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
  logger.info('Applied 002_align_legacy_schema.sql.');
} catch (error) {
  if (client) await client.query('ROLLBACK');
  logger.error({ err: error }, 'Database alignment failed');
  process.exitCode = 1;
} finally {
  if (client) {
    if (locked) await client.query('SELECT pg_advisory_unlock($1)', [721934201]);
    client.release();
  }
  await pool.end();
}
