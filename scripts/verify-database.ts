import 'dotenv/config';
import { logger as rootLogger } from '../src/logger.js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
const logger = rootLogger.child({ component: 'verify-database' });


if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const expected = new PGlite();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const sql = await readFile(new URL('../db/migrations/001_baseline.sql', import.meta.url), 'utf8');
import { billingTables } from '../src/modules/billing/service.js';
const inspections = [
  `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
   FROM information_schema.columns WHERE table_schema = 'public'
   ORDER BY table_name, ordinal_position`,
  `SELECT c.relname AS table_name, con.conname, con.contype,
   pg_get_constraintdef(con.oid) AS definition
   FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
   JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'
   ORDER BY c.relname, con.conname`,
  `SELECT tablename, indexname, indexdef FROM pg_indexes
   WHERE schemaname = 'public' ORDER BY tablename, indexname`,
  `SELECT c.relname AS table_name, t.tgname, pg_get_triggerdef(t.oid) AS definition
   FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT t.tgisinternal ORDER BY c.relname, t.tgname`,
];
let client: pg.PoolClient | undefined;
const differences: Record<string, unknown[]> = {};
try {
  await expected.exec(sql);
  client = await pool.connect();
  await client.query('BEGIN READ ONLY');
  const billing=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])",[billingTables]);
  if(billing.rowCount||process.argv.includes('--billing'))await expected.exec(await readFile(new URL('../db/migrations/003_billing.sql',import.meta.url),'utf8'));
  for (const [index, inspection] of inspections.entries()) {
    const supplied = await expected.query<Record<string, unknown>>(inspection);
    const actual = await client.query(inspection);
    const category = ['columns', 'constraints', 'indexes', 'triggers'][index]!;
    const key = (row: Record<string, unknown>) => JSON.stringify([
      row.table_name ?? row.tablename, row.column_name ?? row.conname ?? row.indexname ?? row.tgname,
    ]);
    const expectedMap = new Map(supplied.rows.map(row => [key(row), row]));
    const actualMap = new Map(actual.rows.map(row => [key(row), row]));
    const diffs: unknown[] = [];
    for (const [id, row] of expectedMap) {
      if (!actualMap.has(id)) diffs.push({ kind: 'missing', expected: row });
      else if (!isDeepStrictEqual(row, actualMap.get(id))) diffs.push({ kind: 'changed', expected: row, actual: actualMap.get(id) });
    }
    for (const [id, row] of actualMap) {
      if (!expectedMap.has(id)) diffs.push({ kind: 'extra', actual: row });
    }
    if (diffs.length) differences[category] = diffs;
  }
  await client.query('COMMIT');
  if (Object.keys(differences).length) {
    await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
    await writeFile(new URL('../docs/database-drift.json', import.meta.url), JSON.stringify(differences, null, 2) + '\n');
    logger.info('Schema drift found. Details written to docs/database-drift.json. No database writes performed.');
    process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(differences).map(([key, value]) => [key, value.length]))) + '\n');
    process.exitCode = 1;
  } else {
    await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
    await writeFile(new URL('../docs/database-drift.json', import.meta.url), '{}\n');
    logger.info({billing_schema:Boolean(billing.rowCount)},'Existing database matches the supplied baseline and any approved installed billing extension. No database writes performed.');
  }
} finally {
  if (client) { await client.query('ROLLBACK'); client.release(); }
  await pool.end();
  await expected.close();
}
