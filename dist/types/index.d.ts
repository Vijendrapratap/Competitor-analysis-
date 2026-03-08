export declare enum PriceTier {
    Budget = "budget",
    MidRange = "mid-range",
    Premium = "premium",
    Luxury = "luxury"
}
export declare enum CreativeType {
    Image = "image",
    Video = "video",
    Carousel = "carousel",
    DynamicAd = "dynamic_ad",
    StoryAd = "story_ad",
    ReelsAd = "reels_ad",
    Unknown = "unknown"
}
export declare enum Platform {
    Facebook = "facebook",
    Instagram = "instagram",
    MessengerInbox = "messenger_inbox",
    AudienceNetwork = "audience_network"
}
export declare enum CtaType {
    BookNow = "BOOK_NOW",
    LearnMore = "LEARN_MORE",
    GetOffer = "GET_OFFER",
    ShopNow = "SHOP_NOW",
    ContactUs = "CONTACT_US",
    SignUp = "SIGN_UP",
    Subscribe = "SUBSCRIBE",
    WatchMore = "WATCH_MORE",
    MessagePage = "MESSAGE_PAGE",
    NoButton = "NO_BUTTON",
    Unknown = "UNKNOWN"
}
export declare enum PostType {
    Photo = "photo",
    Video = "video",
    Reel = "reel",
    Story = "story",
    Link = "link",
    Text = "text",
    Event = "event",
    LiveVideo = "live_video",
    Unknown = "unknown"
}
export declare enum ThreatLevel {
    Low = "low",
    Medium = "medium",
    High = "high",
    Critical = "critical"
}
export declare enum Trend {
    Rising = "rising",
    Stable = "stable",
    Declining = "declining",
    New = "new"
}
export declare enum AlertType {
    NewCampaign = "new_campaign",
    PriceChange = "price_change",
    HighAdVolume = "high_ad_volume",
    ViralContent = "viral_content",
    NewCompetitor = "new_competitor",
    ThreatEscalation = "threat_escalation",
    EngagementSpike = "engagement_spike",
    PageMilestone = "page_milestone"
}
export declare enum AlertSeverity {
    Info = "info",
    Warning = "warning",
    Critical = "critical"
}
export declare enum RecommendationPriority {
    Low = "low",
    Medium = "medium",
    High = "high",
    Urgent = "urgent"
}
export declare enum ContentCategory {
    Promotion = "promotion",
    Brand = "brand",
    Product = "product",
    Educational = "educational",
    Testimonial = "testimonial",
    Event = "event",
    UserGenerated = "user_generated",
    Seasonal = "seasonal",
    Unknown = "unknown"
}
export declare enum PricePosition {
    Cheapest = "cheapest",
    BelowAverage = "below_average",
    Average = "average",
    AboveAverage = "above_average",
    Premium = "premium"
}
export declare enum TrendSource {
    GoogleTrends = "google_trends",
    FacebookInsights = "facebook_insights",
    MetaAdsLibrary = "meta_ads_library",
    Manual = "manual"
}
export interface Competitor {
    id: number;
    name: string;
    /** Facebook page slug or numeric ID (e.g. "samui.w.samui" or "123456789") */
    facebookPageId: string;
    facebookPageUrl: string;
    adsLibraryUrl: string;
    /** Business vertical / market segment */
    category: string;
    priceTier: PriceTier;
    /** Whether this competitor is also a customer of ours */
    isCustomer: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface Ad {
    id: number;
    competitorId: number;
    /** Unique ID assigned by Meta Ads Library */
    metaAdId: string;
    startedRunning: Date | null;
    isActive: boolean;
    platforms: Platform[];
    creativeType: CreativeType;
    adCopy: string | null;
    headline: string | null;
    ctaType: CtaType;
    landingUrl: string | null;
    /** Total number of creative variations in this ad set */
    adVariationsCount: number;
    extractedPrice: number | null;
    extractedDiscount: number | null;
    /** ISO 639-1 language code (e.g. "en", "th") */
    language: string | null;
    screenshotPath: string | null;
    scrapedAt: Date;
}
export interface FacebookPageMetrics {
    id: number;
    competitorId: number;
    pageUrl: string;
    followers: number | null;
    pageLikes: number | null;
    rating: number | null;
    reviewCount: number | null;
    postsLast30d: number | null;
    avgEngagementRate: number | null;
    lastPostDate: Date | null;
    scrapedAt: Date;
}
export interface FacebookPost {
    id: number;
    competitorId: number;
    /** Platform-native post identifier */
    postId: string;
    postUrl: string;
    postType: PostType;
    postText: string | null;
    postedAt: Date | null;
    reactions: number;
    comments: number;
    shares: number;
    videoViews: number | null;
    contentCategory: ContentCategory;
    /** ISO 639-1 language code */
    language: string | null;
    isTopPerformer: boolean;
    scrapedAt: Date;
}
export interface AdType {
    type: CreativeType;
    count: number;
    percentage: number;
}
export interface TargetSegment {
    segment: string;
    confidence: 'low' | 'medium' | 'high';
    evidence: string[];
}
/** Per-dimension breakdown used inside HealthScore */
export interface ScoreComponent {
    score: number;
    maxScore: number;
    label: string;
    explanation: string;
}
export interface HealthScore {
    competitorId: number;
    competitorName: string;
    /** Weighted composite (0–100) */
    totalScore: number;
    /** Paid-media sub-score (0–100) */
    paidScore: number;
    /** Organic-media sub-score (0–100) */
    organicScore: number;
    components: {
        adVolume: ScoreComponent;
        adFreshness: ScoreComponent;
        adCreativity: ScoreComponent;
        adPlatformCoverage: ScoreComponent;
        postFrequency: ScoreComponent;
        engagementRate: ScoreComponent;
        contentDiversity: ScoreComponent;
        audienceSize: ScoreComponent;
    };
    calculatedAt: Date;
}
export interface PricingData {
    roomRates: RoomRate[];
    discounts: Discount[];
    packagePrices: PackagePrice[];
    currency: string;
    pricePosition: PricePosition;
    lowestRate: number | null;
    highestRate: number | null;
    averageRate: number | null;
}
export interface RoomRate {
    roomType: string;
    pricePerNight: number;
    currency: string;
    source: string;
    extractedAt: Date;
}
export interface Discount {
    description: string;
    discountPct: number | null;
    absoluteDiscount: number | null;
    currency: string | null;
    validUntil: Date | null;
}
export interface PackagePrice {
    name: string;
    price: number;
    currency: string;
    inclusions: string[];
}
export interface Analysis {
    id: number;
    competitorId: number;
    analysisDate: Date;
    totalActiveAds: number;
    newestAdDate: Date | null;
    adTypes: AdType[];
    targetSegments: TargetSegment[];
    pricingData: PricingData | null;
    /** Narrative summary in English */
    marketingStrategyEn: string | null;
    /** Narrative summary in Thai */
    marketingStrategyTh: string | null;
    /** Key unique selling proposition in English */
    keyUspEn: string | null;
    /** Key unique selling proposition in Thai */
    keyUspTh: string | null;
    healthScore: number;
    paidScore: number;
    organicScore: number;
    threatLevel: ThreatLevel;
    trend: Trend;
    /** Estimated share of paid-media voice (0–100) */
    shareOfVoice: number | null;
}
export interface Alert {
    id: number;
    alertDate: Date;
    alertType: AlertType;
    severity: AlertSeverity;
    competitorId: number;
    competitorName?: string;
    title: string;
    description: string;
    actionRequired: string | null;
    isSent: boolean;
    sentAt: Date | null;
    createdAt: Date;
}
export interface TrendData {
    id: number;
    trendDate: Date;
    source: TrendSource;
    keyword: string;
    value: number;
    /** Percentage change vs previous period (positive = growth) */
    changePct: number | null;
    metadata: Record<string, unknown>;
}
export interface Recommendation {
    priority: RecommendationPriority;
    title: string;
    description: string;
    actionItems: string[];
    estimatedImpact: string;
    relatedCompetitors: Array<{
        id: number;
        name: string;
    }>;
}
export interface CompetitorSummary {
    competitor: Competitor;
    latestAnalysis: Analysis | null;
    healthScore: HealthScore | null;
    topAds: Ad[];
    topPosts: FacebookPost[];
    pageMetrics: FacebookPageMetrics | null;
    recentAlerts: Alert[];
}
export interface MarketOverview {
    totalCompetitors: number;
    activeCompetitors: number;
    totalActiveAds: number;
    avgHealthScore: number;
    avgShareOfVoice: number;
    threatDistribution: Record<ThreatLevel, number>;
    trendDistribution: Record<Trend, number>;
}
export interface ChartDataset {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
}
export interface ChartConfig {
    type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'horizontalBar';
    title: string;
    labels: string[];
    datasets: ChartDataset[];
    /** Absolute path where the chart PNG will be written */
    outputPath: string;
}
export interface ReportData {
    /** ISO date string (YYYY-MM-DD) */
    reportDate: string;
    reportTitle: string;
    generatedAt: Date;
    /** Reporting window covered by this report */
    periodStart: Date;
    periodEnd: Date;
    marketOverview: MarketOverview;
    competitors: CompetitorSummary[];
    healthScoreRankings: Array<{
        rank: number;
        competitorName: string;
        totalScore: number;
        paidScore: number;
        organicScore: number;
        trend: Trend;
    }>;
    criticalAlerts: Alert[];
    recommendations: Recommendation[];
    trends: TrendData[];
    charts: {
        healthScoreComparison?: string;
        shareOfVoice?: string;
        adVolumeTimeline?: string;
        engagementRates?: string;
        threatLevels?: string;
    };
    pdfPath?: string;
    emailSentTo?: string[];
}
export interface PipelineResult {
    stage: 'scrape' | 'analyze' | 'generate' | 'deliver';
    success: boolean;
    durationMs: number;
    details: string;
    error?: string;
}
export interface RunOptions {
    /** Limit run to specific competitor IDs */
    competitorIds?: number[];
    /** Skip email delivery even if configured */
    dryRun?: boolean;
    /** Force re-scrape even if data is fresh */
    force?: boolean;
}
export interface ScrapeResult<T> {
    success: boolean;
    data: T | null;
    error: string | null;
    durationMs: number;
    retries: number;
}
export interface PageScrapeConfig {
    url: string;
    competitorId: number;
    maxRetries?: number;
    timeoutMs?: number;
    waitForSelector?: string;
}
export type NewCompetitor = Omit<Competitor, 'id' | 'createdAt' | 'updatedAt'>;
export type NewAd = Omit<Ad, 'id'>;
export type NewFacebookPageMetrics = Omit<FacebookPageMetrics, 'id'>;
export type NewFacebookPost = Omit<FacebookPost, 'id'>;
export type NewAnalysis = Omit<Analysis, 'id'>;
export type NewAlert = Omit<Alert, 'id' | 'createdAt' | 'sentAt'>;
export type NewTrendData = Omit<TrendData, 'id'>;
/** Full report database row */
export interface Report {
    id: number;
    reportUuid: string;
    title: string;
    clientName: string | null;
    marketLocation: string;
    reportMonth: number;
    reportYear: number;
    reportDate: Date;
    competitorsCount: number;
    activeAdvertisers: number;
    totalActiveAds: number;
    htmlContent: string;
    metadata: ReportMetadata;
    generatedBy: string;
    llmModelUsed: string;
    generationTimeSec: number | null;
    status: 'active' | 'archived' | 'deleted';
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}
/** Report list item — no htmlContent for performance */
export interface ReportListItem extends Omit<Report, 'htmlContent' | 'metadata'> {
    metadata: Pick<ReportMetadata, 'marketStatus' | 'biggestOpportunity' | 'biggestThreat'>;
}
/** Intelligence summary stored in reports.metadata JSONB */
export interface ReportMetadata {
    marketStatus: 'heating_up' | 'hot' | 'stable' | 'cooling';
    marketStatusDetail: string;
    top3Insights: string[];
    biggestOpportunity: string;
    biggestThreat: string;
    recommendedUrgentActions: string[];
    healthScores: Record<string, number>;
    shareOfVoice: Record<string, number>;
    trendDirections: Record<string, 'gaining' | 'stable' | 'declining' | 'dark'>;
    segmentMatrix: Record<string, SegmentInfo>;
}
export interface SegmentInfo {
    activeCompetitors: number;
    saturation: 'HIGH' | 'MEDIUM' | 'LOW';
    opportunity: 'HIGH' | 'MEDIUM' | 'LOW';
}
/** Per-competitor snapshot stored in report_competitors */
export interface ReportCompetitor {
    id: number;
    reportId: number;
    competitorName: string;
    facebookPageId: string | null;
    facebookPageUrl: string | null;
    totalActiveAds: number;
    healthScore: number | null;
    budgetTier: string | null;
    threatLevel: string | null;
    isNewEntrant: boolean;
    isMarketLeader: boolean;
    newestAdDate: Date | null;
    adTypes: string[];
    targetSegments: string[];
    keyUspEn: string | null;
    marketingStrategyEn: string | null;
    pricingInfo: string | null;
    languageSplit: string | null;
    estimatedAdSpend: string | null;
    competitorHtml: string | null;
    createdAt: Date;
}
/** Input shape for creating a new report */
export interface CreateReportInput {
    title: string;
    clientName?: string;
    marketLocation?: string;
    reportMonth: number;
    reportYear: number;
    reportDate?: Date;
    competitorsCount: number;
    activeAdvertisers: number;
    totalActiveAds: number;
    htmlContent: string;
    metadata: ReportMetadata;
    generatedBy?: string;
    llmModelUsed?: string;
    generationTimeSec?: number;
    competitors: CreateCompetitorInput[];
}
/** Input shape for creating a competitor snapshot */
export interface CreateCompetitorInput {
    competitorName: string;
    facebookPageId?: string;
    facebookPageUrl?: string;
    totalActiveAds: number;
    healthScore?: number;
    budgetTier?: string;
    threatLevel?: string;
    isNewEntrant?: boolean;
    isMarketLeader?: boolean;
    newestAdDate?: Date;
    adTypes?: string[];
    targetSegments?: string[];
    keyUspEn?: string;
    marketingStrategyEn?: string;
    pricingInfo?: string;
    languageSplit?: string;
    estimatedAdSpend?: string;
    competitorHtml?: string;
}
/** Filters for listing reports */
export interface ListReportsFilters {
    clientName?: string;
    status?: string;
    year?: number;
    month?: number;
    limit?: number;
    offset?: number;
}
//# sourceMappingURL=index.d.ts.map