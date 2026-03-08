import { db } from '../src/db/index.js';
import { reports } from '../src/db/schema.js';

async function listAllReports() {
    try {
        const allReports = await db.select().from(reports);
        console.log('REPORTS_IN_DB:', JSON.stringify(allReports, null, 2));
    } catch (err) {
        console.error('Error listing reports:', err);
    } finally {
        process.exit(0);
    }
}

listAllReports();
