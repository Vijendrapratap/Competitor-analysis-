// =============================================================================
// Database Client — raw pg Pool for report tables
//
// This provides a direct pg connection pool separate from the Drizzle ORM
// instance used by the existing pipeline. Report-related queries use raw SQL
// for maximum control over the complex report schema.
// =============================================================================
import pg from 'pg';
import dotenv from 'dotenv';
import { createLogger } from '../utils/logger.js';
dotenv.config();
const log = createLogger('db:client');
const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
}
const reportPool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env['NODE_ENV'] === 'production'
        ? { rejectUnauthorized: false }
        : false,
});
reportPool.on('error', (err) => {
    log.error('Unexpected report pool error', { error: err.message });
});
/**
 * Execute a parameterized query against the report database pool.
 */
export const query = (text, params) => reportPool.query(text, params);
/**
 * Acquire a client from the pool for transaction use.
 * Always call `client.release()` when done.
 */
export const getClient = () => reportPool.connect();
export default reportPool;
//# sourceMappingURL=client.js.map