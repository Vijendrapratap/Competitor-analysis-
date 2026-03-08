import type { Competitor, NewAd, ScrapeResult } from '../types/index.js';
export declare class MetaAdsScraper {
    private browser;
    private readonly screenshotsDir;
    private readonly maxAdsPerCompetitor;
    private readonly headless;
    private readonly timeoutMs;
    private readonly maxRetries;
    private readonly requestDelayMs;
    constructor();
    init(): Promise<void>;
    close(): Promise<void>;
    scrapeAll(competitors: Competitor[]): Promise<Map<number, ScrapeResult<NewAd[]>>>;
    scrapeCompetitor(competitor: Competitor): Promise<NewAd[]>;
    private scrapeCompetitorSafe;
    private scrapeCompetitorImpl;
    private createContext;
    private setupPageStealth;
    private dismissDialogs;
    private checkNoAds;
    private scrollToLoadAds;
    private extractAdsFromPage;
    private extractSingleAd;
    private extractLibraryId;
    private extractStartedRunning;
    private extractPlatforms;
    private extractVariationsCount;
    private detectCreativeType;
    private extractAdCopy;
    private extractCta;
    private extractLandingUrl;
    private extractPrice;
    private extractDiscount;
    private detectLanguage;
    private takeAdScreenshot;
    private buildAdsLibraryUrl;
}
//# sourceMappingURL=metaAds.d.ts.map