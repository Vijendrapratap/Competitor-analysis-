import { NormalizedPost } from '../scrapers/facebookPostsScraper.js';
import { NormalizedAd } from '../scrapers/metaAdsScraper.js';
export interface AggregatedCompetitorInput {
    name: string;
    facebookPageUrl: string;
    searchTerms?: string[];
}
export interface CompetitorSummary {
    totalPostsFound: number;
    totalAdsFound: number;
    activeAdsCount: number;
    avgEngagementPerPost: number;
    topPerformingPost: {
        text: string;
        likes: number;
        comments: number;
        shares: number;
        postUrl: string;
        postDate: string | null;
    } | null;
    mostRecentAdDate: string | null;
}
export interface AggregatedCompetitorData {
    competitorName: string;
    scrapedAt: string;
    summary: CompetitorSummary;
    recentPosts: NormalizedPost[];
    activeAds: NormalizedAd[];
    adsByCategory: {
        promotional: NormalizedAd[];
        branding: NormalizedAd[];
        direct_response: NormalizedAd[];
    };
    errors: string[];
}
/**
 * Calls both Apify scrapers in parallel, merges results by competitor name,
 * and returns a unified structure per competitor.
 */
export declare function aggregateCompetitorData(competitors: AggregatedCompetitorInput[]): Promise<AggregatedCompetitorData[]>;
/**
 * Condenses the full aggregated dataset into a text/JSON payload optimized
 * for sending to Claude AI for analysis. Keeps under ~4000 tokens per competitor.
 */
export declare function prepareAnalysisPayload(aggregatedData: AggregatedCompetitorData[]): {
    generatedAt: string;
    totalCompetitors: number;
    competitors: {
        competitorName: string;
        postThemes: {
            theme: string;
            postCount: number;
        }[];
        adCopySamples: {
            headline: string;
            text: string;
            cta: string;
            platforms: string;
        }[];
        engagementHighlights: {
            avgEngagement: number;
            totalPosts: number;
            recentPostCount: number;
            topPost: string;
        };
        adActivity: {
            totalAds: number;
            activeAds: number;
            categories: {
                promotional: number;
                branding: number;
                directResponse: number;
            };
            mostRecentAdDate: string | null;
        };
        errors: string[];
    }[];
    analysisPromptHint: string;
};
/**
 * Builds a comparison table structure across all competitors.
 */
export declare function buildCompetitorComparison(aggregatedData: AggregatedCompetitorData[]): {
    generatedAt: string;
    totalCompetitors: number;
    marketSummary: {
        totalPostsAcrossAll: number;
        totalAdsAcrossAll: number;
        totalActiveAds: number;
        marketAvgEngagement: number;
    };
    competitors: {
        competitorName: string;
        postingFrequency: {
            postsLast7Days: number;
            label: string;
        };
        engagement: {
            avgPerPost: number;
            label: string;
        };
        adActivity: {
            totalAds: number;
            activeAds: number;
            inactiveAds: number;
            newCampaignsLast7Days: number;
            hasNewCampaigns: boolean;
        };
        topAdCategories: {
            category: string;
            count: number;
        }[];
        errors: string[];
    }[];
};
//# sourceMappingURL=competitorAggregator.d.ts.map