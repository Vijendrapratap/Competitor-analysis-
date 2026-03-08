// =============================================================================
// Apify Service — Reusable module for Apify API communication
//
// Uses the run-sync-get-dataset-items endpoint to execute actors and
// return parsed dataset items in a single synchronous HTTP call.
// =============================================================================
import { createLogger } from '../utils/logger.js';
const log = createLogger('ApifyService');
// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────
const APIFY_BASE_URL = 'https://api.apify.com/v2/acts';
const DEFAULT_TIMEOUT_SECS = 300; // Apify's max for sync runs
const DEFAULT_FORMAT = 'json';
// ─────────────────────────────────────────────────────────────────────────────
// Token validation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Validates that the `APIFY_API_TOKEN` environment variable is set.
 *
 * Call this early in your startup sequence (e.g. before any actor run)
 * to fail fast with a clear message instead of getting a cryptic 401.
 *
 * @throws {Error} If `APIFY_API_TOKEN` is missing or empty.
 * @returns The validated token string.
 */
export function validateApifyToken() {
    const token = process.env['APIFY_API_TOKEN'];
    if (!token || token.trim().length === 0) {
        throw new Error('[ApifyService] Missing environment variable APIFY_API_TOKEN. ' +
            'Set it in your .env file or system environment before running Apify actors. ' +
            'You can find your token at https://console.apify.com/account/integrations');
    }
    return token.trim();
}
// ─────────────────────────────────────────────────────────────────────────────
// Core runner
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Runs an Apify actor synchronously and returns parsed dataset items.
 *
 * Uses the `run-sync-get-dataset-items` endpoint which starts the actor,
 * waits for it to finish, and returns the dataset contents — all in one call.
 *
 * @param actorId   - The actor identifier, e.g. `"apify~facebook-posts-scraper"`.
 * @param inputPayload - Actor input object (sent as JSON POST body).
 * @param options   - Optional query-parameter overrides (timeout, memory, etc.).
 *
 * @returns Parsed JSON array of dataset items (type `T[]`).
 *
 * @throws {Error} On network failure, invalid token, actor not found,
 *                 timeout, or actor run failure — each with a descriptive message.
 *
 * @example
 * ```ts
 * const posts = await runApifyActor<FacebookPost>(
 *   'apify~facebook-posts-scraper',
 *   { startUrls: [{ url: 'https://facebook.com/cocacola' }], maxPosts: 10 },
 *   { timeout: 120 },
 * );
 * ```
 */
export async function runApifyActor(actorId, inputPayload, options = {}) {
    const token = validateApifyToken();
    // ── Build URL with query parameters ──────────────────────────────────────
    const url = new URL(`${APIFY_BASE_URL}/${actorId}/run-sync-get-dataset-items`);
    url.searchParams.set('token', token);
    url.searchParams.set('format', DEFAULT_FORMAT);
    url.searchParams.set('clean', 'true');
    if (options.timeout !== undefined)
        url.searchParams.set('timeout', String(options.timeout));
    if (options.memory !== undefined)
        url.searchParams.set('memory', String(options.memory));
    if (options.maxItems !== undefined)
        url.searchParams.set('maxItems', String(options.maxItems));
    if (options.limit !== undefined)
        url.searchParams.set('limit', String(options.limit));
    if (options.offset !== undefined)
        url.searchParams.set('offset', String(options.offset));
    if (options.fields !== undefined)
        url.searchParams.set('fields', options.fields);
    // ── Execute ──────────────────────────────────────────────────────────────
    log.info(`Running actor "${actorId}"`, {
        inputKeys: Object.keys(inputPayload),
        timeout: options.timeout ?? DEFAULT_TIMEOUT_SECS,
    });
    const timeoutMs = ((options.timeout ?? DEFAULT_TIMEOUT_SECS) + 30) * 1000; // +30s buffer
    try {
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputPayload),
            signal: controller.signal,
        });
        clearTimeout(abortTimer);
        // ── Handle error status codes ────────────────────────────────────────
        if (!response.ok) {
            const errorBody = await parseErrorBody(response);
            switch (response.status) {
                case 400: {
                    const detail = errorBody?.error?.message ?? 'Unknown failure reason';
                    log.error(`Actor "${actorId}" run failed (400)`, { detail });
                    throw new Error(`[ApifyService] Actor "${actorId}" run failed: ${detail}`);
                }
                case 401:
                    throw new Error('[ApifyService] Invalid or expired APIFY_API_TOKEN. ' +
                        'Check your token at https://console.apify.com/account/integrations');
                case 404:
                    throw new Error(`[ApifyService] Actor "${actorId}" not found. ` +
                        'Verify the actor ID is correct and that you have access to it.');
                case 408:
                    throw new Error(`[ApifyService] Actor "${actorId}" timed out after ${options.timeout ?? DEFAULT_TIMEOUT_SECS}s. ` +
                        'Consider increasing the timeout, reducing the input scope, or running asynchronously.');
                default: {
                    const msg = errorBody?.error?.message ?? response.statusText;
                    throw new Error(`[ApifyService] Actor "${actorId}" returned HTTP ${response.status}: ${msg}`);
                }
            }
        }
        // ── Parse successful response ────────────────────────────────────────
        const items = (await response.json());
        log.info(`Actor "${actorId}" completed`, { itemCount: items.length });
        return items;
    }
    catch (err) {
        // Re-throw our own errors; wrap unexpected ones
        if (err instanceof Error && err.message.startsWith('[ApifyService]')) {
            throw err;
        }
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error(`[ApifyService] Actor "${actorId}" request aborted — local timeout of ${timeoutMs / 1000}s exceeded.`);
        }
        const message = err instanceof Error ? err.message : String(err);
        log.error(`Unexpected error running actor "${actorId}"`, { error: message });
        throw new Error(`[ApifyService] Failed to run actor "${actorId}": ${message}`);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Specific actor wrappers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Scrapes Facebook page posts using the `apify~facebook-posts-scraper` actor.
 *
 * @param inputPayload - Actor input. Common fields:
 *   - `startUrls`  — Array of `{ url: string }` for Facebook pages to scrape.
 *   - `maxPosts`   — Max number of posts per page (default varies by actor).
 *   - `proxyConfiguration` — Proxy settings.
 *
 * @param options - Optional query-parameter overrides (timeout, memory, etc.).
 *
 * @returns Array of scraped Facebook post objects. Each item typically contains:
 *   - `postId`, `postUrl`, `text`, `likes`, `comments`, `shares`,
 *     `timestamp`, `media`, `pageName`, `pageUrl`.
 *
 * @example
 * ```ts
 * const posts = await scrapeFacebookPosts({
 *   startUrls: [{ url: 'https://www.facebook.com/cocacola' }],
 *   maxPosts: 25,
 * });
 * ```
 */
export async function scrapeFacebookPosts(inputPayload, options = {}) {
    return runApifyActor('apify~facebook-posts-scraper', inputPayload, options);
}
/**
 * Scrapes the Meta / Facebook Ads Library using the
 * `leadsbrary~meta-ads-library-scraper` actor.
 *
 * @param inputPayload - Actor input. Common fields:
 *   - `searchTerms`  — Keywords or page names to search for.
 *   - `country`      — Country code (e.g. `"IN"`, `"US"`).
 *   - `adType`       — `"all"` | `"political_and_issue_ads"` | `"housing"` etc.
 *   - `maxItems`     — Maximum number of ads to return.
 *   - `proxyConfiguration` — Proxy settings.
 *
 * @param options - Optional query-parameter overrides (timeout, memory, etc.).
 *
 * @returns Array of scraped ad objects. Each item typically contains:
 *   - `adId`, `pageId`, `pageName`, `adCreationTime`, `adCreativeBody`,
 *     `adCreativeLinkCaption`, `adCreativeLinkTitle`, `estimatedAudience`,
 *     `impressions`, `spend`, `media`.
 *
 * @example
 * ```ts
 * const ads = await scrapeMetaAds({
 *   searchTerms: 'Jaya Laxmi',
 *   country: 'IN',
 *   adType: 'all',
 *   maxItems: 50,
 * });
 * ```
 */
export async function scrapeMetaAds(inputPayload, options = {}) {
    return runApifyActor('leadsbrary~meta-ads-library-scraper', inputPayload, options);
}
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
/** Safely parse an error response body from Apify. */
async function parseErrorBody(response) {
    try {
        return (await response.json());
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=apifyService.js.map