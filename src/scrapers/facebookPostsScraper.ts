// =============================================================================
// Facebook Posts Scraper — Apify-based
//
// Uses the `scrapeFacebookPosts` wrapper from apifyService to fetch recent
// posts for each competitor's Facebook page, normalizes the output, and
// returns structured results keyed by competitor name.
// =============================================================================

import { scrapeFacebookPosts } from '../services/apifyService.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('FacebookPostsScraper');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal competitor shape needed by this scraper. */
export interface CompetitorInput {
    name: string;
    facebookPageUrl: string;
}

/** A single normalized Facebook post. */
export interface NormalizedPost {
    competitorName: string;
    postText: string;
    postDate: string | null;
    likes: number;
    comments: number;
    shares: number;
    postUrl: string;
    postType: 'photo' | 'video' | 'text' | 'link' | 'unknown';
    imageUrls: string[];
}

/** Result for a single competitor — either posts or an error. */
export interface CompetitorScrapeResult {
    competitorName: string;
    scrapedAt: string;
    posts: NormalizedPost[];
    error?: string;
}

/** Raw shape returned by the Apify Facebook posts actor. */
interface RawFacebookPost {
    postId?: string;
    postUrl?: string;
    url?: string;
    text?: string;
    message?: string;
    time?: string;
    timestamp?: string;
    date?: string;
    likes?: number;
    likesCount?: number;
    reactions?: number;
    comments?: number;
    commentsCount?: number;
    shares?: number;
    sharesCount?: number;
    type?: string;
    // Actual structure from apify~facebook-posts-scraper:
    media?: Array<{
        __typename?: string;         // "Photo" | "Video" — used for postType detection
        publish_time?: number;       // Unix timestamp (seconds) — present on Video items
        thumbnail?: string;
        photo_image?: { uri?: string };
        url?: string;
    }>;
    images?: string[];
    photoUrl?: string;
    videoUrl?: string;
    [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core scraper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scrapes recent Facebook posts for every competitor in the list.
 *
 * Runs all competitors **concurrently** via `Promise.allSettled` so one
 * failure never blocks the others.
 *
 * @param competitors - Array of `{ name, facebookPageUrl }` objects.
 * @returns Array of `CompetitorScrapeResult` — one per competitor.
 *          Failed scrapes contain `{ error, posts: [] }` instead of throwing.
 *
 * @example
 * ```ts
 * const results = await scrapeCompetitorFacebookPosts([
 *   { name: 'Coca-Cola', facebookPageUrl: 'https://www.facebook.com/cocacola' },
 *   { name: 'Pepsi',     facebookPageUrl: 'https://www.facebook.com/pepsi' },
 * ]);
 * ```
 */
export async function scrapeCompetitorFacebookPosts(
    competitors: CompetitorInput[],
): Promise<CompetitorScrapeResult[]> {
    log.info(`Starting Facebook posts scrape for ${competitors.length} competitor(s)`);

    const promises = competitors.map((competitor) =>
        scrapeOneCompetitor(competitor),
    );

    const settled = await Promise.allSettled(promises);

    return settled.map((outcome, idx) => {
        if (outcome.status === 'fulfilled') {
            return outcome.value;
        }

        // This branch should rarely fire because scrapeOneCompetitor already
        // catches internally, but it acts as a safety net.
        const errorMsg = outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason);

        log.error(`Unexpected failure for "${competitors[idx]!.name}"`, { error: errorMsg });

        return {
            competitorName: competitors[idx]!.name,
            scrapedAt: new Date().toISOString(),
            posts: [],
            error: errorMsg,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Date filter utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filters an array of normalized posts, keeping only those published
 * within the last `daysBack` days.
 *
 * Posts with a `null` or unparseable `postDate` are **excluded**.
 *
 * @param posts    - Array of `NormalizedPost` objects to filter.
 * @param daysBack - Number of days to look back (default: 7).
 * @returns Filtered array of posts within the time window.
 *
 * @example
 * ```ts
 * const recentPosts = filterRecentPosts(allPosts, 14); // last 2 weeks
 * ```
 */
export function filterRecentPosts(
    posts: NormalizedPost[],
    daysBack: number = 7,
): NormalizedPost[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    return posts.filter((post) => {
        if (!post.postDate) return false;
        const postDate = new Date(post.postDate);
        return !isNaN(postDate.getTime()) && postDate >= cutoff;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Scrape a single competitor — catches errors and returns a result object. */
async function scrapeOneCompetitor(
    competitor: CompetitorInput,
): Promise<CompetitorScrapeResult> {
    const { name, facebookPageUrl } = competitor;

    console.log(`Scraping Facebook posts for ${name}...`);
    log.info(`Scraping Facebook posts for "${name}"`, { url: facebookPageUrl });

    try {
        const rawPosts = await scrapeFacebookPosts<RawFacebookPost>({
            startUrls: [{ url: facebookPageUrl }],
            maxPosts: 10,
            maxPostComments: 0,
            maxReviews: 0,
            scrapeAbout: false,
            scrapeReviews: false,
            scrapeServices: false,
        });

        const normalizedPosts = rawPosts.map((raw) => normalizePost(raw, name));

        console.log(`✓ ${name}: fetched ${normalizedPosts.length} post(s)`);
        log.info(`Scraped ${normalizedPosts.length} post(s) for "${name}"`);

        return {
            competitorName: name,
            scrapedAt: new Date().toISOString(),
            posts: normalizedPosts,
        };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        console.log(`✗ ${name}: scrape failed — ${errorMsg}`);
        log.error(`Failed to scrape Facebook posts for "${name}"`, { error: errorMsg });

        return {
            competitorName: name,
            scrapedAt: new Date().toISOString(),
            posts: [],
            error: errorMsg,
        };
    }
}

/** Normalize a single raw Apify post into our standard shape. */
function normalizePost(raw: RawFacebookPost, competitorName: string): NormalizedPost {
    return {
        competitorName,
        postText: raw.text ?? raw.message ?? '',
        postDate: extractPostDate(raw),
        likes: raw.likes ?? raw.likesCount ?? raw.reactions ?? 0,
        comments: raw.comments ?? raw.commentsCount ?? 0,
        shares: raw.shares ?? raw.sharesCount ?? 0,
        postUrl: raw.postUrl ?? raw.url ?? '',
        postType: inferPostType(raw),
        imageUrls: extractImageUrls(raw),
    };
}

/**
 * Extract post date from available fields.
 * The Apify Facebook posts actor does not include a top-level date field.
 * Dates are buried in media[0].publish_time (Unix seconds, only on Video items).
 * Falls back to current time so posts are always queryable by date.
 */
function extractPostDate(raw: RawFacebookPost): string {
    // Try top-level date fields (may be present in some actor versions)
    const topDate = raw.time ?? raw.timestamp ?? raw.date;
    if (topDate) return normalizeDate(topDate) ?? new Date().toISOString();

    // Extract from media[0].publish_time (Unix seconds, present on Video/Reel items)
    const publishTime = raw.media?.[0]?.publish_time;
    if (publishTime && typeof publishTime === 'number') {
        return new Date(publishTime * 1000).toISOString();
    }

    // Fallback: use current scrape time so the post has a valid date for analysis
    return new Date().toISOString();
}

/** Try to coerce a date-like value into an ISO string. */
function normalizeDate(value: string | null): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

/** Infer the post type from available fields. */
function inferPostType(raw: RawFacebookPost): NormalizedPost['postType'] {
    // Check media[0].__typename — actual field in apify~facebook-posts-scraper output
    const mediaTypeName = raw.media?.[0]?.__typename;
    if (mediaTypeName === 'Video') return 'video';
    if (mediaTypeName === 'Photo') return 'photo';

    // Explicit type field from the actor (some actor versions)
    if (raw.type) {
        const t = String(raw.type).toLowerCase();
        if (t.includes('video')) return 'video';
        if (t.includes('photo')) return 'photo';
        if (t.includes('link')) return 'link';
        if (t.includes('status')) return 'text';
    }

    // Heuristic fallback
    if (raw.videoUrl) return 'video';
    if (raw.photoUrl || (raw.images && raw.images.length > 0)) return 'photo';
    if (raw.postUrl?.includes('permalink')) return 'link';

    return (raw.text || raw.message) ? 'text' : 'unknown';
}

/** Collect all available image URLs from the raw post. */
function extractImageUrls(raw: RawFacebookPost): string[] {
    const urls: string[] = [];

    if (raw.photoUrl) urls.push(raw.photoUrl);
    if (raw.images) urls.push(...raw.images);

    if (raw.media && Array.isArray(raw.media)) {
        for (const m of raw.media) {
            if (m.photo_image?.uri) urls.push(m.photo_image.uri);
            else if (m.thumbnail) urls.push(m.thumbnail);
        }
    }

    // Deduplicate
    return [...new Set(urls)];
}
