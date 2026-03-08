// =============================================================================
// CLI: Generate a competitor intelligence report
// Usage: npm run generate -- "UPMY Skills"
// =============================================================================

import dotenv from 'dotenv';
dotenv.config();

/**
 * Stub entrypoint for the report generation CLI.
 * 
 * TODO: Once reportBuilder.ts is ported to TypeScript,
 *       import { buildReport } from '../src/generators/reportBuilder.js'
 *       and call it here.
 *
 * For now, this validates the environment and prints the expected interface.
 */
async function main(): Promise<void> {
    const clientName = process.argv[2] ?? 'UPMY Skills';
    console.log(`🚀 Generating report for: "${clientName}"\n`);

    // Validate required env vars
    const required = ['DATABASE_URL', 'OPENROUTER_API_KEY', 'APIFY_API_TOKEN'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length) {
        console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
        console.error('   Copy .env.example to .env and fill in real values.');
        process.exit(1);
    }

    // ── Placeholder until reportBuilder.ts is ready ──
    console.log('⚠️  Report builder not yet connected.');
    console.log('   This script will work once reportBuilder.ts is ported to TypeScript.');
    console.log('');
    console.log('   Expected flow:');
    console.log('   1. Scrape competitors via Apify');
    console.log('   2. Aggregate data');
    console.log('   3. Run LLM analysis via OpenRouter');
    console.log('   4. Generate HTML from templates');
    console.log('   5. Save to PostgreSQL');
    console.log('   6. Return UUID for PDF access');
    console.log('');

    const base = `http://localhost:${process.env['PORT'] ?? 3000}`;
    console.log('🔗 Once generated, access URLs:');
    console.log(`   List all:    ${base}/api/reports`);
    console.log(`   Metadata:    ${base}/api/reports/{uuid}`);
    console.log(`   View PDF:    ${base}/api/reports/{uuid}/view`);
    console.log(`   Download:    ${base}/api/reports/{uuid}/pdf`);
}

main().catch(err => {
    console.error('❌ Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
