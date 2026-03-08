import type { Competitor, NewFacebookPageMetrics, ScrapeResult } from '../types/index.js';
export declare class FacebookPageScraper {
    private browser;
    private readonly headless;
    private readonly timeoutMs;
    private readonly maxRetries;
    private readonly requestDelayMs;
    constructor();
    init(): Promise<void>;
    close(): Promise<void>;
    scrapeAll(competitors: Competitor[]): Promise<Map<number, ScrapeResult<NewFacebookPageMetrics>>>;
    scrapePage(competitor: Competitor): Promise<NewFacebookPageMetrics>;
    private scrapePageSafe;
    private scrapePageImpl;
    private createContext;
    private setupPageStealth;
    private dismissDialogs;
    private isPageBlocked;
    private extractFollowers;
    private extractPageLikes;
    private extractRatingAndReviews;
    private extractLastPostDate;
    /**
     * Count visible posts on the page timeline. This gives an approximate
     * count of posts in the last 30 days (limited by what's loaded).
     */
    private countRecentPosts;
    /**
     * Estimate average engagement rate from visible posts.
     * engagement rate = (reactions + comments + shares) / followers * 100
     *
     * This is a rough estimate based on the first few visible posts.
     */
    private estimateEngagementRate;
    /**
     * Parse total engagement (reactions + comments + shares) from a post's text.
     */
    private parseEngagementFromText;
    /**
     * Parse a date string that could be relative ("2h", "Yesterday") or
     * absolute ("January 15, 2024", "15 Jan 2024").
     */
    private parseRelativeOrAbsoluteDate;
}
//# sourceMappingURL=facebookPage.d.ts.map