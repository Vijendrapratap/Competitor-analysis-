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
export declare class ScrapeService {
    /**
     * Run all scrapers for all (or filtered) competitors, persist results.
     */
    run(opts?: ScrapeOptions): Promise<ScrapeResult>;
}
//# sourceMappingURL=scrape.d.ts.map