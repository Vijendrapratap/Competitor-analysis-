// =============================================================================
// Competitor Intelligence System — Shared TypeScript Types
// =============================================================================
// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────
export var PriceTier;
(function (PriceTier) {
    PriceTier["Budget"] = "budget";
    PriceTier["MidRange"] = "mid-range";
    PriceTier["Premium"] = "premium";
    PriceTier["Luxury"] = "luxury";
})(PriceTier || (PriceTier = {}));
export var CreativeType;
(function (CreativeType) {
    CreativeType["Image"] = "image";
    CreativeType["Video"] = "video";
    CreativeType["Carousel"] = "carousel";
    CreativeType["DynamicAd"] = "dynamic_ad";
    CreativeType["StoryAd"] = "story_ad";
    CreativeType["ReelsAd"] = "reels_ad";
    CreativeType["Unknown"] = "unknown";
})(CreativeType || (CreativeType = {}));
export var Platform;
(function (Platform) {
    Platform["Facebook"] = "facebook";
    Platform["Instagram"] = "instagram";
    Platform["MessengerInbox"] = "messenger_inbox";
    Platform["AudienceNetwork"] = "audience_network";
})(Platform || (Platform = {}));
export var CtaType;
(function (CtaType) {
    CtaType["BookNow"] = "BOOK_NOW";
    CtaType["LearnMore"] = "LEARN_MORE";
    CtaType["GetOffer"] = "GET_OFFER";
    CtaType["ShopNow"] = "SHOP_NOW";
    CtaType["ContactUs"] = "CONTACT_US";
    CtaType["SignUp"] = "SIGN_UP";
    CtaType["Subscribe"] = "SUBSCRIBE";
    CtaType["WatchMore"] = "WATCH_MORE";
    CtaType["MessagePage"] = "MESSAGE_PAGE";
    CtaType["NoButton"] = "NO_BUTTON";
    CtaType["Unknown"] = "UNKNOWN";
})(CtaType || (CtaType = {}));
export var PostType;
(function (PostType) {
    PostType["Photo"] = "photo";
    PostType["Video"] = "video";
    PostType["Reel"] = "reel";
    PostType["Story"] = "story";
    PostType["Link"] = "link";
    PostType["Text"] = "text";
    PostType["Event"] = "event";
    PostType["LiveVideo"] = "live_video";
    PostType["Unknown"] = "unknown";
})(PostType || (PostType = {}));
export var ThreatLevel;
(function (ThreatLevel) {
    ThreatLevel["Low"] = "low";
    ThreatLevel["Medium"] = "medium";
    ThreatLevel["High"] = "high";
    ThreatLevel["Critical"] = "critical";
})(ThreatLevel || (ThreatLevel = {}));
export var Trend;
(function (Trend) {
    Trend["Rising"] = "rising";
    Trend["Stable"] = "stable";
    Trend["Declining"] = "declining";
    Trend["New"] = "new";
})(Trend || (Trend = {}));
export var AlertType;
(function (AlertType) {
    AlertType["NewCampaign"] = "new_campaign";
    AlertType["PriceChange"] = "price_change";
    AlertType["HighAdVolume"] = "high_ad_volume";
    AlertType["ViralContent"] = "viral_content";
    AlertType["NewCompetitor"] = "new_competitor";
    AlertType["ThreatEscalation"] = "threat_escalation";
    AlertType["EngagementSpike"] = "engagement_spike";
    AlertType["PageMilestone"] = "page_milestone";
})(AlertType || (AlertType = {}));
export var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["Info"] = "info";
    AlertSeverity["Warning"] = "warning";
    AlertSeverity["Critical"] = "critical";
})(AlertSeverity || (AlertSeverity = {}));
export var RecommendationPriority;
(function (RecommendationPriority) {
    RecommendationPriority["Low"] = "low";
    RecommendationPriority["Medium"] = "medium";
    RecommendationPriority["High"] = "high";
    RecommendationPriority["Urgent"] = "urgent";
})(RecommendationPriority || (RecommendationPriority = {}));
export var ContentCategory;
(function (ContentCategory) {
    ContentCategory["Promotion"] = "promotion";
    ContentCategory["Brand"] = "brand";
    ContentCategory["Product"] = "product";
    ContentCategory["Educational"] = "educational";
    ContentCategory["Testimonial"] = "testimonial";
    ContentCategory["Event"] = "event";
    ContentCategory["UserGenerated"] = "user_generated";
    ContentCategory["Seasonal"] = "seasonal";
    ContentCategory["Unknown"] = "unknown";
})(ContentCategory || (ContentCategory = {}));
export var PricePosition;
(function (PricePosition) {
    PricePosition["Cheapest"] = "cheapest";
    PricePosition["BelowAverage"] = "below_average";
    PricePosition["Average"] = "average";
    PricePosition["AboveAverage"] = "above_average";
    PricePosition["Premium"] = "premium";
})(PricePosition || (PricePosition = {}));
export var TrendSource;
(function (TrendSource) {
    TrendSource["GoogleTrends"] = "google_trends";
    TrendSource["FacebookInsights"] = "facebook_insights";
    TrendSource["MetaAdsLibrary"] = "meta_ads_library";
    TrendSource["Manual"] = "manual";
})(TrendSource || (TrendSource = {}));
//# sourceMappingURL=index.js.map