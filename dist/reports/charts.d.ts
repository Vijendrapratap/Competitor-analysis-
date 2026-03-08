export interface ShareOfVoiceEntry {
    name: string;
    adCount: number;
    isCustomer?: boolean;
}
export interface HealthScoreEntry {
    name: string;
    totalScore: number;
    paidScore: number;
    organicScore: number;
    isCustomer?: boolean;
}
export interface TrendLineEntry {
    keyword: string;
    dataPoints: Array<{
        date: string;
        value: number;
    }>;
}
export interface SegmentEntry {
    segment: string;
    count: number;
}
export interface EngagementEntry {
    name: string;
    engagementRate: number;
    followers: number;
    isCustomer?: boolean;
}
export interface PostFrequencyEntry {
    name: string;
    postsLast30d: number;
    isCustomer?: boolean;
}
export declare class ChartGenerator {
    private readonly width;
    private readonly height;
    constructor(width?: number, height?: number);
    private renderToDataUrl;
    shareOfVoicePie(entries: ShareOfVoiceEntry[]): Promise<string>;
    healthScoreBars(entries: HealthScoreEntry[]): Promise<string>;
    trendLines(entries: TrendLineEntry[]): Promise<string>;
    segmentDistribution(entries: SegmentEntry[]): Promise<string>;
    engagementComparison(entries: EngagementEntry[]): Promise<string>;
    postingFrequency(entries: PostFrequencyEntry[]): Promise<string>;
    generateAll(data: {
        shareOfVoice?: ShareOfVoiceEntry[];
        healthScores?: HealthScoreEntry[];
        trendLines?: TrendLineEntry[];
        segments?: SegmentEntry[];
        engagement?: EngagementEntry[];
        postFrequency?: PostFrequencyEntry[];
    }): Promise<Record<string, string>>;
}
//# sourceMappingURL=charts.d.ts.map