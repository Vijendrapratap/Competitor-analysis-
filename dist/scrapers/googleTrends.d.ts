import type { NewTrendData, ScrapeResult } from '../types/index.js';
export declare class GoogleTrendsFetcher {
    private readonly geo;
    private readonly timeframeDays;
    private readonly requestDelayMs;
    private readonly maxRetries;
    private readonly keywords;
    constructor();
    fetchAllTrends(): Promise<ScrapeResult<NewTrendData[]>>;
    fetchTrends(keywords: string[]): Promise<NewTrendData[]>;
    fetchRelatedQueries(keyword: string): Promise<string[]>;
    private fetchBatchWithRetry;
    private processTimeline;
    private calculateChangePct;
    private callWithRetry;
}
//# sourceMappingURL=googleTrends.d.ts.map