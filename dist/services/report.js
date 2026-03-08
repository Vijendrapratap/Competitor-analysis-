// =============================================================================
// Report Service — compiles data from DB and generates PDF report
// =============================================================================
import { createLogger } from '../utils/logger.js';
import { PDFReportGenerator, } from '../reports/pdfGenerator.js';
// @ts-ignore — competitorAggregator is an untyped JS module
import { aggregateCompetitorData, buildCompetitorComparison, } from '../intelligence/competitorAggregator.js';
import { getCompetitors, getCompetitorAds, getLatestPageMetrics, getRecentPosts, getLatestAnalysis, getRecentTrends, getTodayAlerts, getMarketOverview, insertReport, } from '../db/queries.js';
import { AlertSeverity } from '../types/index.js';
const log = createLogger('ReportService');
export class ReportService {
    async run(opts = {}) {
        const { dryRun = false } = opts;
        log.info('ReportService.run starting', { dryRun });
        // 1. Load all data needed for the report
        const competitors = await getCompetitors();
        const marketOverview = await getMarketOverview();
        const alerts = await getTodayAlerts();
        const trends = await getRecentTrends();
        // 2. Build per-competitor summaries matching CompetitorSummary interface
        const competitorSummaries = [];
        const healthRankings = [];
        for (const comp of competitors) {
            const [ads, pageMetrics, posts, analysis] = await Promise.all([
                getCompetitorAds(comp.id),
                getLatestPageMetrics(comp.id),
                getRecentPosts(comp.id),
                getLatestAnalysis(comp.id),
            ]);
            // Get competitor-specific alerts
            const compAlerts = alerts.filter((a) => a.competitorId === comp.id);
            // Select top 5 ads by recency
            const topAds = ads.slice(0, 5);
            // Select top 5 posts by engagement (reactions + comments + shares)
            const topPosts = [...posts]
                .sort((a, b) => (b.reactions + b.comments + b.shares) - (a.reactions + a.comments + a.shares))
                .slice(0, 5);
            competitorSummaries.push({
                competitor: comp,
                latestAnalysis: analysis,
                healthScore: null, // HealthScore is computed per-run, not stored directly
                topAds,
                topPosts,
                pageMetrics,
                recentAlerts: compAlerts,
            });
            if (analysis) {
                healthRankings.push({
                    rank: 0, // Will be set after sorting
                    competitorName: comp.name,
                    totalScore: analysis.healthScore,
                    paidScore: analysis.paidScore,
                    organicScore: analysis.organicScore,
                    trend: analysis.trend,
                });
            }
        }
        // Sort and assign ranks
        healthRankings.sort((a, b) => b.totalScore - a.totalScore);
        healthRankings.forEach((entry, idx) => {
            entry.rank = idx + 1;
        });
        // 3. Assemble report data
        const now = new Date();
        const periodEnd = new Date();
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - 30);
        const reportDate = now.toISOString().split('T')[0];
        const reportData = {
            reportDate,
            reportTitle: `Competitor Intelligence Report — ${reportDate}`,
            generatedAt: now,
            periodStart,
            periodEnd,
            marketOverview,
            competitors: competitorSummaries,
            healthScoreRankings: healthRankings,
            criticalAlerts: alerts.filter((a) => a.severity === AlertSeverity.Critical),
            recommendations: [],
            trends,
            charts: {},
        };
        // ── Aggregate Apify social media & ad intelligence (non‑blocking) ───
        try {
            const competitorInputs = competitors
                .filter((c) => c.facebookPageUrl)
                .map((c) => ({
                name: c.name,
                facebookPageUrl: c.facebookPageUrl,
            }));
            if (competitorInputs.length > 0) {
                log.info('Running Apify aggregation for social media intel', { count: competitorInputs.length });
                const aggregated = await aggregateCompetitorData(competitorInputs);
                const comparison = buildCompetitorComparison(aggregated);
                // Attach to reportData so pdfGenerator can render the new section
                reportData.socialMediaIntel = {
                    scrapedAt: new Date().toISOString(),
                    aggregated,
                    comparison,
                };
                log.info('Apify social media intel attached to report data');
            }
        }
        catch (err) {
            log.warn('Apify social media aggregation failed — report will omit that section', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
        if (dryRun) {
            log.info('Dry run — skipping PDF generation');
            return { pdfPath: null, reportDate };
        }
        // 4. Generate PDF
        const generator = new PDFReportGenerator();
        const pdfResult = await generator.generatePdf(reportData);
        // 5. Save report record
        const totalAds = competitorSummaries.reduce((sum, c) => sum + c.topAds.length, 0);
        const activeAdvertisersCount = competitorSummaries.filter(c => c.topAds.length > 0).length;
        await insertReport({
            reportDate: now,
            title: reportData.reportTitle,
            reportMonth: now.getMonth() + 1,
            reportYear: now.getFullYear(),
            competitorsCount: competitors.length,
            activeAdvertisers: activeAdvertisersCount,
            totalActiveAds: totalAds,
            htmlContent: pdfResult.htmlPath ?? '',
            metadata: {
                healthRankings: healthRankings.slice(0, 5),
                periodStart: reportData.periodStart,
                periodEnd: reportData.periodEnd,
                pdfPath: pdfResult.pdfPath,
                totalAlerts: alerts.length,
            },
        });
        log.info('ReportService.run complete', { pdfPath: pdfResult.pdfPath });
        return {
            pdfPath: pdfResult.pdfPath,
            htmlPath: pdfResult.htmlPath,
            reportDate,
        };
    }
}
//# sourceMappingURL=report.js.map