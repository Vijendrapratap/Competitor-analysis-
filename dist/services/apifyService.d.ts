/** Optional query-parameter overrides for an Apify actor run. */
export interface ApifyRunOptions {
    /** Timeout in seconds (default: 300, Apify's max for sync runs). */
    timeout?: number;
    /** Actor memory allocation in MB (e.g. 256, 512, 1024, 2048, 4096). */
    memory?: number;
    /** Maximum number of items to return from the dataset. */
    maxItems?: number;
    /** Limit the number of returned items (pagination). */
    limit?: number;
    /** Skip the first N items (pagination). */
    offset?: number;
    /** Comma-separated list of fields to include in each item. */
    fields?: string;
}
/**
 * Validates that the `APIFY_API_TOKEN` environment variable is set.
 *
 * Call this early in your startup sequence (e.g. before any actor run)
 * to fail fast with a clear message instead of getting a cryptic 401.
 *
 * @throws {Error} If `APIFY_API_TOKEN` is missing or empty.
 * @returns The validated token string.
 */
export declare function validateApifyToken(): string;
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
export declare function runApifyActor<T = Record<string, unknown>>(actorId: string, inputPayload: Record<string, unknown>, options?: ApifyRunOptions): Promise<T[]>;
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
export declare function scrapeFacebookPosts<T = Record<string, unknown>>(inputPayload: Record<string, unknown>, options?: ApifyRunOptions): Promise<T[]>;
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
export declare function scrapeMetaAds<T = Record<string, unknown>>(inputPayload: Record<string, unknown>, options?: ApifyRunOptions): Promise<T[]>;
//# sourceMappingURL=apifyService.d.ts.map