import type { Competitor, NewFacebookPost, ScrapeResult } from '../types/index.js';
export declare class FacebookPostsScraper {
    private browser;
    private readonly headless;
    private readonly timeoutMs;
    private readonly maxRetries;
    private readonly requestDelayMs;
    constructor();
    init(): Promise<void>;
    close(): Promise<void>;
    scrapeAll(competitors: Competitor[], days?: number): Promise<Map<number, ScrapeResult<NewFacebookPost[]>>>;
    scrapePosts(competitor: Competitor, days?: number): Promise<NewFacebookPost[]>;
    private scrapePostsSafe;
    private scrapePostsImpl;
    private createContext;
    private setupPageStealth;
    private dismissDialogs;
    private isPageBlocked;
    private scrollToLoadPosts;
    /**
     * Check if the last visible post's date is older than the cutoff.
     */
    private hasReachedDateCutoff;
    private extractAllPosts;
    private extractSinglePost;
    private extractPostIdAndUrl;
    private extractPostDate;
    private detectPostType;
    private extractPostText;
    private extractReactions;
    private extractComments;
    private extractShares;
    private extractVideoViews;
    /**
     * Categorise post content based on keyword matching.
     * Uses a priority-ordered list; first match wins.
     */
    private categoriseContent;
    /**
     * Detect language: 'en', 'th', or 'bilingual'.
     * Uses Thai Unicode character ratio as a heuristic.
     */
    private detectLanguage;
    /**
     * Calculate engagement score for each post and flag the top 10%
     * as `isTopPerformer`.
     *
     * engagementScore = reactions + (comments * 2) + (shares * 3)
     */
    private scoreAndFlagTopPerformers;
    /**
     * Parse a date string that could be relative ("2h", "Yesterday") or
     * absolute ("January 15, 2024", "15 Jan 2024").
     */
    private parseRelativeOrAbsoluteDate;
}
//# sourceMappingURL=facebookPosts.d.ts.map