#!/usr/bin/env node
// =============================================================================
// Test Apify Scraper — end-to-end integration test for the aggregation pipeline
//
// Usage:  node scripts/testApifyScraper.js
//    or:  npm run test:scraper
//
// Requires a valid APIFY_API_TOKEN in .env (or env vars).
// =============================================================================

import 'dotenv/config';

import { validateApifyConfig } from '../src/config/apifyConfig.js';
import { aggregateCompetitorData } from '../src/intelligence/competitorAggregator.js';
import { buildCompetitorComparison } from '../src/intelligence/competitorAggregator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test competitors — Hua Hin resorts
// ─────────────────────────────────────────────────────────────────────────────

const testCompetitors = [
    {
        name: 'Test Resort A',
        facebookPageUrl: 'https://www.facebook.com/centarahotelsresorts',
    },
    {
        name: 'Test Resort B',
        facebookPageUrl: 'https://www.facebook.com/hiltonhuahin',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║        Apify Scraper Integration Test                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log();

    // ── 1. Validate config ──────────────────────────────────────────────
    try {
        validateApifyConfig();
        console.log('✓ Apify config validated\n');
    } catch (err) {
        console.error('✗ ' + err.message);
        console.error('\n  Set APIFY_API_TOKEN in your .env file and try again.\n');
        process.exit(1);
    }

    // ── 2. Run aggregation ──────────────────────────────────────────────
    console.log(`Scraping ${testCompetitors.length} test competitor(s)…`);
    console.log('  • ' + testCompetitors.map((c) => c.name).join('\n  • '));
    console.log();

    const startTime = Date.now();
    const results = await aggregateCompetitorData(testCompetitors);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

    // ── 3. Print summary per competitor ─────────────────────────────────
    console.log('\n─── Per-Competitor Summary ───────────────────────────────');
    for (const comp of results) {
        console.log(`\n  📊 ${comp.competitorName}`);
        console.log(`     Posts found:    ${comp.summary.totalPostsFound}`);
        console.log(`     Ads found:      ${comp.summary.totalAdsFound}`);
        console.log(`     Active ads:     ${comp.summary.activeAdsCount}`);
        console.log(`     Avg engagement: ${comp.summary.avgEngagementPerPost}`);
        console.log(`     Recent posts:   ${comp.recentPosts.length} (last 7 days)`);
        console.log(`     Ad categories:  promotional=${comp.adsByCategory.promotional.length}, ` +
            `branding=${comp.adsByCategory.branding.length}, ` +
            `direct_response=${comp.adsByCategory.direct_response.length}`);

        if (comp.errors.length > 0) {
            console.log(`     ⚠ Errors: ${comp.errors.join('; ')}`);
        }
    }

    // ── 4. Print comparison table ───────────────────────────────────────
    const comparison = buildCompetitorComparison(results);

    console.log('\n─── Competitor Comparison ────────────────────────────────');
    console.log(`  Market totals: ${comparison.marketSummary.totalPostsAcrossAll} posts | ` +
        `${comparison.marketSummary.totalAdsAcrossAll} ads | ` +
        `${comparison.marketSummary.totalActiveAds} active`);
    console.log(`  Market avg engagement: ${comparison.marketSummary.marketAvgEngagement}`);

    for (const row of comparison.competitors) {
        console.log(`\n  ${row.competitorName}:`);
        console.log(`    Posting: ${row.postingFrequency.label} (${row.postingFrequency.postsLast7Days}/week)`);
        console.log(`    Engagement: ${row.engagement.label} (avg ${row.engagement.avgPerPost})`);
        console.log(`    Ads: ${row.adActivity.activeAds} active / ${row.adActivity.totalAds} total`);
        if (row.adActivity.hasNewCampaigns) {
            console.log(`    🔥 New campaigns in last 7 days: ${row.adActivity.newCampaignsLast7Days}`);
        }
    }

    // ── 5. Pretty-print first result ────────────────────────────────────
    console.log('\n─── First Result (full JSON) ─────────────────────────────');
    console.log(JSON.stringify(results[0], null, 2));

    // ── 6. Done ─────────────────────────────────────────────────────────
    console.log(`\n✓ Test completed in ${elapsedSec}s`);
}

main().catch((err) => {
    console.error('\n✗ Test failed with error:', err.message ?? err);
    process.exit(1);
});
