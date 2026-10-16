import pg, { type QueryResultRow, type QueryResult } from 'pg';

export interface SqlExecutor {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<QueryResult<T>>;
}

export interface Database extends SqlExecutor {
  session<T>(work: (client: SqlExecutor) => Promise<T>): Promise<T>;
  transaction<T>(work: (client: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function createDatabase(connectionString: string): Database {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
  });
  // Idle connection failures should not terminate the API; readiness checks
  // and request queries report availability. Never log connection strings.
  pool.on('error', () => console.error('An idle PostgreSQL connection failed'));
  return {
    query: (sql, values) => pool.query(sql, values),
    async session(work) {
      const client = await pool.connect();
      try { return await work(client); } finally { client.release(); }
    },
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const value = await work(client);
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
