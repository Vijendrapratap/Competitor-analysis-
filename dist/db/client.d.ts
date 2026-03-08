import pg from 'pg';
declare const reportPool: import("pg").Pool;
/**
 * Execute a parameterized query against the report database pool.
 */
export declare const query: <T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) => Promise<import("pg").QueryResult<T>>;
/**
 * Acquire a client from the pool for transaction use.
 * Always call `client.release()` when done.
 */
export declare const getClient: () => Promise<pg.PoolClient>;
export default reportPool;
//# sourceMappingURL=client.d.ts.map