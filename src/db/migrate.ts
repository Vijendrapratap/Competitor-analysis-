// =============================================================================
// Migration Runner — executes .sql files in src/db/migrations/ in order
// =============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import reportPool from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations(): Promise<void> {
    console.log('🔄 Running database migrations...');

    const dir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    if (files.length === 0) {
        console.log('  No migration files found.');
        await reportPool.end();
        return;
    }

    for (const file of files) {
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        console.log(`  Applying: ${file}`);
        try {
            await reportPool.query(sql);
            console.log(`  ✅ Done: ${file}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`  ❌ Failed: ${file} — ${message}`);
            throw err;
        }
    }

    console.log('✅ All migrations complete');
    await reportPool.end();
}

runMigrations().catch(err => {
    console.error('❌ Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
