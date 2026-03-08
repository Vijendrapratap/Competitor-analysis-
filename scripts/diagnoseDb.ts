import { settings } from '../src/config/settings.js';
import { pool, testConnection } from '../src/db/index.js';

async function diagnose() {
    console.log('--- Database Settings Diagnostic ---');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('DB_HOST:', settings.db.host);
    console.log('DB_SSL (bool):', settings.db.ssl);
    console.log('DB_URL:', settings.db.url.replace(/:[^:@]+@/, ':****@')); // Mask password

    console.log('\nTesting connection...');
    try {
        await testConnection();
        console.log('SUCCESS: Connection verified.');
    } catch (err: any) {
        console.error('FAILED: Connection error:', err.message);
        if (err.stack) console.error(err.stack);
    } finally {
        await pool.end();
    }
}

diagnose();
