export interface MetaAdsCompetitorInput {
    name: string;
    facebookPageUrl: string;
    searchTerms?: string[];
}
export interface NormalizedAd {
    competitorName: string;
    adId: string;
    adText: string;
    adHeadline: string | null;
    adDescription: string | null;
    callToAction: string | null;
    adStartDate: string | null;
    adEndDate: string | null;
    adStatus: 'active' | 'inactive';
    platforms: string[];
    mediaType: 'image' | 'video' | 'carousel' | 'unknown';
    mediaUrls: string[];
    estimatedReach: string | null;
    spendRange: string | null;
}
export interface CompetitorMetaAdsResult {
    competitorName: string;
    scrapedAt: string;
    ads: NormalizedAd[];
    error?: string;
}
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
export declare function scrapeCompetitorMetaAds(competitors: MetaAdsCompetitorInput[]): Promise<CompetitorMetaAdsResult[]>;
/**
 * Groups an array of normalized ads into three categories based on
 * keyword matching in `adText`, `adHeadline`, and `callToAction`.
 */
export declare function categorizeAdsByType(ads: NormalizedAd[]): {
    promotional: NormalizedAd[];
    branding: NormalizedAd[];
    direct_response: NormalizedAd[];
};
//# sourceMappingURL=metaAdsScraper.d.ts.map