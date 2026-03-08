import { ads, alerts, analyses, competitors, facebookPages, facebookPosts, reports, trends } from './schema.js';
import type { Ad, Alert, Analysis, Competitor, FacebookPageMetrics, FacebookPost, MarketOverview, TrendData } from '../types/index.js';
export declare function getCompetitors(): Promise<Competitor[]>;
export declare function getCompetitorById(id: number): Promise<Competitor | null>;
export declare function getCompetitorByName(name: string): Promise<Competitor | null>;
export declare function getCustomer(): Promise<Competitor | null>;
export declare function insertCompetitor(data: typeof competitors.$inferInsert): Promise<number>;
export declare function updateCompetitor(id: number, data: Partial<Omit<typeof competitors.$inferInsert, 'id' | 'createdAt'>>): Promise<void>;
export declare function deleteCompetitor(id: number): Promise<void>;
export declare function toggleCompetitorActive(id: number): Promise<boolean>;
export declare function insertAd(data: typeof ads.$inferInsert): Promise<number>;
export declare function insertAds(dataArray: Array<typeof ads.$inferInsert>): Promise<void>;
export declare function getCompetitorAds(competitorId: number, sinceDate?: Date): Promise<Ad[]>;
export declare function getActiveAdsCount(competitorId: number): Promise<number>;
export declare function getTodayAds(): Promise<Ad[]>;
export declare function markAdsInactive(competitorId: number, activeAdIds: string[]): Promise<void>;
export declare function insertPageMetrics(data: typeof facebookPages.$inferInsert): Promise<number>;
export declare function getLatestPageMetrics(competitorId: number): Promise<FacebookPageMetrics | null>;
export declare function insertPost(data: typeof facebookPosts.$inferInsert): Promise<number>;
export declare function getRecentPosts(competitorId: number, days?: number): Promise<FacebookPost[]>;
export declare function insertFollowerHistory(competitorId: number, followers: number): Promise<void>;
export declare function insertAnalysis(data: typeof analyses.$inferInsert): Promise<number>;
export declare function getLatestAnalysis(competitorId: number): Promise<Analysis | null>;
export declare function getTodayAnalyses(): Promise<Analysis[]>;
export declare function getHistoricalAnalysis(competitorId: number, days?: number): Promise<Analysis[]>;
export declare function insertAlert(data: typeof alerts.$inferInsert): Promise<number>;
export declare function getTodayAlerts(): Promise<Alert[]>;
export declare function getUnsentAlerts(): Promise<Alert[]>;
export declare function markAlertSent(alertId: number): Promise<void>;
export declare function insertTrend(data: typeof trends.$inferInsert): Promise<number>;
export declare function getRecentTrends(days?: number): Promise<TrendData[]>;
export declare function insertReport(data: typeof reports.$inferInsert): Promise<number>;
export declare function markReportDelivered(reportDate: Date, deliveredTo?: string[]): Promise<void>;
export interface HealthScoreEntry {
    competitorId: number;
    competitorName: string;
    healthScore: number;
    paidScore: number;
    organicScore: number;
    threatLevel: string;
    trend: string;
    totalActiveAds: number;
    shareOfVoice: number | null;
}
export interface ShareOfVoiceEntry {
    competitorId: number;
    competitorName: string;
    totalActiveAds: number;
    shareOfVoice: number;
}
export declare function getMarketOverview(): Promise<MarketOverview>;
export declare function getHealthLeaderboard(analysisDate?: Date): Promise<HealthScoreEntry[]>;
export declare function getShareOfVoice(): Promise<ShareOfVoiceEntry[]>;
//# sourceMappingURL=queries.d.ts.map