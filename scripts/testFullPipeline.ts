import 'dotenv/config';
import { ScrapeService } from '../src/services/scrape.js';
import { AnalysisService } from '../src/services/analysis.js';
import { ReportService } from '../src/services/report.js';
import { testConnection, closeConnection } from '../src/db/index.js';
import { createLogger } from '../src/utils/logger.js';

const log = createLogger('TestPipeline');

async function run() {
    try {
        log.info('--- STEP 1: Testing Database Connection ---');
        await testConnection();

        log.info('--- STEP 2: Running Dry-Run Scrape ---');
        // We limit to 1 competitor to make the test fast, or we rely on dryRun if supported.
        const scrapeSvc = new ScrapeService();
        await scrapeSvc.run({ dryRun: true });

        log.info('--- STEP 3: Running Dry-Run Analysis ---');
        const analyzeSvc = new AnalysisService();
        await analyzeSvc.run({ dryRun: true });

        log.info('--- STEP 4: Running Dry-Run Report Generation ---');
        const reportSvc = new ReportService();
        await reportSvc.run({ dryRun: true });

        log.info('--- SUCCESS: Full Pipeline Test Completed ---');
    } catch (err) {
        log.error('Pipeline test failed', { error: err instanceof Error ? err.message : String(err) });
        process.exitCode = 1;
    } finally {
        await closeConnection();
    }
}

run();
