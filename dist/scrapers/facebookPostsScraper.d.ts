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
export declare function scrapeCompetitorFacebookPosts(competitors: CompetitorInput[]): Promise<CompetitorScrapeResult[]>;
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
export declare function filterRecentPosts(posts: NormalizedPost[], daysBack?: number): NormalizedPost[];
//# sourceMappingURL=facebookPostsScraper.d.ts.map