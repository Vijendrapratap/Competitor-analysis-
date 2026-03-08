// =============================================================================
// Analysis Service — orchestrates all 5 analysis engines and saves to DB
// =============================================================================

import { createLogger } from '../utils/logger.js';
import { HealthScoreCalculator } from '../analysis/healthScore.js';
import { StrategyClassifier } from '../analysis/classifier.js';
import { PricingExtractor } from '../analysis/pricing.js';
import { AlertDetector } from '../analysis/alerts.js';
import { RecommendationEngine } from '../analysis/recommendations.js';
import type { CompetitorSnapshot, CompetitorHistory, TrendSnapshot } from '../analysis/alerts.js';
import type { CustomerData, MarketData } from '../analysis/recommendations.js';
import {
    getCompetitors,
    getCompetitorById,
    getCustomer,
    getCompetitorAds,
    getLatestPageMetrics,
    getRecentPosts,
    getLatestAnalysis,
    getRecentTrends,
    getShareOfVoice,
    insertAnalysis,
    insertAlert,
} from '../db/queries.js';
import { AlertSeverity } from '../types/index.js';
import type { Competitor, HealthScore, Ad, AdType, Analysis, TrendData } from '../types/index.js';

const log = createLogger('AnalysisService');

export interface AnalysisOptions {
    competitorIds?: number[];
    dryRun?: boolean;
    force?: boolean;
}

export interface AnalysisResult {
    competitorsAnalyzed: number;
    healthScoresCalculated: number;
    strategiesClassified: number;
    alertsGenerated: number;
    recommendationsGenerated: number;
    errors: string[];
}

export class AnalysisService {
    /**
     * Run all analysis engines for all (or filtered) competitors.
     */
    async run(opts: AnalysisOptions = {}): Promise<AnalysisResult> {
        const { competitorIds, dryRun = false } = opts;
        log.info('AnalysisService.run starting', { competitorIds, dryRun });

        const result: AnalysisResult = {
            competitorsAnalyzed: 0,
            healthScoresCalculated: 0,
            strategiesClassified: 0,
            alertsGenerated: 0,
            recommendationsGenerated: 0,
            errors: [],
        };

        // 1. Load target competitors
        let competitors: Competitor[];
        if (competitorIds && competitorIds.length > 0) {
            const results = await Promise.all(competitorIds.map((id) => getCompetitorById(id)));
            competitors = results.filter((c): c is Competitor => c !== null);
        } else {
            competitors = await getCompetitors();
        }

        if (competitors.length === 0) {
            log.warn('No competitors to analyze');
            return result;
        }

        // 2. Load data for all competitors
        log.info(`Loading data for ${competitors.length} competitors...`);
        const shareOfVoiceMap = new Map<number, number>();
        const sovEntries = await getShareOfVoice();
        for (const entry of sovEntries) {
            shareOfVoiceMap.set(entry.competitorId, entry.shareOfVoice);
        }

        const competitorData = await Promise.all(
            competitors.map(async (comp) => {
                const [ads, pageMetrics, posts, previousAnalysis] = await Promise.all([
                    getCompetitorAds(comp.id),
                    getLatestPageMetrics(comp.id),
                    getRecentPosts(comp.id),
                    getLatestAnalysis(comp.id),
                ]);
                return {
                    competitor: comp,
                    ads,
                    pageMetrics,
                    posts,
                    previousScore: null as HealthScore | null,
                    shareOfVoice: shareOfVoiceMap.get(comp.id) ?? 0,
                    previousAnalysis,
                    healthScore: null as HealthScore | null,
                };
            }),
        );

        // 3. Health Scores
        try {
            log.info('=== Stage: Health Scores ===');
            const calculator = new HealthScoreCalculator();
            const scores = calculator.calculateAll(
                competitorData.map((d) => ({
                    competitor: d.competitor,
                    ads: d.ads,
                    pageMetrics: d.pageMetrics,
                    posts: d.posts,
                    previousScore: d.previousScore,
                    shareOfVoice: d.shareOfVoice,
                })),
            );
            // Attach scores back for later use
            for (const score of scores) {
                const cd = competitorData.find((d) => d.competitor.id === score.competitorId);
                if (cd) {
                    cd.healthScore = score;
                }
            }
            result.healthScoresCalculated = scores.length;
            log.info(`  Calculated ${scores.length} health scores`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error('Health score calculation failed', { error: msg });
            result.errors.push(`HealthScore: ${msg}`);
        }

        // 4. Strategy Classification (Claude AI)
        try {
            log.info('=== Stage: Strategy Classification ===');
            const classifier = new StrategyClassifier();
            const strategies = await classifier.analyzeAll(
                competitorData.map((d) => ({
                    competitor: d.competitor,
                    ads: d.ads,
                    posts: d.posts,
                    pageMetrics: d.pageMetrics,
                    shareOfVoice: d.shareOfVoice,
                })),
            );
            result.strategiesClassified = strategies.size;
            log.info(`  Classified ${strategies.size} strategies`);

            // 5. Pricing Extraction
            log.info('=== Stage: Pricing Extraction ===');
            const pricingExtractor = new PricingExtractor();

            // 6. Save combined analysis to DB
            if (!dryRun) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                for (const cd of competitorData) {
                    const strategy = strategies.get(cd.competitor.id);
                    const healthScore = cd.healthScore;
                    const pricingAnalysis = await pricingExtractor.extractAll(cd.ads);

                    // Build adTypes as AdType[] (type, count, percentage)
                    const typeCounts = new Map<string, number>();
                    for (const ad of cd.ads) {
                        typeCounts.set(ad.creativeType, (typeCounts.get(ad.creativeType) ?? 0) + 1);
                    }
                    const adTypes: AdType[] = [...typeCounts.entries()].map(([type, count]) => ({
                        type: type as any,
                        count,
                        percentage: cd.ads.length > 0 ? Math.round((count / cd.ads.length) * 100) : 0,
                    }));

                    // Determine trend from previous analysis comparison
                    let trend: string = 'new';
                    if (cd.previousAnalysis && healthScore) {
                        const prevScore = cd.previousAnalysis.healthScore;
                        const diff = healthScore.totalScore - prevScore;
                        if (diff > 5) trend = 'rising';
                        else if (diff < -5) trend = 'declining';
                        else trend = 'stable';
                    }

                    await insertAnalysis({
                        competitorId: cd.competitor.id,
                        analysisDate: today,
                        totalActiveAds: cd.ads.filter((a) => a.isActive).length,
                        newestAdDate: cd.ads.length > 0 ? cd.ads[0]!.startedRunning : null,
                        adTypes,
                        targetSegments: strategy?.targetSegments ?? [],
                        pricingData: pricingAnalysis?.pricingData ?? null,
                        marketingStrategyEn: strategy?.marketingStrategyEn ?? null,
                        marketingStrategyTh: strategy?.marketingStrategyTh ?? null,
                        keyUspEn: strategy?.keyUspEn ?? null,
                        keyUspTh: strategy?.keyUspTh ?? null,
                        healthScore: healthScore ? String(healthScore.totalScore) : '0',
                        paidScore: healthScore ? String(healthScore.paidScore) : '0',
                        organicScore: healthScore ? String(healthScore.organicScore) : '0',
                        threatLevel: strategy?.threatLevel ?? 'low',
                        trend,
                        shareOfVoice: cd.shareOfVoice ? String(cd.shareOfVoice) : null,
                    });
                }
            }
            result.competitorsAnalyzed = competitorData.length;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error('Strategy classification / analysis failed', { error: msg });
            result.errors.push(`Classification: ${msg}`);
        }

        // 7. Alert Detection
        try {
            log.info('=== Stage: Alert Detection ===');
            const alertDetector = new AlertDetector();

            const currentSnapshots: CompetitorSnapshot[] = competitorData.map((d) => ({
                competitor: d.competitor,
                ads: d.ads,
                posts: d.posts,
                pageMetrics: d.pageMetrics,
            }));

            const historicalMap = new Map<number, CompetitorHistory>();
            for (const cd of competitorData) {
                historicalMap.set(cd.competitor.id, {
                    competitorId: cd.competitor.id,
                    previousAds: cd.ads,
                    previousPageMetrics: cd.pageMetrics,
                    previousAnalysis: cd.previousAnalysis,
                    avgEngagement: cd.pageMetrics?.avgEngagementRate ?? 0,
                });
            }

            const trendData = await getRecentTrends();
            const trendSnapshot: TrendSnapshot | undefined =
                trendData.length > 0 ? { trends: trendData } : undefined;

            const alerts = alertDetector.detectAlerts(currentSnapshots, historicalMap, trendSnapshot);

            if (!dryRun) {
                for (const alert of alerts) {
                    await insertAlert({
                        alertDate: alert.alertDate,
                        alertType: alert.alertType,
                        severity: alert.severity,
                        competitorId: alert.competitorId,
                        title: alert.title,
                        description: alert.description,
                        actionRequired: alert.actionRequired,
                        isSent: false,
                    });
                }
            }
            result.alertsGenerated = alerts.length;
            log.info(`  Generated ${alerts.length} alerts`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error('Alert detection failed', { error: msg });
            result.errors.push(`Alerts: ${msg}`);
        }

        // 8. Recommendations (AI-powered, only for customer)
        try {
            log.info('=== Stage: Recommendations ===');
            const customer = await getCustomer();
            if (customer) {
                const engine = new RecommendationEngine();
                const customerEntry = competitorData.find((d) => d.competitor.isCustomer);
                if (customerEntry) {
                    const customerAnalysis = await getLatestAnalysis(customer.id);

                    // Build CustomerData
                    const customerInput: CustomerData = {
                        competitor: customer,
                        analysis: customerAnalysis,
                        healthScore: customerEntry.healthScore,
                        pageMetrics: customerEntry.pageMetrics,
                    };

                    // Build MarketData
                    const allAnalyses: Array<{ competitor: Competitor; analysis: Analysis }> = [];
                    for (const d of competitorData) {
                        const latestAn = await getLatestAnalysis(d.competitor.id);
                        if (latestAn) {
                            allAnalyses.push({ competitor: d.competitor, analysis: latestAn });
                        }
                    }

                    const healthScores = competitorData
                        .map((d) => d.healthScore)
                        .filter((hs): hs is HealthScore => hs !== null);

                    const leader = healthScores.reduce<HealthScore | null>(
                        (best, hs) => (!best || hs.totalScore > best.totalScore ? hs : best),
                        null,
                    );

                    const totalAds = competitorData.reduce((sum, d) => sum + d.ads.length, 0);
                    const totalFollowers = competitorData.reduce(
                        (sum, d) => sum + (d.pageMetrics?.followers ?? 0),
                        0,
                    );
                    const totalEngagement = competitorData.reduce(
                        (sum, d) => sum + (d.pageMetrics?.avgEngagementRate ?? 0),
                        0,
                    );

                    const n = competitorData.length || 1;

                    const marketInput: MarketData = {
                        analyses: allAnalyses,
                        healthScores,
                        leader,
                        avgAdCount: Math.round(totalAds / n),
                        avgEngagementRate: totalEngagement / n,
                        avgFollowers: Math.round(totalFollowers / n),
                        avgHealthScore: healthScores.length > 0
                            ? healthScores.reduce((s, h) => s + h.totalScore, 0) / healthScores.length
                            : 0,
                        recentAlerts: [],
                        trends: await getRecentTrends(),
                        segmentSaturation: new Map(),
                    };

                    const recs = await engine.generateRecommendations(customerInput, marketInput);
                    result.recommendationsGenerated = recs.length;
                    log.info(`  Generated ${recs.length} recommendations`);
                }
            } else {
                log.info('  No customer competitor configured, skipping recommendations');
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error('Recommendation generation failed', { error: msg });
            result.errors.push(`Recommendations: ${msg}`);
        }

        log.info('AnalysisService.run complete', result);
        return result;
    }
}
