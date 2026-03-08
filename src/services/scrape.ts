// =============================================================================
// Scrape Service — orchestrates all scrapers and persists results to DB
//
// Migration (2026-03):
//   • Meta Ads    → Apify (`metaAdsScraper.js`)
//   • FB Posts    → Apify (`facebookPostsScraper.ts`)
//   • FB Page     → Playwright (kept — no Apify equivalent for page metrics)
//   • Google Trends → unchanged
// =============================================================================

import { createLogger } from '../utils/logger.js';
import { FacebookPageScraper } from '../scrapers/facebookPage.js';
import { GoogleTrendsFetcher } from '../scrapers/googleTrends.js';

// Apify-based scrapers
import { scrapeCompetitorMetaAds } from '../scrapers/metaAdsScraper.js';
import {
    scrapeCompetitorFacebookPosts,
    type CompetitorScrapeResult as FBPostsResult,
    type NormalizedPost,
} from '../scrapers/facebookPostsScraper.js';

import {
    getCompetitors,
    getCompetitorById,
    insertAds,
    insertPageMetrics,
    insertPost,
    insertTrend,
    insertFollowerHistory,
    markAdsInactive,
} from '../db/queries.js';
import {
    CreativeType,
    CtaType,
    Platform,
    PostType,
    ContentCategory,
} from '../types/index.js';
import type { Competitor, NewAd, NewFacebookPost } from '../types/index.js';

const log = createLogger('ScrapeService');

export interface ScrapeOptions {
    competitorIds?: number[];
    dryRun?: boolean;
    force?: boolean;
}

export interface ScrapeResult {
    totalCompetitors: number;
    adsScraped: number;
    pagesScraped: number;
    postsScraped: number;
    trendsScraped: number;
    errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Compatibility mappers — bridge Apify output → DB-ready types
// ─────────────────────────────────────────────────────────────────────────────

/** Map a raw Apify ad result to the `NewAd` shape expected by the DB. */
function mapApifyAdToNewAd(
    raw: Record<string, unknown>,
    competitor: Competitor,
): NewAd {
    return {
        competitorId: competitor.id,
        metaAdId: String(raw['adId'] ?? `apify_${competitor.facebookPageId}_${Date.now()}`),
        startedRunning: raw['adStartDate'] ? new Date(String(raw['adStartDate'])) : null,
        isActive: raw['adStatus'] === 'active',
        platforms: mapPlatforms(raw['platforms'] as string[] | undefined),
        creativeType: mapCreativeType(raw['mediaType'] as string | undefined),
        adCopy: (raw['adText'] as string) || null,
        headline: (raw['adHeadline'] as string) || null,
        ctaType: mapCtaType(raw['callToAction'] as string | undefined),
        landingUrl: null, // Apify Ads Library actor doesn't provide landing URLs
        adVariationsCount: 1,
        extractedPrice: null,
        extractedDiscount: null,
        language: null,
        screenshotPath: null,
        scrapedAt: new Date(),
    };
}

/** Map a normalized Apify post to the `NewFacebookPost` shape expected by the DB. */
function mapApifyPostToNewPost(
    post: NormalizedPost,
    competitor: Competitor,
): NewFacebookPost {
    return {
        competitorId: competitor.id,
        // Strip trailing slash before splitting to handle reel URLs ending in "/"
        // e.g. https://www.facebook.com/reel/1627935738428723/ → "1627935738428723"
        postId: (post.postUrl ?? '').replace(/\/$/, '').split('/').pop() || `apify_${competitor.id}_${Date.now()}`,
        postUrl: post.postUrl ?? '',
        postType: mapPostType(post.postType),
        postText: post.postText || null,
        postedAt: post.postDate ? new Date(post.postDate) : null,
        reactions: post.likes ?? 0,
        comments: post.comments ?? 0,
        shares: post.shares ?? 0,
        videoViews: null,
        contentCategory: ContentCategory.Unknown,
        language: null,
        isTopPerformer: false,
        scrapedAt: new Date(),
    };
}

// ── Enum mappers ────────────────────────────────────────────────────────────

function mapPlatforms(raw: string[] | undefined): Platform[] {
    if (!raw || raw.length === 0) return [Platform.Facebook];
    return raw.map((p) => {
        const lower = p.toLowerCase();
        if (lower.includes('instagram')) return Platform.Instagram;
        if (lower.includes('messenger')) return Platform.MessengerInbox;
        if (lower.includes('audience')) return Platform.AudienceNetwork;
        return Platform.Facebook;
    });
}

function mapCreativeType(raw: string | undefined): CreativeType {
    if (!raw) return CreativeType.Unknown;
    const lower = raw.toLowerCase();
    if (lower.includes('video')) return CreativeType.Video;
    if (lower.includes('carousel')) return CreativeType.Carousel;
    if (lower.includes('image')) return CreativeType.Image;
    return CreativeType.Unknown;
}

function mapCtaType(raw: string | undefined): CtaType {
    if (!raw) return CtaType.NoButton;
    const lower = raw.toLowerCase();
    if (lower.includes('book')) return CtaType.BookNow;
    if (lower.includes('learn')) return CtaType.LearnMore;
    if (lower.includes('offer')) return CtaType.GetOffer;
    if (lower.includes('shop')) return CtaType.ShopNow;
    if (lower.includes('contact')) return CtaType.ContactUs;
    if (lower.includes('sign')) return CtaType.SignUp;
    if (lower.includes('subscribe')) return CtaType.Subscribe;
    if (lower.includes('watch')) return CtaType.WatchMore;
    if (lower.includes('message')) return CtaType.MessagePage;
    return CtaType.Unknown;
}

function mapPostType(raw: string | undefined): PostType {
    if (!raw) return PostType.Unknown;
    const lower = raw.toLowerCase();
    if (lower === 'video') return PostType.Video;
    if (lower === 'photo') return PostType.Photo;
    if (lower === 'link') return PostType.Link;
    if (lower === 'text') return PostType.Text;
    return PostType.Unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Partial page metrics extraction from Apify posts response
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract partial Facebook page-level metrics from the Apify posts response.
 * The posts actor sometimes returns page metadata alongside post data.
 * This supplements the Playwright-based page scraper (which remains primary).
 */
function extractPartialPageMetrics(
    postsResult: FBPostsResult,
    competitor: Competitor,
) {
    if (!postsResult.posts || postsResult.posts.length === 0) return null;

    const posts = postsResult.posts;

    // Calculate engagement averages from the posts data
    const totalReactions = posts.reduce((sum, p) => sum + (p.likes ?? 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.comments ?? 0), 0);
    const totalShares = posts.reduce((sum, p) => sum + (p.shares ?? 0), 0);
    const avgEngagement = posts.length > 0
        ? (totalReactions + totalComments + totalShares) / posts.length
        : 0;

    // Find the most recent post date
    const postDates = posts
        .map((p) => p.postDate ? new Date(p.postDate) : null)
        .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
    const lastPostDate = postDates.length > 0
        ? new Date(Math.max(...postDates.map((d) => d.getTime())))
        : null;

    return {
        competitorId: competitor.id,
        postsLast30d: posts.length,
        avgEngagement,
        lastPostDate,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main service
// ─────────────────────────────────────────────────────────────────────────────

export class ScrapeService {
    /**
     * Run all scrapers for all (or filtered) competitors, persist results.
     */
    async run(opts: ScrapeOptions = {}): Promise<ScrapeResult> {
        const { competitorIds, dryRun = false, force = false } = opts;
        log.info('ScrapeService.run starting', { competitorIds, dryRun, force });

        // 1. Resolve target competitors
        let competitors: Competitor[];
        if (competitorIds && competitorIds.length > 0) {
            const results = await Promise.all(competitorIds.map((id) => getCompetitorById(id)));
            competitors = results.filter((c): c is Competitor => c !== null);
            if (competitors.length === 0) {
                log.warn('No matching competitors found for IDs', { competitorIds });
                return { totalCompetitors: 0, adsScraped: 0, pagesScraped: 0, postsScraped: 0, trendsScraped: 0, errors: ['No matching competitors found'] };
            }
        } else {
            competitors = await getCompetitors();
        }

        log.info(`Scraping ${competitors.length} competitors`, { dryRun });

        const result: ScrapeResult = {
            totalCompetitors: competitors.length,
            adsScraped: 0,
            pagesScraped: 0,
            postsScraped: 0,
            trendsScraped: 0,
            errors: [],
        };

        // Store posts results to extract partial page metrics later
        const postsResultsByCompetitor = new Map<number, FBPostsResult>();

        // 2. Scrape Meta Ads (Apify)
        try {
            log.info('=== Stage: Meta Ads (Apify) ===');
            const apifyInput = competitors.map((c) => ({
                name: c.name,
                facebookPageUrl: c.facebookPageUrl,
            }));

            const adsResults = await scrapeCompetitorMetaAds(apifyInput);

            for (const adsResult of adsResults) {
                const competitor = competitors.find((c) => c.name === adsResult.competitorName);
                if (!competitor) continue;

                if (adsResult.error) {
                    result.errors.push(`Ads[${competitor.id}]: ${adsResult.error}`);
                    continue;
                }

                const ads: NewAd[] = adsResult.ads.map((raw: any) =>
                    mapApifyAdToNewAd(raw, competitor),
                );

                if (!dryRun && ads.length > 0) {
                    const insertData = ads.map((ad) => ({
                        competitorId: ad.competitorId,
                        metaAdId: ad.metaAdId,
                        startedRunning: ad.startedRunning,
                        isActive: ad.isActive,
                        platforms: ad.platforms,
                        creativeType: ad.creativeType,
                        adCopy: ad.adCopy,
                        headline: ad.headline,
                        ctaType: ad.ctaType,
                        landingUrl: ad.landingUrl,
                        adVariationsCount: ad.adVariationsCount,
                        extractedPrice: ad.extractedPrice ? String(ad.extractedPrice) : null,
                        extractedDiscount: ad.extractedDiscount ? String(ad.extractedDiscount) : null,
                        language: ad.language,
                        screenshotPath: ad.screenshotPath,
                        scrapedAt: ad.scrapedAt,
                    }));
                    await insertAds(insertData);
                    const activeIds = ads.map((a) => a.metaAdId);
                    await markAdsInactive(competitor.id, activeIds);
                }

                result.adsScraped += ads.length;
                log.info(`  ${ads.length} ads for competitor ${competitor.id} (${competitor.name})`);

                // Bonus: save pageLikes from Apify response as supplemental page metrics
                if (!dryRun && adsResult.pageData?.pageLikes) {
                    try {
                        await insertPageMetrics({
                            competitorId: competitor.id,
                            pageUrl: competitor.facebookPageUrl,
                            followers: null,
                            pageLikes: adsResult.pageData.pageLikes,
                            rating: null,
                            reviewCount: null,
                            postsLast30d: null,
                            avgEngagementRate: null,
                            lastPostDate: null,
                            scrapedAt: new Date(),
                        });
                        log.info(`  Saved bonus pageLikes=${adsResult.pageData.pageLikes} for competitor ${competitor.id}`);
                    } catch (pmErr) {
                        log.warn(`  Failed to save bonus page metrics for ${competitor.id}: ${pmErr instanceof Error ? pmErr.message : String(pmErr)}`);
                    }
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error('Meta Ads scraping failed', { error: msg });
            result.errors.push(`MetaAds: ${msg}`);
        }

        // 3. Scrape Facebook Page Metrics (Playwright — kept as primary source)
        try {
            log.info('=== Stage: Facebook Pages (Playwright) ===');
            const pageScraper = new FacebookPageScraper();
            await pageScraper.init();
            try {
                const pagesMap = await pageScraper.scrapeAll(competitors);
                for (const [competitorId, scrapeRes] of pagesMap.entries()) {
                    if (scrapeRes.success && scrapeRes.data) {
                        const metrics = scrapeRes.data;
                        if (!dryRun) {
                            await insertPageMetrics({
                                competitorId: metrics.competitorId,
                                pageUrl: metrics.pageUrl,
                                followers: metrics.followers,
                                pageLikes: metrics.pageLikes,
                                rating: metrics.rating ? String(metrics.rating) : null,
                                reviewCount: metrics.reviewCount,
                                postsLast30d: metrics.postsLast30d,
                                avgEngagementRate: metrics.avgEngagementRate ? String(metrics.avgEngagementRate) : null,
                                lastPostDate: metrics.lastPostDate,
                                scrapedAt: metrics.scrapedAt,
                            });
                            if (metrics.followers) {
                                await insertFollowerHistory(competitorId, metrics.followers);
                            }
                        }
                        result.pagesScraped++;
                        log.info(`  Page metrics for competitor ${competitorId}: ${metrics.followers ?? '?'} followers`);
                    } else if (scrapeRes.error) {
                        result.errors.push(`Page[${competitorId}]: ${scrapeRes.error}`);
                    }
                }
            } finally {
                await pageScraper.close();
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error('Facebook Page scraping failed', { error: msg });
            result.errors.push(`FacebookPage: ${msg}`);
        }

        // 4. Scrape Facebook Posts (Apify)
        try {
            log.info('=== Stage: Facebook Posts (Apify) ===');
            const apifyInput = competitors.map((c) => ({
                name: c.name,
                facebookPageUrl: c.facebookPageUrl,
            }));

            const postsResults = await scrapeCompetitorFacebookPosts(apifyInput);

            for (const postsResult of postsResults) {
                const competitor = competitors.find((c) => c.name === postsResult.competitorName);
                if (!competitor) continue;

                // Store for partial page metrics extraction
                postsResultsByCompetitor.set(competitor.id, postsResult);

                if (postsResult.error) {
                    result.errors.push(`Posts[${competitor.id}]: ${postsResult.error}`);
                    continue;
                }

                const posts: NewFacebookPost[] = postsResult.posts.map((raw) =>
                    mapApifyPostToNewPost(raw, competitor),
                );

                if (!dryRun) {
                    for (const post of posts) {
                        await insertPost({
                            competitorId: post.competitorId,
                            postId: post.postId,
                            postUrl: post.postUrl,
                            postType: post.postType,
                            postText: post.postText,
                            postedAt: post.postedAt,
                            reactions: post.reactions,
                            comments: post.comments,
                            shares: post.shares,
                            videoViews: post.videoViews,
                            contentCategory: post.contentCategory,
                            language: post.language,
                            isTopPerformer: post.isTopPerformer,
                            scrapedAt: post.scrapedAt,
                        });
                    }
                }

                result.postsScraped += posts.length;
                log.info(`  ${posts.length} posts for competitor ${competitor.id} (${competitor.name})`);

                // Extract partial page metrics from posts data
                const partialMetrics = extractPartialPageMetrics(postsResult, competitor);
                if (partialMetrics) {
                    log.info(
                        `  Partial page data from posts: ${partialMetrics.postsLast30d} posts, ` +
                        `avg engagement: ${partialMetrics.avgEngagement.toFixed(0)}, ` +
                        `last post: ${partialMetrics.lastPostDate?.toISOString() ?? 'unknown'}`,
                    );
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error('Facebook Posts scraping failed', { error: msg });
            result.errors.push(`FacebookPosts: ${msg}`);
        }

        // 5. Google Trends
        try {
            log.info('=== Stage: Google Trends ===');
            const trendsFetcher = new GoogleTrendsFetcher();
            const trendsResult = await trendsFetcher.fetchAllTrends();
            if (trendsResult.success && trendsResult.data) {
                if (!dryRun) {
                    for (const trend of trendsResult.data) {
                        await insertTrend({
                            trendDate: trend.trendDate,
                            source: trend.source,
                            keyword: trend.keyword,
                            value: String(trend.value),
                            changePct: trend.changePct != null ? String(trend.changePct) : null,
                            metadata: trend.metadata,
                        });
                    }
                }
                result.trendsScraped = trendsResult.data.length;
                log.info(`  ${trendsResult.data.length} trend data points`);
            } else if (trendsResult.error) {
                result.errors.push(`Trends: ${trendsResult.error}`);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error('Google Trends fetching failed', { error: msg });
            result.errors.push(`GoogleTrends: ${msg}`);
        }

        log.info('ScrapeService.run complete', result);
        return result;
    }
}
