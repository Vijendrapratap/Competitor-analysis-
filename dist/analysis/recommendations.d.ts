import type { Competitor, Recommendation, HealthScore, NewAlert, TrendData, Analysis, FacebookPageMetrics } from '../types/index.js';
/** The customer's own current state. */
export interface CustomerData {
    competitor: Competitor;
    analysis: Analysis | null;
    healthScore: HealthScore | null;
    pageMetrics: FacebookPageMetrics | null;
}
/** Aggregated market-wide benchmarks. */
export interface MarketData {
    /** All competitors' latest analyses (including customer). */
    analyses: Array<{
        competitor: Competitor;
        analysis: Analysis;
    }>;
    /** All health scores. */
    healthScores: HealthScore[];
    /** Market leader (highest total score). */
    leader: HealthScore | null;
    /** Market-wide averages. */
    avgAdCount: number;
    avgEngagementRate: number;
    avgFollowers: number;
    avgHealthScore: number;
    /** Recent alerts (all competitors). */
    recentAlerts: NewAlert[];
    /** Current Google Trends data. */
    trends: TrendData[];
    /** Which content categories are saturated vs. underserved. */
    segmentSaturation: Map<string, number>;
}
export declare class RecommendationEngine {
    private readonly client;
    private readonly model;
    private readonly maxTokens;
    private readonly maxRetries;
    constructor(apiKey?: string);
    generateRecommendations(customerData: CustomerData, marketData: MarketData): Promise<Recommendation[]>;
    private buildPrompt;
    private callClaudeWithRetry;
    private parseResponse;
    private generateFallbackRecommendations;
    private formatNumber;
}
//# sourceMappingURL=recommendations.d.ts.map