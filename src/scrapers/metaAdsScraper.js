// DEPRECATED — ported to metaAdsScraper.ts
// =============================================================================
// Meta Ads Scraper — Apify-based
//
// Uses the `scrapeMetaAds` wrapper from apifyService to fetch ads from the
// Meta Ads Library for each competitor, normalizes the output, and returns
// structured results keyed by competitor name.
// =============================================================================

import { scrapeMetaAds } from '../services/apifyService.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('MetaAdsScraper');

// ─────────────────────────────────────────────────────────────────────────────
// Types (JSDoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} MetaAdsCompetitorInput
 * @property {string}   name             - Display name of the competitor.
 * @property {string}   facebookPageUrl  - Full URL of the competitor's Facebook page.
 * @property {string[]} [searchTerms]    - Optional keywords to narrow ad search.
 */

/**
 * @typedef {Object} NormalizedAd
 * @property {string}        competitorName   - Name of the competitor this ad belongs to.
 * @property {string}        adId             - Unique ad / library ID.
 * @property {string}        adText           - Primary ad copy body text.
 * @property {string|null}   adHeadline       - Headline text (link title).
 * @property {string|null}   adDescription    - Description / link caption.
 * @property {string|null}   callToAction     - CTA button label.
 * @property {string|null}   adStartDate      - ISO string of when the ad started running.
 * @property {string|null}   adEndDate        - ISO string of when the ad stopped (if inactive).
 * @property {'active'|'inactive'} adStatus   - Whether the ad is currently running.
 * @property {string[]}      platforms        - Platforms (Facebook, Instagram, etc.).
 * @property {'image'|'video'|'carousel'|'unknown'} mediaType - Detected creative type.
 * @property {string[]}      mediaUrls        - URLs for images / videos / thumbnails.
 * @property {string|null}   estimatedReach   - Impressions / reach range if available.
 * @property {string|null}   spendRange       - Spend range string if available.
 */

/**
 * @typedef {Object} CompetitorMetaAdsResult
 * @property {string}         competitorName - Name of the competitor.
 * @property {string}         scrapedAt      - ISO timestamp of when the scrape ran.
 * @property {NormalizedAd[]} ads            - Array of normalized ads.
 * @property {string}         [error]        - Error message if the scrape failed.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Keyword lists for ad categorization
// ─────────────────────────────────────────────────────────────────────────────

const PROMOTIONAL_KEYWORDS = [
    'discount', 'sale', 'offer', 'deal', 'save', 'off', 'promo', 'coupon',
    'free', 'limited time', 'special', 'clearance', 'flash', 'bonus', 'bogo',
    'buy one get one', 'half price', 'percent off', '% off', 'voucher',
    'ส่วนลด', 'โปร', 'ลดราคา', 'ฟรี', 'โปรโมชั่น', 'ราคาพิเศษ',
];

const DIRECT_RESPONSE_KEYWORDS = [
    'book now', 'reserve', 'sign up', 'register', 'subscribe', 'get started',
    'buy now', 'shop now', 'order now', 'apply now', 'download', 'install',
    'claim', 'enroll', 'join', 'try', 'start', 'get offer', 'contact us',
    'send message', 'call now', 'whatsapp', 'line', 'enquire', 'request',
    'จองเลย', 'จองตอนนี้', 'สมัคร', 'ลงทะเบียน', 'ซื้อเลย', 'สั่งซื้อ',
    'ติดต่อ', 'โทร',
];

const DIRECT_RESPONSE_CTAS = [
    'book now', 'shop now', 'sign up', 'get offer', 'subscribe', 'apply now',
    'download', 'install now', 'order now', 'buy tickets', 'get quote',
    'contact us', 'send message', 'call now', 'learn more', 'get directions',
];

// ─────────────────────────────────────────────────────────────────────────────
// Core scraper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scrapes Meta Ads Library ads for every competitor in the list.
 *
 * Runs all competitors **concurrently** via `Promise.allSettled` so one
 * failure never blocks the others. For each competitor, calls the Apify
 * `leadsbrary~meta-ads-library-scraper` actor via `scrapeMetaAds`.
 *
 * @param {MetaAdsCompetitorInput[]} competitors
 *   Array of `{ name, facebookPageUrl, searchTerms? }` objects.
 *
 * @returns {Promise<CompetitorMetaAdsResult[]>}
 *   Array of `CompetitorMetaAdsResult` — one per competitor.
 *   Failed scrapes contain `{ error, ads: [] }` instead of throwing.
 *
 * @example
 * ```js
 * const results = await scrapeCompetitorMetaAds([
 *   {
 *     name: 'Rival Resort',
 *     facebookPageUrl: 'https://www.facebook.com/rivalresort',
 *     searchTerms: ['luxury villa', 'pool suite'],
 *   },
 * ]);
 * ```
 */
export async function scrapeCompetitorMetaAds(competitors) {
    log.info(`Starting Meta Ads scrape for ${competitors.length} competitor(s)`);

    const promises = competitors.map((competitor) =>
        scrapeOneCompetitorAds(competitor),
    );

    const settled = await Promise.allSettled(promises);

    const results = settled.map((outcome, idx) => {
        if (outcome.status === 'fulfilled') {
            return outcome.value;
        }

        // Safety net — scrapeOneCompetitorAds already catches internally
        const errorMsg = outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason);

        log.error(`Unexpected failure for "${competitors[idx].name}"`, { error: errorMsg });

        return {
            competitorName: competitors[idx].name,
            scrapedAt: new Date().toISOString(),
            ads: [],
            error: errorMsg,
        };
    });

    const totalAds = results.reduce((sum, r) => sum + r.ads.length, 0);
    const successCount = results.filter((r) => !r.error).length;
    log.info(
        `Meta Ads scrape complete: ${successCount}/${competitors.length} succeeded, ` +
        `${totalAds} total ads collected`,
    );

    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ad categorization utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Groups an array of normalized ads into three categories based on
 * keyword matching in `adText`, `adHeadline`, and `callToAction`.
 *
 * Categories:
 *   - **promotional** — discount, offer, or sale language.
 *   - **branding** — awareness / lifestyle content (fallback).
 *   - **direct_response** — booking, CTA-focused, or action-oriented.
 *
 * Detection order: `direct_response` → `promotional` → `branding` (default).
 *
 * @param {NormalizedAd[]} ads - Array of normalized ad objects to classify.
 * @returns {{ promotional: NormalizedAd[], branding: NormalizedAd[], direct_response: NormalizedAd[] }}
 *
 * @example
 * ```js
 * const grouped = categorizeAdsByType(allAds);
 * console.log(`${grouped.promotional.length} promo ads`);
 * console.log(`${grouped.direct_response.length} DR ads`);
 * console.log(`${grouped.branding.length} branding ads`);
 * ```
 */
export function categorizeAdsByType(ads) {
    const categories = {
        promotional: [],
        branding: [],
        direct_response: [],
    };

    for (const ad of ads) {
        const searchableText = [
            ad.adText,
            ad.adHeadline,
            ad.adDescription,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        const ctaLower = (ad.callToAction ?? '').toLowerCase();

        // Priority 1: Direct response — if CTA or body text is action-oriented
        const isDR =
            DIRECT_RESPONSE_CTAS.some((kw) => ctaLower.includes(kw)) ||
            DIRECT_RESPONSE_KEYWORDS.some((kw) => searchableText.includes(kw));

        if (isDR) {
            categories.direct_response.push(ad);
            continue;
        }

        // Priority 2: Promotional — discount / offer language
        const isPromo = PROMOTIONAL_KEYWORDS.some((kw) =>
            searchableText.includes(kw),
        );

        if (isPromo) {
            categories.promotional.push(ad);
            continue;
        }

        // Default: Branding / awareness content
        categories.branding.push(ad);
    }

    return categories;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scrape a single competitor — catches errors and returns a result object.
 * @param {MetaAdsCompetitorInput} competitor
 * @returns {Promise<CompetitorMetaAdsResult>}
 */
async function scrapeOneCompetitorAds(competitor) {
    const { name, facebookPageUrl, searchTerms } = competitor;

    log.info(`Scraping Meta Ads for "${name}"`, { url: facebookPageUrl });

    try {
        // ── Build input payload ─────────────────────────────────────────
        const inputPayload = {
            urls: [facebookPageUrl],
            country: 'TH',
            adType: 'all',
            includeInactive: false,
        };

        if (searchTerms && searchTerms.length > 0) {
            inputPayload.searchTerms = searchTerms;
        }

        // ── Call the Apify actor ────────────────────────────────────────
        const rawAds = await scrapeMetaAds(inputPayload);

        const normalizedAds = rawAds.map((raw) => normalizeAd(raw, name));

        log.info(`✓ ${name}: fetched ${normalizedAds.length} ad(s)`);

        return {
            competitorName: name,
            scrapedAt: new Date().toISOString(),
            ads: normalizedAds,
        };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        log.error(`✗ Failed to scrape Meta Ads for "${name}"`, { error: errorMsg });

        return {
            competitorName: name,
            scrapedAt: new Date().toISOString(),
            ads: [],
            error: errorMsg,
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a single raw Apify Meta Ads Library item into the standard shape.
 *
 * The Apify `leadsbrary~meta-ads-library-scraper` actor returns fields like:
 *   adId, pageId, pageName, adCreativeBody, adCreativeLinkTitle,
 *   adCreativeLinkCaption, adCreativeLinkDescription, callToActionType,
 *   adCreationTime, adDeliveryStopTime, adStatus, publisherPlatforms,
 *   impressions, spend, media, snapshot, etc.
 *
 * @param {Record<string, unknown>} raw
 * @param {string} competitorName
 * @returns {NormalizedAd}
 */
function normalizeAd(raw, competitorName) {
    return {
        competitorName,
        adId: String(
            raw.adId ?? raw.ad_id ?? raw.id ?? raw.adArchiveID ?? '',
        ),
        adText: String(
            raw.adCreativeBody ?? raw.ad_creative_body ?? raw.body ?? raw.text ?? '',
        ),
        adHeadline: stringOrNull(
            raw.adCreativeLinkTitle ?? raw.ad_creative_link_title ?? raw.headline ?? raw.title,
        ),
        adDescription: stringOrNull(
            raw.adCreativeLinkDescription ??
            raw.adCreativeLinkCaption ??
            raw.ad_creative_link_description ??
            raw.ad_creative_link_caption ??
            raw.description,
        ),
        callToAction: stringOrNull(
            raw.callToActionType ?? raw.call_to_action_type ?? raw.cta ?? raw.ctaText,
        ),
        adStartDate: normalizeDate(
            raw.adCreationTime ?? raw.ad_creation_time ?? raw.startDate ?? raw.started,
        ),
        adEndDate: normalizeDate(
            raw.adDeliveryStopTime ?? raw.ad_delivery_stop_time ?? raw.endDate ?? raw.stopped,
        ),
        adStatus: inferAdStatus(raw),
        platforms: extractPlatforms(raw),
        mediaType: inferMediaType(raw),
        mediaUrls: extractMediaUrls(raw),
        estimatedReach: stringOrNull(
            raw.estimatedAudienceSize ?? raw.estimated_audience_size ?? raw.reach ?? raw.impressions,
        ),
        spendRange: stringOrNull(
            raw.spend ?? raw.spendRange ?? raw.spend_range,
        ),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Field-level helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Coerce a value into a string or return null. */
function stringOrNull(val) {
    if (val === undefined || val === null) return null;
    const s = String(val).trim();
    return s.length > 0 ? s : null;
}

/** Try to coerce a date-like value into an ISO string. */
function normalizeDate(value) {
    if (value === undefined || value === null) return null;

    // Unix timestamp (seconds)
    if (typeof value === 'number') {
        const d = new Date(value > 1e12 ? value : value * 1000);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }

    const s = String(value).trim();
    if (!s) return null;

    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? s : parsed.toISOString();
}

/** Determine active / inactive status from raw data. */
function inferAdStatus(raw) {
    const status = String(
        raw.adStatus ?? raw.ad_delivery_status ?? raw.status ?? raw.isActive ?? '',
    ).toLowerCase();

    if (status === 'active' || status === 'true' || status === '1') return 'active';
    if (status === 'inactive' || status === 'false' || status === '0') return 'inactive';

    // If there's a stop date set, consider it inactive
    if (raw.adDeliveryStopTime || raw.ad_delivery_stop_time || raw.endDate) return 'inactive';

    // Default: assume active (since includeInactive is false)
    return 'active';
}

/** Extract the list of platform names. */
function extractPlatforms(raw) {
    // publisherPlatforms can be an array OR a comma-separated string
    const pp = raw.publisherPlatforms ?? raw.publisher_platforms ?? raw.platforms;

    if (Array.isArray(pp)) {
        return pp.map((p) => capitalize(String(p)));
    }

    if (typeof pp === 'string' && pp.length > 0) {
        return pp.split(/[,;|]/).map((s) => capitalize(s.trim())).filter(Boolean);
    }

    // Fallback: default to Facebook
    return ['Facebook'];
}

/** Detect whether the ad creative is image, video, or carousel. */
function inferMediaType(raw) {
    const type = String(raw.mediaType ?? raw.media_type ?? raw.creativeType ?? '').toLowerCase();

    if (type.includes('video')) return 'video';
    if (type.includes('carousel') || type.includes('dynamic')) return 'carousel';
    if (type.includes('image') || type.includes('photo')) return 'image';

    // Inspect the media array / snapshot
    const media = raw.media ?? raw.snapshot?.media ?? [];
    if (Array.isArray(media)) {
        if (media.length > 1) return 'carousel';

        for (const item of media) {
            if (item?.type === 'video' || item?.video_url) return 'video';
            if (item?.type === 'image' || item?.image_url || item?.url) return 'image';
        }
    }

    // Check for specific URL fields
    if (raw.videoUrl || raw.video_url) return 'video';
    if (raw.imageUrl || raw.image_url || raw.thumbnailUrl) return 'image';

    return 'unknown';
}

/** Collect all available media URLs from the raw ad. */
function extractMediaUrls(raw) {
    const urls = new Set();

    // Direct URL fields
    if (raw.imageUrl) urls.add(String(raw.imageUrl));
    if (raw.image_url) urls.add(String(raw.image_url));
    if (raw.videoUrl) urls.add(String(raw.videoUrl));
    if (raw.video_url) urls.add(String(raw.video_url));
    if (raw.thumbnailUrl) urls.add(String(raw.thumbnailUrl));
    if (raw.thumbnail_url) urls.add(String(raw.thumbnail_url));

    // Media array (Apify actors use various shapes)
    const mediaArr = raw.media ?? raw.snapshot?.media ?? [];
    if (Array.isArray(mediaArr)) {
        for (const item of mediaArr) {
            if (!item) continue;
            if (item.url) urls.add(String(item.url));
            if (item.image_url) urls.add(String(item.image_url));
            if (item.video_url) urls.add(String(item.video_url));
            if (item.thumbnail) urls.add(String(item.thumbnail));
            if (item.src) urls.add(String(item.src));
        }
    }

    // Images array (some actors return a flat array of URLs)
    if (Array.isArray(raw.images)) {
        for (const url of raw.images) {
            if (typeof url === 'string') urls.add(url);
        }
    }

    return [...urls];
}

/** Capitalize the first letter of a string. */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
