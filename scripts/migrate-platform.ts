import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { logger } from '../src/logger.js';
import { platformTables } from '../src/modules/platform/schema.js';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let client: pg.PoolClient | undefined;
let locked = false;
try {
  client = await pool.connect();
  await client.query("SET lock_timeout='5s'"); await client.query("SET statement_timeout='30s'");
  await client.query('SELECT pg_advisory_lock($1)', [721934201]); locked = true;
  const installed = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])", [platformTables]);
  if (installed.rowCount === platformTables.length) logger.info('Platform extension already installed; use db:verify to check drift');
  else {
    if (installed.rowCount) throw new Error('Partial platform schema');
    await client.query('SELECT users_id FROM users LIMIT 0');
    await client.query('SELECT business_profile_id FROM business_profiles LIMIT 0');
    await client.query(await readFile(new URL('../db/migrations/004_platform_foundation.sql', import.meta.url), 'utf8'));
    logger.info('Applied approved platform extension 004; enable it after configuration');
  }
} catch { if (client) await client.query('ROLLBACK'); logger.error('Platform migration failed; check foundation and partial-schema state'); process.exitCode = 1; }
finally { if (client) { if (locked) await client.query('SELECT pg_advisory_unlock($1)', [721934201]); client.release(); } await pool.end(); }
