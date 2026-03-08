import { testConnection } from '../src/db/index.js';

async function run() {
    try {
        console.log('Testing DB connection...');
        await testConnection();
        console.log('DB connection successful!');
    } catch (err) {
        console.error('DB connection failed:', err);
        process.exit(1);
    }
}

run();
