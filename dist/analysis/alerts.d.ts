import type { Competitor, Ad, FacebookPost, FacebookPageMetrics, NewAlert, TrendData, Analysis } from '../types/index.js';
/** Current data for one competitor (latest scrape). */
export interface CompetitorSnapshot {
    competitor: Competitor;
    ads: Ad[];
    posts: FacebookPost[];
    pageMetrics: FacebookPageMetrics | null;
}
/** Historical data for one competitor (from DB). */
export interface CompetitorHistory {
    competitorId: number;
    /** Ads from previous scrape. */
    previousAds: Ad[];
    /** Previous page metrics. */
    previousPageMetrics: FacebookPageMetrics | null;
    /** Previous analysis record. */
    previousAnalysis: Analysis | null;
    /** Average engagement across recent posts. */
    avgEngagement: number;
}
/** Categorised output. */
export interface CategorizedAlerts {
    critical: NewAlert[];
    high: NewAlert[];
    medium: NewAlert[];
    low: NewAlert[];
}
/** Google Trends snapshot for seasonal / trend alerts. */
export interface TrendSnapshot {
    trends: TrendData[];
}
export declare class AlertDetector {
    detectAlerts(currentData: CompetitorSnapshot[], historicalData: Map<number, CompetitorHistory>, trendSnapshot?: TrendSnapshot): NewAlert[];
    categorizeByPriority(alerts: NewAlert[]): CategorizedAlerts;
    private detectCompetitorAlerts;
    /**
     * CRITICAL: Price war — 3+ competitors offering 30%+ discounts.
     */
    private detectPriceWar;
    /**
     * HIGH: Seasonal push — 3+ competitors launched the same seasonal theme.
     */
    private detectSeasonalPush;
    /**
     * MEDIUM: Trend spike — keyword +50% MoM on Google Trends.
     */
    private detectTrendSpikes;
    private makeAlert;
    private daysSinceNewestAd;
    private formatNumber;
}
//# sourceMappingURL=alerts.d.ts.map