import { db } from '../src/db/index.js';
import { pipelineRuns } from '../src/db/schema.js';
import { log } from '../src/utils/logger.js';

async function test() {
    try {
        console.log('Testing pipeline_runs table...');
        const result = await db.select().from(pipelineRuns).limit(1);
        console.log('Success! Table exists and is accessible.');
        process.exit(0);
    } catch (err) {
        console.error('Failure! Could not access pipeline_runs table:', err);
        process.exit(1);
    }
}

test();
