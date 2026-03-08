// =============================================================================
// Database — connection pool + Drizzle ORM instance
// =============================================================================
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { settings } from '../config/settings.js';
import { createLogger } from '../utils/logger.js';
import * as schema from './schema.js';
const log = createLogger('db');
// ─────────────────────────────────────────────────────────────────────────────
// Connection pool
// ─────────────────────────────────────────────────────────────────────────────
export const pool = new pg.Pool({
    connectionString: settings.db.url,
    max: settings.db.poolMax,
    ssl: settings.db.ssl ? { rejectUnauthorized: false } : false,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});
// Surface pool-level errors (prevents unhandled rejections)
pool.on('error', (err) => {
    log.error('Unexpected pool error on idle client', {
        error: err.message,
        stack: err.stack,
    });
});
pool.on('connect', () => {
    log.debug('New pool client connected');
});
// ─────────────────────────────────────────────────────────────────────────────
// Drizzle instance (with full schema for relational queries)
// ─────────────────────────────────────────────────────────────────────────────
export const db = drizzle(pool, { schema, logger: settings.isDev });
// ─────────────────────────────────────────────────────────────────────────────
// Connection helpers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Verify that the database is reachable and credentials are valid.
 * Logs success or throws on failure.
 */
export async function testConnection() {
    let client;
    try {
        client = await pool.connect();
        const { rows } = await client.query('SELECT NOW() AS now');
        const serverTime = rows[0]?.now;
        log.info(`Database connected — server time: ${String(serverTime)}`);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`Database connection failed: ${message}`);
        throw new Error(`Cannot connect to PostgreSQL: ${message}`);
    }
    finally {
        client?.release();
    }
}
/**
 * Gracefully drain and close the connection pool.
 * Call this during shutdown / after pipeline runs.
 */
export async function closeConnection() {
    try {
        await pool.end();
        log.info('Database pool closed');
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`Error closing database pool: ${message}`);
    }
}
// Re-export schema for convenience
export { schema };
//# sourceMappingURL=index.js.map