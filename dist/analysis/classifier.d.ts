import type { Competitor, Ad, FacebookPost, FacebookPageMetrics, TargetSegment, ThreatLevel } from '../types/index.js';
/** Everything the classifier needs for one competitor. */
export interface CompetitorAnalysisInput {
    competitor: Competitor;
    ads: Ad[];
    posts: FacebookPost[];
    pageMetrics: FacebookPageMetrics | null;
    /** Share of voice (0–1), pre-computed. */
    shareOfVoice: number;
}
/** Structured output returned by the Claude analysis. */
export interface StrategyAnalysis {
    competitorId: number;
    competitorName: string;
    /** 2–3 sentence English narrative of the competitor's marketing strategy. */
    marketingStrategyEn: string;
    /** Thai translation of the strategy narrative. */
    marketingStrategyTh: string;
    /** One-sentence English USP. */
    keyUspEn: string;
    /** Thai translation of the USP. */
    keyUspTh: string;
    /** 3–5 target audience segments. */
    targetSegments: TargetSegment[];
    /** Pricing tier assessment. */
    pricingTier: 'budget' | 'mid' | 'premium' | 'ultra_premium';
    /** Threat level with reasoning. */
    threatLevel: ThreatLevel;
    threatReason: string;
    /** ISO timestamp. */
    analysedAt: Date;
}
export declare class StrategyClassifier {
    private readonly client;
    private readonly model;
    private readonly maxTokens;
    private readonly maxRetries;
    private readonly cache;
    constructor(apiKey?: string);
    analyzeAll(allData: CompetitorAnalysisInput[]): Promise<Map<number, StrategyAnalysis>>;
    analyzeCompetitor(data: CompetitorAnalysisInput): Promise<StrategyAnalysis>;
    private buildPrompt;
    private callClaudeWithRetry;
    private parseResponse;
    private validateSegments;
    private validatePricingTier;
    private validateThreatLevel;
    private buildFallback;
    /**
     * Compute a simple hash from the input data to detect changes.
     * We hash: ad count, newest ad date, follower count, post count.
     */
    private computeHash;
    private summariseAdTypes;
}
//# sourceMappingURL=classifier.d.ts.map