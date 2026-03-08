// =============================================================================
// Health Score Calculator
//
// Produces a 0–100 composite score for each competitor based on paid-media
// activity (ads) and organic-media activity (page & posts). Each dimension
// is individually scored with a clear explanation, then rolled up into
// paidScore, organicScore, and totalScore.
//
// The HealthScore interface (types/index.ts) exposes 4 paid + 4 organic
// component slots. The original 5+5 scoring dimensions from the requirements
// are mapped as follows:
//
//   Paid:
//     adVolume        ← adVolume (10 pts)
//     adFreshness     ← adFreshness (10 pts)
//     adCreativity    ← creativeScaling (10 pts) + strategyDiversity (10 pts)
//     adPlatformCov.  ← marketPosition / shareOfVoice (10 pts)
//
//   Organic:
//     audienceSize    ← followerSize (10 pts)
//     engagementRate  ← engagementRate (10 pts)
//     postFrequency   ← postingFrequency (10 pts)
//     contentDiversity← contentQuality (10 pts) + reputation (10 pts)
//
//   Paid raw total  = 50 pts → normalised to 0–100 as paidScore
//   Organic raw total = 50 pts → normalised to 0–100 as organicScore
//   totalScore = (paidScore × paidWeight + organicScore × organicWeight) / 100
// =============================================================================
import { createLogger } from '../utils/logger.js';
import { clamp, round } from '../utils/helpers.js';
import { settings } from '../config/settings.js';
import { Trend, } from '../types/index.js';
const log = createLogger('HealthScoreCalculator');
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const PAID_MAX = 50;
const ORGANIC_MAX = 50;
// ─────────────────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────────────────
export class HealthScoreCalculator {
    paidWeight;
    organicWeight;
    constructor() {
        this.paidWeight = settings.analysis.paidWeight;
        this.organicWeight = settings.analysis.organicWeight;
    }
    // ─── Calculate all competitors ──────────────────────────────────────────
    calculateAll(allData) {
        if (allData.length === 0)
            return [];
        // Build market context for relative calculations
        const ctx = {
            maxAdsCount: Math.max(1, ...allData.map((d) => d.ads.length)),
        };
        const scores = allData.map((data) => this.calculateScore(data, ctx));
        log.info(`Calculated health scores for ${scores.length} competitors ` +
            `(avg: ${round(scores.reduce((s, h) => s + h.totalScore, 0) / scores.length, 1)})`);
        return scores;
    }
    // ─── Get leaderboard (sorted descending) ────────────────────────────────
    getLeaderboard(scores) {
        return [...scores].sort((a, b) => b.totalScore - a.totalScore);
    }
    // ─── Calculate a single competitor ──────────────────────────────────────
    calculateScore(data, ctx) {
        const now = new Date();
        // ── PAID components ────────────────────────────────────────────────────
        const adVolume = this.scoreAdVolume(data.ads.length, ctx.maxAdsCount);
        const adFreshness = this.scoreAdFreshness(data.ads, now);
        const adCreativity = this.scoreAdCreativity(data.ads);
        const adPlatformCoverage = this.scoreMarketPosition(data.shareOfVoice);
        const paidRaw = adVolume.score + adFreshness.score + adCreativity.score + adPlatformCoverage.score;
        // ── ORGANIC components ─────────────────────────────────────────────────
        const audienceSize = this.scoreFollowerSize(data.pageMetrics?.followers ?? null);
        const engagementRate = this.scoreEngagementRate(data.pageMetrics?.avgEngagementRate ?? null);
        const postFrequency = this.scorePostingFrequency(data.posts, data.pageMetrics);
        const contentDiversity = this.scoreContentDiversity(data.posts, data.pageMetrics?.rating ?? null);
        const organicRaw = audienceSize.score +
            engagementRate.score +
            postFrequency.score +
            contentDiversity.score;
        // ── Normalise to 0–100 ─────────────────────────────────────────────────
        const paidScore = round((paidRaw / PAID_MAX) * 100, 1);
        const organicScore = round((organicRaw / ORGANIC_MAX) * 100, 1);
        const totalScore = round((paidScore * this.paidWeight + organicScore * this.organicWeight) / 100, 1);
        // ── Trend (compare to previous score) ──────────────────────────────────
        const trend = this.determineTrend(totalScore, data.previousScore);
        const result = {
            competitorId: data.competitor.id,
            competitorName: data.competitor.name,
            totalScore,
            paidScore,
            organicScore,
            components: {
                adVolume,
                adFreshness,
                adCreativity,
                adPlatformCoverage,
                postFrequency,
                engagementRate,
                contentDiversity,
                audienceSize,
            },
            calculatedAt: now,
        };
        log.debug(`  ${data.competitor.name}: total=${totalScore} (paid=${paidScore}, organic=${organicScore}) [${trend}]`);
        return result;
    }
    // ─────────────────────────────────────────────────────────────────────────
    //  PAID COMPONENTS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Ad Volume (10 pts max)
     * (myAds / maxCompetitorAds) * 10, capped at 10.
     */
    scoreAdVolume(adCount, maxAds) {
        const raw = maxAds > 0 ? (adCount / maxAds) * 10 : 0;
        const score = clamp(round(raw, 2), 0, 10);
        return {
            score,
            maxScore: 10,
            label: 'Ad Volume',
            explanation: adCount === 0
                ? 'No active ads detected'
                : `${adCount} active ad${adCount !== 1 ? 's' : ''} (${round((adCount / maxAds) * 100, 0)}% of market leader)`,
        };
    }
    /**
     * Ad Freshness (10 pts max)
     * Based on how recently the newest ad was started.
     *   < 7 days  → 10
     *   < 30 days → 7
     *   < 90 days → 4
     *   else      → 1
     *   no ads    → 0
     */
    scoreAdFreshness(ads, now) {
        if (ads.length === 0) {
            return {
                score: 0,
                maxScore: 10,
                label: 'Ad Freshness',
                explanation: 'No active ads to evaluate',
            };
        }
        // Find the most recent ad start date
        let newestDate = null;
        for (const ad of ads) {
            if (ad.startedRunning && (!newestDate || ad.startedRunning > newestDate)) {
                newestDate = ad.startedRunning;
            }
        }
        if (!newestDate) {
            return {
                score: 1,
                maxScore: 10,
                label: 'Ad Freshness',
                explanation: 'Active ads found but no start dates available',
            };
        }
        const daysSince = Math.floor((now.getTime() - newestDate.getTime()) / (1_000 * 60 * 60 * 24));
        let score;
        let tier;
        if (daysSince < 7) {
            score = 10;
            tier = 'very fresh (< 7 days)';
        }
        else if (daysSince < 30) {
            score = 7;
            tier = 'recent (< 30 days)';
        }
        else if (daysSince < 90) {
            score = 4;
            tier = 'ageing (< 90 days)';
        }
        else {
            score = 1;
            tier = 'stale (> 90 days)';
        }
        return {
            score,
            maxScore: 10,
            label: 'Ad Freshness',
            explanation: `Newest ad is ${daysSince} days old — ${tier}`,
        };
    }
    /**
     * Ad Creativity (20 pts max) — combines two scoring dimensions:
     *
     *   Creative Scaling (10 pts):
     *     max(adVariationsCount) * 2, capped at 10
     *
     *   Strategy Diversity (10 pts):
     *     uniqueAdTypes.length * 2.5, capped at 10
     */
    scoreAdCreativity(ads) {
        if (ads.length === 0) {
            return {
                score: 0,
                maxScore: 20,
                label: 'Ad Creativity',
                explanation: 'No active ads to evaluate creative diversity',
            };
        }
        // Creative Scaling: max variations count across all ads * 2
        const maxVariations = Math.max(1, ...ads.map((a) => a.adVariationsCount));
        const scalingScore = clamp(maxVariations * 2, 0, 10);
        // Strategy Diversity: number of unique creative types * 2.5
        const uniqueTypes = new Set(ads.map((a) => a.creativeType));
        const diversityScore = clamp(uniqueTypes.size * 2.5, 0, 10);
        const score = round(scalingScore + diversityScore, 2);
        return {
            score,
            maxScore: 20,
            label: 'Ad Creativity',
            explanation: `${uniqueTypes.size} creative type${uniqueTypes.size !== 1 ? 's' : ''} with up to ${maxVariations} variation${maxVariations !== 1 ? 's' : ''} ` +
                `(scaling: ${round(scalingScore, 1)}/10, diversity: ${round(diversityScore, 1)}/10)`,
        };
    }
    /**
     * Market Position / Platform Coverage (10 pts max)
     * shareOfVoice (0–1) * 10, capped at 10.
     */
    scoreMarketPosition(shareOfVoice) {
        const raw = shareOfVoice * 10;
        const score = clamp(round(raw, 2), 0, 10);
        return {
            score,
            maxScore: 10,
            label: 'Market Position',
            explanation: shareOfVoice === 0
                ? 'No share of voice data available'
                : `${round(shareOfVoice * 100, 1)}% share of voice in paid media`,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    //  ORGANIC COMPONENTS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Follower / Audience Size (10 pts max) — tier-based:
     *   100K+ → 10
     *    50K+ → 8
     *    20K+ → 6
     *    10K+ → 4
     *    else → 2
     *    null → 0
     */
    scoreFollowerSize(followers) {
        if (followers === null || followers === 0) {
            return {
                score: 0,
                maxScore: 10,
                label: 'Audience Size',
                explanation: 'No follower data available',
            };
        }
        let score;
        let tier;
        if (followers >= 100_000) {
            score = 10;
            tier = 'major (100K+)';
        }
        else if (followers >= 50_000) {
            score = 8;
            tier = 'large (50K+)';
        }
        else if (followers >= 20_000) {
            score = 6;
            tier = 'medium (20K+)';
        }
        else if (followers >= 10_000) {
            score = 4;
            tier = 'growing (10K+)';
        }
        else {
            score = 2;
            tier = 'small (< 10K)';
        }
        return {
            score,
            maxScore: 10,
            label: 'Audience Size',
            explanation: `${this.formatFollowers(followers)} followers — ${tier}`,
        };
    }
    /**
     * Engagement Rate (10 pts max)
     * rate * 2.5, capped at 10.
     * (A 4% engagement rate — excellent for hospitality — scores the maximum.)
     */
    scoreEngagementRate(rate) {
        if (rate === null) {
            return {
                score: 0,
                maxScore: 10,
                label: 'Engagement Rate',
                explanation: 'No engagement rate data available',
            };
        }
        const raw = rate * 2.5;
        const score = clamp(round(raw, 2), 0, 10);
        let tier;
        if (rate >= 3)
            tier = 'excellent';
        else if (rate >= 1.5)
            tier = 'good';
        else if (rate >= 0.5)
            tier = 'average';
        else
            tier = 'low';
        return {
            score,
            maxScore: 10,
            label: 'Engagement Rate',
            explanation: `${round(rate, 2)}% engagement rate — ${tier} for hospitality`,
        };
    }
    /**
     * Posting Frequency (10 pts max)
     * postsPerWeek * 1.5, capped at 10.
     *
     * We estimate postsPerWeek from the posts array or from
     * `pageMetrics.postsLast30d`.
     */
    scorePostingFrequency(posts, pageMetrics) {
        // Prefer postsLast30d from page metrics; fall back to posts array
        let postsLast30d;
        if (pageMetrics?.postsLast30d != null && pageMetrics.postsLast30d > 0) {
            postsLast30d = pageMetrics.postsLast30d;
        }
        else {
            // Count posts from the last 30 days
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            postsLast30d = posts.filter((p) => p.postedAt && p.postedAt >= cutoff).length;
        }
        if (postsLast30d === 0) {
            return {
                score: 0,
                maxScore: 10,
                label: 'Posting Frequency',
                explanation: 'No posts detected in the last 30 days',
            };
        }
        const postsPerWeek = round(postsLast30d / 4.3, 1); // 30 days ≈ 4.3 weeks
        const raw = postsPerWeek * 1.5;
        const score = clamp(round(raw, 2), 0, 10);
        return {
            score,
            maxScore: 10,
            label: 'Posting Frequency',
            explanation: `${postsLast30d} posts in 30 days (~${postsPerWeek}/week)`,
        };
    }
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
    scoreContentDiversity(posts, rating) {
        // Content Quality
        let qualityScore;
        let qualityExplanation;
        if (posts.length === 0) {
            qualityScore = 0;
            qualityExplanation = 'No posts to evaluate';
        }
        else {
            const topCount = posts.filter((p) => p.isTopPerformer).length;
            const ratio = topCount / posts.length;
            qualityScore = clamp(round(ratio * 10, 2), 0, 10);
            qualityExplanation = `${topCount}/${posts.length} posts are top performers (${round(ratio * 100, 0)}%)`;
        }
        // Reputation
        let reputationScore;
        let reputationExplanation;
        if (rating === null) {
            reputationScore = 0;
            reputationExplanation = 'No rating available';
        }
        else {
            reputationScore = clamp(round(rating * 2, 2), 0, 10);
            reputationExplanation = `${rating}/5 page rating`;
        }
        const score = round(qualityScore + reputationScore, 2);
        return {
            score,
            maxScore: 20,
            label: 'Content & Reputation',
            explanation: `${qualityExplanation}; ${reputationExplanation} ` +
                `(quality: ${round(qualityScore, 1)}/10, reputation: ${round(reputationScore, 1)}/10)`,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    //  TREND DETERMINATION
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Determine trend by comparing current total score to the previous score.
     *
     * - Rising:    current > previous + 3
     * - Declining: current < previous - 3
     * - Stable:    within ±3
     * - New:       no previous data
     */
    determineTrend(currentTotal, previous) {
        if (!previous)
            return Trend.New;
        const delta = currentTotal - previous.totalScore;
        if (delta > 3)
            return Trend.Rising;
        if (delta < -3)
            return Trend.Declining;
        return Trend.Stable;
    }
    // ─────────────────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────────────────
    formatFollowers(count) {
        if (count >= 1_000_000)
            return `${round(count / 1_000_000, 1)}M`;
        if (count >= 1_000)
            return `${round(count / 1_000, 1)}K`;
        return String(count);
    }
}
//# sourceMappingURL=healthScore.js.map