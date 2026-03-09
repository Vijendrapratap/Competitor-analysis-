// =============================================================================
// Competitor Intelligence System — Shared TypeScript Types
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export enum PriceTier {
  Budget = 'budget',
  MidRange = 'mid-range',
  Premium = 'premium',
  Luxury = 'luxury',
}

export enum CreativeType {
  Image = 'image',
  Video = 'video',
  Carousel = 'carousel',
  DynamicAd = 'dynamic_ad',
  StoryAd = 'story_ad',
  ReelsAd = 'reels_ad',
  Unknown = 'unknown',
}

export enum Platform {
  Facebook = 'facebook',
  Instagram = 'instagram',
  MessengerInbox = 'messenger_inbox',
  AudienceNetwork = 'audience_network',
}

export enum CtaType {
  BookNow = 'BOOK_NOW',
  LearnMore = 'LEARN_MORE',
  GetOffer = 'GET_OFFER',
  ShopNow = 'SHOP_NOW',
  ContactUs = 'CONTACT_US',
  SignUp = 'SIGN_UP',
  Subscribe = 'SUBSCRIBE',
  WatchMore = 'WATCH_MORE',
  MessagePage = 'MESSAGE_PAGE',
  NoButton = 'NO_BUTTON',
  Unknown = 'UNKNOWN',
}

export enum PostType {
  Photo = 'photo',
  Video = 'video',
  Reel = 'reel',
  Story = 'story',
  Link = 'link',
  Text = 'text',
  Event = 'event',
  LiveVideo = 'live_video',
  Unknown = 'unknown',
}

export enum ThreatLevel {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export enum Trend {
  Rising = 'rising',
  Stable = 'stable',
  Declining = 'declining',
  New = 'new',
}

export enum AlertType {
  NewCampaign = 'new_campaign',
  PriceChange = 'price_change',
  HighAdVolume = 'high_ad_volume',
  ViralContent = 'viral_content',
  NewCompetitor = 'new_competitor',
  ThreatEscalation = 'threat_escalation',
  EngagementSpike = 'engagement_spike',
  PageMilestone = 'page_milestone',
}

export enum AlertSeverity {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
}

export enum RecommendationPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

export enum ContentCategory {
  Promotion = 'promotion',
  Brand = 'brand',
  Product = 'product',
  Educational = 'educational',
  Testimonial = 'testimonial',
  Event = 'event',
  UserGenerated = 'user_generated',
  Seasonal = 'seasonal',
  Unknown = 'unknown',
}

export enum PricePosition {
  Cheapest = 'cheapest',
  BelowAverage = 'below_average',
  Average = 'average',
  AboveAverage = 'above_average',
  Premium = 'premium',
}

export enum TrendSource {
  GoogleTrends = 'google_trends',
  FacebookInsights = 'facebook_insights',
  MetaAdsLibrary = 'meta_ads_library',
  Manual = 'manual',
}

// ── NEW ENUMS (002_schema_enhancements) ──────────────────────────────────────

export enum SpendTier {
  Heavy = 'heavy',
  Moderate = 'moderate',
  Light = 'light',
  Dark = 'dark',
}

export enum PositioningSimilarity {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum AdCategoryTag {
  RoomPromo = 'room_promo',
  Wedding = 'wedding',
  Family = 'family',
  Fnb = 'fnb',
  BrandAwareness = 'brand_awareness',
  Wellness = 'wellness',
  Pets = 'pets',
  Seasonal = 'seasonal',
  Mice = 'mice',
  Romance = 'romance',
  EarlyBird = 'early_bird',
  Other = 'other',
}

export enum CreativeTypeEnum {
  Image = 'image',
  Video = 'video',
  Carousel = 'carousel',
  Collection = 'collection',
}

export enum RoiConfidence {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum MediaType {
  Photo = 'photo',
  Video = 'video',
  Reel = 'reel',
  Carousel = 'carousel',
  Link = 'link',
  Text = 'text',
}

export enum CompetitorSegmentName {
  Family = 'family',
  Couples = 'couples',
  Weddings = 'weddings',
  Mice = 'mice',
  Wellness = 'wellness',
  Pets = 'pets',
  ThaiResidents = 'thai_residents',
  International = 'international',
  Solo = 'solo',
}

export enum ReportAlertSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Info = 'info',
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Domain Interfaces
// ─────────────────────────────────────────────────────────────────────────────

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
  // ── NEW FIELDS (002_schema_enhancements) ────────────────────────────────
  /** Cached health score from latest analysis */
  cachedHealthScore: number | null;
  /** Cached share of voice from latest analysis */
  cachedShareOfVoice: number | null;
  /** Cached threat level from latest analysis */
  cachedThreatLevel: ThreatLevel | null;
  /** Positioning similarity to client: 'high' | 'medium' | 'low' */
  positioningSimilarity: PositioningSimilarity | null;
  /** Estimated daily ad spend, e.g. "$50-100/day" */
  estimatedDailySpend: string | null;
  /** Ad spend tier classification */
  spendTier: SpendTier | null;
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
  // ── NEW FIELDS (002_schema_enhancements) ────────────────────────────────
  /** Archive ID from Meta (mirrors metaAdId) */
  adArchiveId: string | null;
  /** Ad body text (supplement to adCopy) */
  adText: string | null;
  /** Array of creative body text variations */
  adCreativeBodies: string[] | null;
  /** Array of publisher platforms (e.g. ['facebook', 'instagram']) */
  publisherPlatforms: string[] | null;
  /** Ad status: 'active', 'inactive', etc */
  adStatus: string | null;
  /** Ad start date (more explicit than startedRunning) */
  startDate: Date | null;
  /** Ad end date */
  endDate: Date | null;
  /** When the ad was created/authored */
  adCreationTime: Date | null;
  /** Estimated audience reach */
  estimatedAudienceSize: string | null;
  /** CTA domain / landing host */
  ctaDomain: string | null;
  /** CTA headline text */
  ctaHeadline: string | null;
  /** CTA description text */
  ctaDescription: string | null;
  /** URL to ad snapshot/preview image */
  adSnapshotUrl: string | null;
  /** URL to ad in Meta Ads Library */
  adLibraryUrl: string | null;
  /** Creative type enum: 'image' | 'video' | 'carousel' | 'collection' */
  creativeTypeEnum: CreativeTypeEnum | null;
  /** Ad category tag for segmentation */
  categoryTag: AdCategoryTag | null;
  /** Extracted price as display string (e.g. "THB 4,750") */
  extractedPriceStr: string | null;
  /** Discount depth extracted from ad (e.g. "25% off") */
  discountDepth: string | null;
  /** True if this ad has >= 3 variations (high marketing focus) */
  isHighFocus: boolean | null;
  /** Expected ROI confidence based on metrics */
  roiConfidence: RoiConfidence | null;
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
  // ── NEW FIELDS (002_schema_enhancements) ────────────────────────────────
  /** Specific like count (vs reactions = total) */
  likes: number | null;
  /** Total post impressions/views */
  viewsCount: number | null;
  /** Count of like reactions specifically */
  reactionLikeCount: number | null;
  /** Count of love reactions */
  reactionLoveCount: number | null;
  /** Count of wow reactions */
  reactionWowCount: number | null;
  /** Count of haha/laugh reactions */
  reactionHahaCount: number | null;
  /** Count of care reactions */
  reactionCareCount: number | null;
  /** Media type classification */
  mediaType: MediaType | null;
  /** URL to post thumbnail/preview image */
  thumbnailUrl: string | null;
  /** Engagement score: (likes + comments*2 + shares*3) / followers * 100 */
  engagementScore: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis & Scoring
// ─────────────────────────────────────────────────────────────────────────────

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
  score: number;       // 0–100
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
    // Paid
    adVolume: ScoreComponent;
    adFreshness: ScoreComponent;
    adCreativity: ScoreComponent;
    adPlatformCoverage: ScoreComponent;
    // Organic
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

// ─────────────────────────────────────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Trends
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Recommendations
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Report Payload
// ─────────────────────────────────────────────────────────────────────────────

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

  // ── Aggregates ─────────────────────────────────────────────────────────────
  marketOverview: MarketOverview;

  // ── Per-competitor detail ─────────────────────────────────────────────────
  competitors: CompetitorSummary[];

  // ── Rankings ──────────────────────────────────────────────────────────────
  healthScoreRankings: Array<{
    rank: number;
    competitorName: string;
    totalScore: number;
    paidScore: number;
    organicScore: number;
    trend: Trend;
  }>;

  // ── Alerts & Recommendations ──────────────────────────────────────────────
  criticalAlerts: Alert[];
  recommendations: Recommendation[];
  trends: TrendData[];

  // ── Charts (paths to pre-rendered PNGs) ───────────────────────────────────
  charts: {
    healthScoreComparison?: string;
    shareOfVoice?: string;
    adVolumeTimeline?: string;
    engagementRates?: string;
    threatLevels?: string;
  };

  // ── Report metadata ───────────────────────────────────────────────────────
  pdfPath?: string;
  emailSentTo?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline / Runner
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Scraper internal types
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Database row types (raw, before domain mapping)
// ─────────────────────────────────────────────────────────────────────────────

export type NewCompetitor = Omit<Competitor, 'id' | 'createdAt' | 'updatedAt'>;
export type NewAd = Omit<Ad, 'id'>;
export type NewFacebookPageMetrics = Omit<FacebookPageMetrics, 'id'>;
export type NewFacebookPost = Omit<FacebookPost, 'id'>;
export type NewAnalysis = Omit<Analysis, 'id'>;
export type NewAlert = Omit<Alert, 'id' | 'createdAt' | 'sentAt'>;
export type NewTrendData = Omit<TrendData, 'id'>;

// ─────────────────────────────────────────────────────────────────────────────
// Report System Types (Prompt 12)
// ─────────────────────────────────────────────────────────────────────────────

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
export interface ReportListItem
  extends Omit<Report, 'htmlContent' | 'metadata'> {
  metadata: Pick<
    ReportMetadata,
    'marketStatus' | 'biggestOpportunity' | 'biggestThreat'
  >;
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
  trendDirections: Record<
    string, 'gaining' | 'stable' | 'declining' | 'dark'
  >;
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

// ─────────────────────────────────────────────────────────────────────────────
// NEW TABLES (002_schema_enhancements)
// ─────────────────────────────────────────────────────────────────────────────

/** Daily market-wide snapshot for trend analysis */
export interface MarketSnapshot {
  id: number;
  snapshotDate: Date;
  totalActiveAds: number;
  activeAdvertisers: number;
  marketLeaderId: number | null;
  totalCompetitors: number;
  clientAdCount: number;
  /** Client share of voice as percentage 0–100 */
  clientSov: number | null;
  createdAt: Date;
}

export type NewMarketSnapshot = Omit<MarketSnapshot, 'id' | 'createdAt'>;

/** Competitor targeting segment classification */
export interface CompetitorSegment {
  id: number;
  competitorId: number;
  segmentName: CompetitorSegmentName;
  isActive: boolean;
  createdAt: Date;
}

export type NewCompetitorSegment = Omit<CompetitorSegment, 'id' | 'createdAt'>;

/** Report-level alert for dashboard */
export interface ReportAlert {
  id: number;
  alertDate: Date;
  severity: ReportAlertSeverity;
  competitorId: number | null;
  alertType: string;
  message: string;
  messageThai: string | null;
  isActionable: boolean;
  createdAt: Date;
}

export type NewReportAlert = Omit<ReportAlert, 'id' | 'createdAt'>;
