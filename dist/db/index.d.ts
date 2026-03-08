import * as schema from './schema.js';
export declare const pool: import("pg").Pool;
export declare const db: import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema> & {
    $client: import("pg").Pool;
};
/**
 * Verify that the database is reachable and credentials are valid.
 * Logs success or throws on failure.
 */
export declare function testConnection(): Promise<void>;
/**
 * Gracefully drain and close the connection pool.
 * Call this during shutdown / after pipeline runs.
 */
export declare function closeConnection(): Promise<void>;
export { schema };
//# sourceMappingURL=index.d.ts.map