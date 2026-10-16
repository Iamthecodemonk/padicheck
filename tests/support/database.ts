import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { QueryResult, QueryResultRow } from 'pg';
import type { Database, SqlExecutor } from '../../src/database/index.js';

export async function testDatabase() {
  const postgres = new PGlite();
  await postgres.exec(await readFile(new URL('../../db/migrations/001_baseline.sql', import.meta.url), 'utf8'));
  const executor: SqlExecutor = {
    async query<T extends QueryResultRow>(sql: string, values?: unknown[]): Promise<QueryResult<T>> {
      const result = await postgres.query<T>(sql, values);
      return { rows: result.rows, rowCount: result.affectedRows || result.rows.length, command: '', oid: 0, fields: [] };
    },
  };
  const db: Database = {
    ...executor,
    session: work => work(executor),
    transaction: work => postgres.transaction(tx => work({
      async query<T extends QueryResultRow>(sql: string, values?: unknown[]): Promise<QueryResult<T>> {
        const result = await tx.query<T>(sql, values);
        return { rows: result.rows, rowCount: result.affectedRows || result.rows.length, command: '', oid: 0, fields: [] };
      },
    })),
    close: () => postgres.close(),
  };
  return { db, postgres };
}
