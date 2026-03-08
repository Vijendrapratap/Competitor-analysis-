// =============================================================================
// Competitor Aggregator — merges Apify scraper data into a unified structure
// for AI analysis and report generation.
//
// Exports:
//   • aggregateCompetitorData(competitors) → unified per-competitor data
//   • prepareAnalysisPayload(aggregatedData) → condensed payload for Claude AI
//   • buildCompetitorComparison(aggregatedData) → comparison table structure
// =============================================================================
import { scrapeCompetitorFacebookPosts, filterRecentPosts } from '../scrapers/facebookPostsScraper.js';
import { scrapeCompetitorMetaAds, categorizeAdsByType } from '../scrapers/metaAdsScraper.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('CompetitorAggregator');
// ─────────────────────────────────────────────────────────────────────────────
// 1. aggregateCompetitorData
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Calls both Apify scrapers in parallel, merges results by competitor name,
 * and returns a unified structure per competitor.
 */
export async function aggregateCompetitorData(competitors) {
    const startTime = Date.now();
    log.info(`Aggregating data for ${competitors.length} competitor(s)…`);
    // ── Run both scrapers in parallel ───────────────────────────────────────
    const [postsResults, adsResults] = await Promise.all([
        scrapeCompetitorFacebookPosts(competitors).catch((err) => {
            log.error('Facebook posts scraper failed entirely', { error: err.message });
            return [];
        }),
        scrapeCompetitorMetaAds(competitors).catch((err) => {
            log.error('Meta Ads scraper failed entirely', { error: err.message });
            return [];
        }),
    ]);
    // ── Index results by competitor name ────────────────────────────────────
    const postsMap = new Map();
    for (const r of postsResults) {
        postsMap.set(r.competitorName, r);
    }
    const adsMap = new Map();
    for (const r of adsResults) {
        adsMap.set(r.competitorName, r);
    }
    // ── Merge into unified structure ────────────────────────────────────────
    const aggregated = competitors.map((competitor) => {
        const postsResult = postsMap.get(competitor.name);
        const adsResult = adsMap.get(competitor.name);
        const errors = [];
        if (postsResult?.error)
            errors.push(`Posts: ${postsResult.error}`);
        if (adsResult?.error)
            errors.push(`Ads: ${adsResult.error}`);
        const allPosts = postsResult?.posts ?? [];
        const allAds = adsResult?.ads ?? [];
        // Filter posts from last 7 days
        const recentPosts = filterRecentPosts(allPosts, 7);
        // Filter active ads only
        const activeAds = allAds.filter((ad) => ad.adStatus === 'active');
        // Categorize ads
        const adsByCategory = categorizeAdsByType(allAds);
        // Build summary
        const summary = buildSummary(allPosts, allAds, activeAds, recentPosts);
        return {
            competitorName: competitor.name,
            scrapedAt: new Date().toISOString(),
            summary,
            recentPosts,
            activeAds,
            adsByCategory,
            errors,
        };
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log.info(`Aggregation complete in ${elapsed}s for ${competitors.length} competitor(s)`);
    return aggregated;
}
/**
 * Build the summary block from scraped data.
 */
function buildSummary(allPosts, allAds, activeAds, recentPosts) {
    // Average engagement per post
    const avgEngagement = allPosts.length > 0
        ? allPosts.reduce((sum, p) => sum + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0) / allPosts.length
        : 0;
    // Top-performing post by total engagement (likes + comments + shares)
    const topPerformingPost = allPosts.length > 0
        ? allPosts.reduce((best, p) => {
            const eng = (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0);
            const bestEng = (best.likes ?? 0) + (best.comments ?? 0) + (best.shares ?? 0);
            return eng > bestEng ? p : best;
        }, allPosts[0])
        : null;
    // Most recent ad start date
    const adDates = allAds
        .map((ad) => ad.adStartDate)
        .filter(Boolean)
        .map((d) => new Date(d))
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());
    const mostRecentAdDate = adDates.length > 0 ? adDates[0]?.toISOString() ?? null : null;
    return {
        totalPostsFound: allPosts.length,
        totalAdsFound: allAds.length,
        activeAdsCount: activeAds.length,
        avgEngagementPerPost: Math.round(avgEngagement),
        topPerformingPost: topPerformingPost
            ? {
                text: truncateText(topPerformingPost.postText, 200),
                likes: topPerformingPost.likes ?? 0,
                comments: topPerformingPost.comments ?? 0,
                shares: topPerformingPost.shares ?? 0,
                postUrl: topPerformingPost.postUrl ?? '',
                postDate: topPerformingPost.postDate ?? null,
            }
            : null,
        mostRecentAdDate,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// 2. prepareAnalysisPayload
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Condenses the full aggregated dataset into a text/JSON payload optimized
 * for sending to Claude AI for analysis. Keeps under ~4000 tokens per competitor.
 */
export function prepareAnalysisPayload(aggregatedData) {
    const competitorPayloads = aggregatedData.map((comp) => {
        // ── Post themes ─────────────────────────────────────────────────────
        const postThemes = extractPostThemes(comp.recentPosts);
        // ── Ad copy samples (top 3 by engagement keywords) ──────────────────
        let rawSamples = [...comp.activeAds];
        const adCopySamples = rawSamples
            .slice(0, 3)
            .map((ad) => ({
            headline: truncateText(ad.adHeadline ?? '', 100),
            text: truncateText(ad.adText, 150),
            cta: ad.callToAction ?? 'None',
            platforms: ad.platforms?.join(', ') ?? 'Facebook',
        }));
        // ── Engagement highlights ───────────────────────────────────────────
        const engagementHighlights = {
            avgEngagement: comp.summary.avgEngagementPerPost,
            totalPosts: comp.summary.totalPostsFound,
            recentPostCount: comp.recentPosts.length,
            topPost: comp.summary.topPerformingPost
                ? `"${truncateText(comp.summary.topPerformingPost.text, 100)}" ` +
                    `(${comp.summary.topPerformingPost.likes} likes, ` +
                    `${comp.summary.topPerformingPost.comments} comments, ` +
                    `${comp.summary.topPerformingPost.shares} shares)`
                : 'No posts found',
        };
        // ── Ad activity ─────────────────────────────────────────────────────
        const adActivity = {
            totalAds: comp.summary.totalAdsFound,
            activeAds: comp.summary.activeAdsCount,
            categories: {
                promotional: comp.adsByCategory.promotional.length,
                branding: comp.adsByCategory.branding.length,
                directResponse: comp.adsByCategory.direct_response.length,
            },
            mostRecentAdDate: comp.summary.mostRecentAdDate,
        };
        return {
            competitorName: comp.competitorName,
            postThemes,
            adCopySamples,
            engagementHighlights,
            adActivity,
            errors: comp.errors,
        };
    });
    return {
        generatedAt: new Date().toISOString(),
        totalCompetitors: aggregatedData.length,
        competitors: competitorPayloads,
        analysisPromptHint: 'Analyze the following competitor intelligence data. ' +
            'Identify patterns in their social media posting themes, ad strategies, ' +
            'and engagement levels. Provide actionable recommendations for a boutique ' +
            'hotel in Hua Hin competing in this market.',
    };
}
/**
 * Extract common themes/topics from post texts.
 * Returns an array of theme strings with frequency.
 */
function extractPostThemes(posts) {
    if (!posts || posts.length === 0)
        return [];
    const themeKeywords = {
        'Promotions & Deals': /\b(?:promo|discount|offer|deal|sale|free|save|โปร|ลดราคา|ฟรี|ส่วนลด)\b/i,
        'Dining & F&B': /\b(?:restaurant|dining|food|chef|menu|buffet|breakfast|อาหาร|ร้านอาหาร|บุฟเฟ่ต์)\b/i,
        'Room & Accommodation': /\b(?:room|suite|villa|accommodation|pool\s*villa|ห้องพัก|วิลล่า)\b/i,
        'Wellness & Spa': /\b(?:spa|wellness|massage|yoga|retreat|สปา|นวด|โยคะ)\b/i,
        'Events & Weddings': /\b(?:wedding|event|conference|meeting|ceremony|งานแต่ง|ประชุม)\b/i,
        'Family & Kids': /\b(?:family|kids|children|playground|ครอบครัว|เด็ก)\b/i,
        'Seasonal & Holidays': /\b(?:christmas|new\s*year|songkran|valentine|holiday|คริสต์มาส|ปีใหม่|สงกรานต์)\b/i,
        'Beach & Nature': /\b(?:beach|sea|ocean|sunset|nature|pool|ทะเล|ชายหาด|พระอาทิตย์ตก|สระว่ายน้ำ)\b/i,
    };
    const themeCounts = {};
    for (const [theme, regex] of Object.entries(themeKeywords)) {
        const count = posts.filter((p) => regex.test(p.postText ?? '')).length;
        if (count > 0) {
            themeCounts[theme] = count;
        }
    }
    return Object.entries(themeCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([theme, count]) => ({ theme, postCount: count }));
}
// ─────────────────────────────────────────────────────────────────────────────
// 3. buildCompetitorComparison
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Builds a comparison table structure across all competitors.
 */
export function buildCompetitorComparison(aggregatedData) {
    const rows = aggregatedData.map((comp) => {
        // Posting frequency: posts per week (based on recent 7-day posts)
        const postsPerWeek = comp.recentPosts.length;
        // Top ad categories ranked by count
        const topAdCategories = Object.entries({
            Promotional: comp.adsByCategory.promotional.length,
            Branding: comp.adsByCategory.branding.length,
            'Direct Response': comp.adsByCategory.direct_response.length,
        })
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({ category: name, count }));
        // New campaigns: ads started within the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const newCampaigns = comp.activeAds.filter((ad) => {
            if (!ad.adStartDate)
                return false;
            const startDate = new Date(ad.adStartDate);
            return !isNaN(startDate.getTime()) && startDate >= sevenDaysAgo;
        });
        return {
            competitorName: comp.competitorName,
            postingFrequency: {
                postsLast7Days: postsPerWeek,
                label: categorizeFrequency(postsPerWeek),
            },
            engagement: {
                avgPerPost: comp.summary.avgEngagementPerPost,
                label: categorizeEngagement(comp.summary.avgEngagementPerPost),
            },
            adActivity: {
                totalAds: comp.summary.totalAdsFound,
                activeAds: comp.summary.activeAdsCount,
                inactiveAds: comp.summary.totalAdsFound - comp.summary.activeAdsCount,
                newCampaignsLast7Days: newCampaigns.length,
                hasNewCampaigns: newCampaigns.length > 0,
            },
            topAdCategories,
            errors: comp.errors,
        };
    });
    // ── Market-level aggregates ─────────────────────────────────────────────
    const totalPosts = aggregatedData.reduce((s, c) => s + c.summary.totalPostsFound, 0);
    const totalAds = aggregatedData.reduce((s, c) => s + c.summary.totalAdsFound, 0);
    const totalActive = aggregatedData.reduce((s, c) => s + c.summary.activeAdsCount, 0);
    const avgEngagement = rows.length > 0
        ? Math.round(rows.reduce((s, r) => s + r.engagement.avgPerPost, 0) / rows.length)
        : 0;
    return {
        generatedAt: new Date().toISOString(),
        totalCompetitors: aggregatedData.length,
        marketSummary: {
            totalPostsAcrossAll: totalPosts,
            totalAdsAcrossAll: totalAds,
            totalActiveAds: totalActive,
            marketAvgEngagement: avgEngagement,
        },
        competitors: rows,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────
/** Safely truncate a string to max length, adding "…" if truncated. */
function truncateText(text, maxLength = 150) {
    if (!text)
        return '';
    if (text.length <= maxLength)
        return text;
    return text.slice(0, maxLength - 1) + '…';
}
/** Label posting frequency as low/moderate/high. */
function categorizeFrequency(postsPerWeek) {
    if (postsPerWeek >= 7)
        return 'High (daily+)';
    if (postsPerWeek >= 3)
        return 'Moderate (3-6/week)';
    if (postsPerWeek >= 1)
        return 'Low (1-2/week)';
    return 'Inactive';
}
/** Label engagement level as low/moderate/high. */
function categorizeEngagement(avg) {
    if (avg >= 500)
        return 'High';
    if (avg >= 100)
        return 'Moderate';
    if (avg >= 10)
        return 'Low';
    return 'Very Low';
}
//# sourceMappingURL=competitorAggregator.js.map