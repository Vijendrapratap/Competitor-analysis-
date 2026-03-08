// API client for the Competitor Intel backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function apiFetch<T = unknown>(
    path: string,
    options?: RequestInit
): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
    }

    return res.json();
}

export const api = {
    // Competitors
    getCompetitors: () => apiFetch<{ data: Competitor[] }>('/competitors'),
    getCompetitor: (id: number) => apiFetch<{ data: CompetitorDetail }>(`/competitors/${id}`),
    createCompetitor: (data: Partial<Competitor>) =>
        apiFetch<{ data: { id: number } }>('/competitors', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updateCompetitor: (id: number, data: Partial<Competitor>) =>
        apiFetch<{ data: Competitor }>(`/competitors/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    deleteCompetitor: (id: number) =>
        apiFetch<{ message: string }>(`/competitors/${id}`, {
            method: 'DELETE',
        }),
    toggleCompetitor: (id: number) =>
        apiFetch<{ data: { isActive: boolean } }>(`/competitors/${id}/toggle`, {
            method: 'PATCH',
        }),

    // Pipeline
    runPipeline: (stages?: string[], competitorIds?: number[], dryRun?: boolean) =>
        apiFetch<{ data: { runId: string; status: string } }>('/pipeline/run', {
            method: 'POST',
            body: JSON.stringify({ stages, competitorIds, dryRun }),
        }),
    getPipelineStatus: (runId: string) =>
        apiFetch<{ data: PipelineRun }>(`/pipeline/status/${runId}`),
    getPipelineRuns: () => apiFetch<{ data: PipelineRun[] }>('/pipeline/runs'),
    triggerScrape: (competitorIds?: number[]) =>
        apiFetch('/pipeline/scrape', { method: 'POST', body: JSON.stringify({ competitorIds }) }),
    triggerAnalysis: (competitorIds?: number[]) =>
        apiFetch('/pipeline/analyze', { method: 'POST', body: JSON.stringify({ competitorIds }) }),
    triggerReport: () =>
        apiFetch('/pipeline/generate', { method: 'POST', body: JSON.stringify({}) }),

    // Health & Market
    getHealth: () => apiFetch<{ status: string; uptime: number }>('/health'),
    getMarketOverview: () => apiFetch<{ data: MarketOverview }>('/health/market'),
    getLeaderboard: () => apiFetch<{ data: LeaderboardEntry[] }>('/health/leaderboard'),
    getShareOfVoice: () => apiFetch<{ data: SovEntry[] }>('/health/sov'),
    getTrends: (days?: number) => apiFetch<{ data: TrendData[] }>(`/health/trends?days=${days || 30}`),

    // Alerts
    getAlerts: (filter?: string) =>
        apiFetch<{ data: Alert[]; total: number }>(`/alerts${filter ? `?filter=${filter}` : ''}`),
    acknowledgeAlert: (id: number) =>
        apiFetch(`/alerts/${id}/acknowledge`, { method: 'POST' }),

    // Reports
    getReports: () => apiFetch<{ data: Report[] }>('/reports'),
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface Competitor {
    id: number;
    name: string;
    facebookPageId: string | null;
    facebookPageUrl: string | null;
    adsLibraryUrl: string | null;
    category: string;
    priceTier: string;
    isCustomer: boolean;
    isActive: boolean;
}

export interface CompetitorDetail extends Competitor {
    ads: Ad[];
    pageMetrics: PageMetrics | null;
    recentPosts: Post[];
    latestAnalysis: Analysis | null;
}

export interface Ad {
    id: number;
    competitorId: number;
    metaAdId: string;
    isActive: boolean;
    adCopy: string | null;
    creativeType: string | null;
    ctaType: string | null;
    extractedPrice: number | null;
    scrapedAt: string;
}

export interface PageMetrics {
    id: number;
    followers: number;
    pageLikes: number;
    rating: number | null;
    avgEngagementRate: number | null;
}

export interface Post {
    id: number;
    postId: string;
    postText: string | null;
    postedAt: string;
    reactions: number;
    comments: number;
    shares: number;
}

export interface Analysis {
    id: number;
    competitorId: number;
    healthScore: number;
    paidScore: number;
    organicScore: number;
    threatLevel: string;
    analysisDate: string;
}

export interface Alert {
    id: number;
    competitorId: number;
    alertType: string;
    severity: string;
    title: string;
    description: string;
    isSent: boolean;
    createdAt: string;
}

export interface Report {
    id: number;
    reportUuid: string;
    title: string;
    clientName: string | null;
    reportMonth: number;
    reportYear: number;
    reportDate: string;
    competitorsCount: number | null;
    activeAdvertisers: number | null;
    totalActiveAds: number | null;
    status: string;
    createdAt: string;
    marketStatus?: string;
    biggestOpportunity?: string;
    biggestThreat?: string;
}

export interface PipelineRun {
    id: string;
    status: 'running' | 'completed' | 'failed';
    stage: string;
    startedAt: string;
    completedAt: string | null;
    results: Record<string, unknown>;
    error: string | null;
}

export interface MarketOverview {
    totalCompetitors: number;
    totalActiveAds: number;
    totalAlerts: number;
    avgHealthScore: number;
    healthScores: LeaderboardEntry[];
    shareOfVoice: SovEntry[];
}

export interface LeaderboardEntry {
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

export interface SovEntry {
    competitorId: number;
    competitorName: string;
    totalActiveAds: number;
    shareOfVoice: number;
}

export interface TrendData {
    id: number;
    keyword: string;
    interestScore: number;
    region: string;
    scrapedAt: string;
}
