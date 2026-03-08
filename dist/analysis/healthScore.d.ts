import type { Competitor, Ad, FacebookPageMetrics, FacebookPost, HealthScore } from '../types/index.js';
export interface CompetitorData {
    competitor: Competitor;
    /** All active ads for this competitor. */
    ads: Ad[];
    /** Latest Facebook page metrics (may be null if scrape failed). */
    pageMetrics: FacebookPageMetrics | null;
    /** Recent posts (typically last 30 days). */
    posts: FacebookPost[];
    /** Previous health score for trend comparison (null on first run). */
    previousScore: HealthScore | null;
    /** Share of voice (0–1) — pre-computed externally. */
    shareOfVoice: number;
}
/** Context derived from all competitors' data, used for relative scoring. */
export interface MarketContext {
    /** Maximum number of active ads across all competitors. */
    maxAdsCount: number;
}
export declare class HealthScoreCalculator {
    private readonly paidWeight;
    private readonly organicWeight;
    constructor();
    calculateAll(allData: CompetitorData[]): HealthScore[];
    getLeaderboard(scores: HealthScore[]): HealthScore[];
    calculateScore(data: CompetitorData, ctx: MarketContext): HealthScore;
    /**
     * Ad Volume (10 pts max)
     * (myAds / maxCompetitorAds) * 10, capped at 10.
     */
    private scoreAdVolume;
    /**
     * Ad Freshness (10 pts max)
     * Based on how recently the newest ad was started.
     *   < 7 days  → 10
     *   < 30 days → 7
     *   < 90 days → 4
     *   else      → 1
     *   no ads    → 0
     */
    private scoreAdFreshness;
    /**
     * Ad Creativity (20 pts max) — combines two scoring dimensions:
     *
     *   Creative Scaling (10 pts):
     *     max(adVariationsCount) * 2, capped at 10
     *
     *   Strategy Diversity (10 pts):
     *     uniqueAdTypes.length * 2.5, capped at 10
     */
    private scoreAdCreativity;
    /**
     * Market Position / Platform Coverage (10 pts max)
     * shareOfVoice (0–1) * 10, capped at 10.
     */
    private scoreMarketPosition;
    /**
     * Follower / Audience Size (10 pts max) — tier-based:
     *   100K+ → 10
     *    50K+ → 8
     *    20K+ → 6
     *    10K+ → 4
     *    else → 2
     *    null → 0
     */
    private scoreFollowerSize;
    /**
     * Engagement Rate (10 pts max)
     * rate * 2.5, capped at 10.
     * (A 4% engagement rate — excellent for hospitality — scores the maximum.)
     */
    private scoreEngagementRate;
    /**
     * Posting Frequency (10 pts max)
     * postsPerWeek * 1.5, capped at 10.
     *
     * We estimate postsPerWeek from the posts array or from
     * `pageMetrics.postsLast30d`.
     */
    private scorePostingFrequency;
    /**
     * Content Diversity (20 pts max) — combines two scoring dimensions:
     *
     *   Content Quality (10 pts):
     *     topPerformerRatio * 10
     *     (A ratio of 1.0 = every post is a top performer — unlikely but perfect.)
     *
     *   Reputation (10 pts):
     *     rating * 2 (rating is 0–5, so max is 10)
     */
    private scoreContentDiversity;
    /**
     * Determine trend by comparing current total score to the previous score.
     *
     * - Rising:    current > previous + 3
     * - Declining: current < previous - 3
     * - Stable:    within ±3
     * - New:       no previous data
     */
    private determineTrend;
    private formatFollowers;
}
//# sourceMappingURL=healthScore.d.ts.map