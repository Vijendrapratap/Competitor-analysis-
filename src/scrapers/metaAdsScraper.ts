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
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MetaAdsCompetitorInput {
    name: string;             // Display name of the competitor.
    facebookPageUrl: string;  // Full URL of the competitor's Facebook page.
    searchTerms?: string[];   // Optional keywords to narrow ad search.
}

export interface NormalizedAd {
    competitorName: string;   // Name of the competitor this ad belongs to.
    adId: string;             // Unique ad / library ID.
    adText: string;           // Primary ad copy body text.
    adHeadline: string | null;     // Headline text (link title).
    adDescription: string | null;  // Description / link caption.
    callToAction: string | null;   // CTA button label.
    adStartDate: string | null;    // ISO string of when the ad started running.
    adEndDate: string | null;      // ISO string of when the ad stopped (if inactive).
    adStatus: 'active' | 'inactive'; // Whether the ad is currently running.
    platforms: string[];      // Platforms (Facebook, Instagram, etc.).
    mediaType: 'image' | 'video' | 'carousel' | 'unknown'; // Detected creative type.
    mediaUrls: string[];      // URLs for images / videos / thumbnails.
    estimatedReach: string | null; // Impressions / reach range if available.
    spendRange: string | null;     // Spend range string if available.
}

export interface CompetitorMetaAdsResult {
    competitorName: string; // Name of the competitor.
    scrapedAt: string;      // ISO timestamp of when the scrape ran.
    ads: NormalizedAd[];    // Array of normalized ads.
    error?: string;         // Error message if the scrape failed.
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword lists for ad categorization
// ─────────────────────────────────────────────────────────────────────────────

const PROMOTIONAL_KEYWORDS: string[] = [
    'discount', 'sale', 'offer', 'deal', 'save', 'off', 'promo', 'coupon',
    'free', 'limited time', 'special', 'clearance', 'flash', 'bonus', 'bogo',
    'buy one get one', 'half price', 'percent off', '% off', 'voucher',
    'ส่วนลด', 'โปร', 'ลดราคา', 'ฟรี', 'โปรโมชั่น', 'ราคาพิเศษ',
];

const DIRECT_RESPONSE_KEYWORDS: string[] = [
    'book now', 'reserve', 'sign up', 'register', 'subscribe', 'get started',
    'buy now', 'shop now', 'order now', 'apply now', 'download', 'install',
    'claim', 'enroll', 'join', 'try', 'start', 'get offer', 'contact us',
    'send message', 'call now', 'whatsapp', 'line', 'enquire', 'request',
    'จองเลย', 'จองตอนนี้', 'สมัคร', 'ลงทะเบียน', 'ซื้อเลย', 'สั่งซื้อ',
    'ติดต่อ', 'โทร',
];

const DIRECT_RESPONSE_CTAS: string[] = [
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
 * @param competitors
 *   Array of `{ name, facebookPageUrl, searchTerms? }` objects.
 *
 * @returns Array of `CompetitorMetaAdsResult` — one per competitor.
 *   Failed scrapes contain `{ error, ads: [] }` instead of throwing.
 */
export async function scrapeCompetitorMetaAds(competitors: MetaAdsCompetitorInput[]): Promise<CompetitorMetaAdsResult[]> {
    log.info(`Starting Meta Ads scrape for ${competitors.length} competitor(s)`);

    const promises = competitors.map((competitor) => scrapeOneCompetitorAds(competitor));
    const settled = await Promise.allSettled(promises);

    const results = settled.map((outcome, idx): CompetitorMetaAdsResult => {
        if (outcome.status === 'fulfilled') {
            return outcome.value;
        }

        const errorMsg = outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason);

        const compName = competitors[idx]?.name ?? 'Unknown';

        log.error(`Unexpected failure for "${compName}"`, { error: errorMsg });

        return {
            competitorName: compName,
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
 */
export function categorizeAdsByType(ads: NormalizedAd[]): {
    promotional: NormalizedAd[];
    branding: NormalizedAd[];
    direct_response: NormalizedAd[];
} {
    const categories = {
        promotional: [] as NormalizedAd[],
        branding: [] as NormalizedAd[],
        direct_response: [] as NormalizedAd[],
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

        // Priority 1: Direct response
        const isDR =
            DIRECT_RESPONSE_CTAS.some((kw) => ctaLower.includes(kw)) ||
            DIRECT_RESPONSE_KEYWORDS.some((kw) => searchableText.includes(kw));

        if (isDR) {
            categories.direct_response.push(ad);
            continue;
        }

        // Priority 2: Promotional
        const isPromo = PROMOTIONAL_KEYWORDS.some((kw) => searchableText.includes(kw));

        if (isPromo) {
            categories.promotional.push(ad);
            continue;
        }

        // Default: Branding
        categories.branding.push(ad);
    }

    return categories;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scrape a single competitor — catches errors and returns a result object.
 */
async function scrapeOneCompetitorAds(competitor: MetaAdsCompetitorInput): Promise<CompetitorMetaAdsResult> {
    const { name, facebookPageUrl, searchTerms } = competitor;

    log.info(`Scraping Meta Ads for "${name}"`, { url: facebookPageUrl });

    try {
        const inputPayload: any = {
            startUrls: [{ url: facebookPageUrl }],
            country: 'TH',
            adType: 'all',
            includeInactive: false,
        };

        if (searchTerms && searchTerms.length > 0) {
            inputPayload.searchTerms = searchTerms;
        }

        const rawAds = await scrapeMetaAds(inputPayload);
        const normalizedAds = rawAds.map((raw: any) => normalizeAd(raw, name));

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

function normalizeAd(raw: any, competitorName: string): NormalizedAd {
    return {
        competitorName,
        adId: String(raw.adId ?? raw.ad_id ?? raw.id ?? raw.adArchiveID ?? ''),
        adText: String(raw.adCreativeBody ?? raw.ad_creative_body ?? raw.body ?? raw.text ?? ''),
        adHeadline: stringOrNull(raw.adCreativeLinkTitle ?? raw.ad_creative_link_title ?? raw.headline ?? raw.title),
        adDescription: stringOrNull(
            raw.adCreativeLinkDescription ??
            raw.adCreativeLinkCaption ??
            raw.ad_creative_link_description ??
            raw.ad_creative_link_caption ??
            raw.description
        ),
        callToAction: stringOrNull(raw.callToActionType ?? raw.call_to_action_type ?? raw.cta ?? raw.ctaText),
        adStartDate: normalizeDate(raw.adCreationTime ?? raw.ad_creation_time ?? raw.startDate ?? raw.started),
        adEndDate: normalizeDate(raw.adDeliveryStopTime ?? raw.ad_delivery_stop_time ?? raw.endDate ?? raw.stopped),
        adStatus: inferAdStatus(raw),
        platforms: extractPlatforms(raw),
        mediaType: inferMediaType(raw),
        mediaUrls: extractMediaUrls(raw),
        estimatedReach: stringOrNull(
            raw.estimatedAudienceSize ?? raw.estimated_audience_size ?? raw.reach ?? raw.impressions
        ),
        spendRange: stringOrNull(raw.spend ?? raw.spendRange ?? raw.spend_range),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Field-level helpers
// ─────────────────────────────────────────────────────────────────────────────

function stringOrNull(val: any): string | null {
    if (val === undefined || val === null) return null;
    const s = String(val).trim();
    return s.length > 0 ? s : null;
}

function normalizeDate(value: any): string | null {
    if (value === undefined || value === null) return null;

    if (typeof value === 'number') {
        const d = new Date(value > 1e12 ? value : value * 1000);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }

    const s = String(value).trim();
    if (!s) return null;

    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? s : parsed.toISOString();
}

function inferAdStatus(raw: any): 'active' | 'inactive' {
    const status = String(
        raw.adStatus ?? raw.ad_delivery_status ?? raw.status ?? raw.isActive ?? ''
    ).toLowerCase();

    if (status === 'active' || status === 'true' || status === '1') return 'active';
    if (status === 'inactive' || status === 'false' || status === '0') return 'inactive';

    if (raw.adDeliveryStopTime || raw.ad_delivery_stop_time || raw.endDate) return 'inactive';

    return 'active';
}

function extractPlatforms(raw: any): string[] {
    const pp = raw.publisherPlatforms ?? raw.publisher_platforms ?? raw.platforms;

    if (Array.isArray(pp)) {
        return pp.map((p) => capitalize(String(p)));
    }

    if (typeof pp === 'string' && pp.length > 0) {
        return pp.split(/[,;|]/).map((s) => capitalize(s.trim())).filter(Boolean);
    }

    return ['Facebook'];
}

function inferMediaType(raw: any): 'image' | 'video' | 'carousel' | 'unknown' {
    const type = String(raw.mediaType ?? raw.media_type ?? raw.creativeType ?? '').toLowerCase();

    if (type.includes('video')) return 'video';
    if (type.includes('carousel') || type.includes('dynamic')) return 'carousel';
    if (type.includes('image') || type.includes('photo')) return 'image';

    const media = raw.media ?? raw.snapshot?.media ?? [];
    if (Array.isArray(media)) {
        if (media.length > 1) return 'carousel';

        for (const item of media) {
            if (item?.type === 'video' || item?.video_url) return 'video';
            if (item?.type === 'image' || item?.image_url || item?.url) return 'image';
        }
    }

    if (raw.videoUrl || raw.video_url) return 'video';
    if (raw.imageUrl || raw.image_url || raw.thumbnailUrl) return 'image';

    return 'unknown';
}

function extractMediaUrls(raw: any): string[] {
    const urls = new Set<string>();

    if (raw.imageUrl) urls.add(String(raw.imageUrl));
    if (raw.image_url) urls.add(String(raw.image_url));
    if (raw.videoUrl) urls.add(String(raw.videoUrl));
    if (raw.video_url) urls.add(String(raw.video_url));
    if (raw.thumbnailUrl) urls.add(String(raw.thumbnailUrl));
    if (raw.thumbnail_url) urls.add(String(raw.thumbnail_url));

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

    if (Array.isArray(raw.images)) {
        for (const url of raw.images) {
            if (typeof url === 'string') urls.add(url);
        }
    }

    return [...urls];
}

function capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
