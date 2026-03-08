// =============================================================================
// Drizzle ORM Schema — PostgreSQL table definitions
// =============================================================================

import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────────
// 1. COMPETITORS
// ─────────────────────────────────────────────────────────────────────────────

export const competitors = pgTable(
  'competitors',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    facebookPageId: varchar('facebook_page_id', { length: 255 }).notNull(),
    facebookPageUrl: text('facebook_page_url').notNull(),
    adsLibraryUrl: text('ads_library_url').notNull(),
    category: varchar('category', { length: 100 }).notNull().default('hotel'),
    priceTier: varchar('price_tier', { length: 50 }).notNull().default('mid-range'),
    isCustomer: boolean('is_customer').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('competitors_facebook_page_id_idx').on(table.facebookPageId),
    index('competitors_is_active_idx').on(table.isActive),
    index('competitors_category_idx').on(table.category),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. ADS
// ─────────────────────────────────────────────────────────────────────────────

export const ads = pgTable(
  'ads',
  {
    id: serial('id').primaryKey(),
    competitorId: integer('competitor_id')
      .notNull()
      .references(() => competitors.id, { onDelete: 'cascade' }),
    metaAdId: varchar('meta_ad_id', { length: 100 }).notNull(),
    startedRunning: date('started_running', { mode: 'date' }),
    isActive: boolean('is_active').notNull().default(true),
    platforms: jsonb('platforms').$type<string[]>().notNull().default([]),
    creativeType: varchar('creative_type', { length: 50 }).notNull().default('unknown'),
    adCopy: text('ad_copy'),
    headline: varchar('headline', { length: 500 }),
    ctaType: varchar('cta_type', { length: 50 }).notNull().default('UNKNOWN'),
    landingUrl: text('landing_url'),
    adVariationsCount: integer('ad_variations_count').notNull().default(1),
    extractedPrice: numeric('extracted_price', { precision: 12, scale: 2 }),
    extractedDiscount: numeric('extracted_discount', { precision: 5, scale: 2 }),
    language: varchar('language', { length: 10 }),
    screenshotPath: text('screenshot_path'),
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('ads_meta_ad_id_idx').on(table.metaAdId),
    index('ads_competitor_id_idx').on(table.competitorId),
    index('ads_competitor_active_idx').on(table.competitorId, table.isActive),
    index('ads_scraped_at_idx').on(table.scrapedAt),
    index('ads_started_running_idx').on(table.startedRunning),
    index('ads_creative_type_idx').on(table.creativeType),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. FACEBOOK PAGES (metrics snapshots)
// ─────────────────────────────────────────────────────────────────────────────

export const facebookPages = pgTable(
  'facebook_pages',
  {
    id: serial('id').primaryKey(),
    competitorId: integer('competitor_id')
      .notNull()
      .references(() => competitors.id, { onDelete: 'cascade' }),
    pageUrl: text('page_url').notNull(),
    followers: integer('followers'),
    pageLikes: integer('page_likes'),
    rating: numeric('rating', { precision: 3, scale: 2 }),
    reviewCount: integer('review_count'),
    postsLast30d: integer('posts_last_30d'),
    avgEngagementRate: numeric('avg_engagement_rate', { precision: 8, scale: 4 }),
    lastPostDate: timestamp('last_post_date', { withTimezone: true }),
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('facebook_pages_competitor_id_idx').on(table.competitorId),
    index('facebook_pages_scraped_at_idx').on(table.scrapedAt),
    index('facebook_pages_competitor_scraped_idx').on(
      table.competitorId,
      table.scrapedAt,
    ),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. FACEBOOK POSTS
// ─────────────────────────────────────────────────────────────────────────────

export const facebookPosts = pgTable(
  'facebook_posts',
  {
    id: serial('id').primaryKey(),
    competitorId: integer('competitor_id')
      .notNull()
      .references(() => competitors.id, { onDelete: 'cascade' }),
    postId: varchar('post_id', { length: 255 }).notNull(),
    postUrl: text('post_url').notNull(),
    postType: varchar('post_type', { length: 50 }).notNull().default('unknown'),
    postText: text('post_text'),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    reactions: integer('reactions').notNull().default(0),
    comments: integer('comments').notNull().default(0),
    shares: integer('shares').notNull().default(0),
    videoViews: integer('video_views'),
    contentCategory: varchar('content_category', { length: 50 }).notNull().default('unknown'),
    language: varchar('language', { length: 10 }),
    isTopPerformer: boolean('is_top_performer').notNull().default(false),
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('facebook_posts_post_id_idx').on(table.postId),
    index('facebook_posts_competitor_id_idx').on(table.competitorId),
    index('facebook_posts_posted_at_idx').on(table.postedAt),
    index('facebook_posts_competitor_posted_idx').on(
      table.competitorId,
      table.postedAt,
    ),
    index('facebook_posts_is_top_performer_idx').on(table.isTopPerformer),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. ANALYSES
// ─────────────────────────────────────────────────────────────────────────────

export const analyses = pgTable(
  'analyses',
  {
    id: serial('id').primaryKey(),
    competitorId: integer('competitor_id')
      .notNull()
      .references(() => competitors.id, { onDelete: 'cascade' }),
    analysisDate: date('analysis_date', { mode: 'date' }).notNull(),
    totalActiveAds: integer('total_active_ads').notNull().default(0),
    newestAdDate: date('newest_ad_date', { mode: 'date' }),
    adTypes: jsonb('ad_types').$type<Array<{ type: string; count: number; percentage: number }>>().notNull().default([]),
    targetSegments: jsonb('target_segments')
      .$type<Array<{ segment: string; confidence: string; evidence: string[] }>>()
      .notNull()
      .default([]),
    pricingData: jsonb('pricing_data'),
    marketingStrategyEn: text('marketing_strategy_en'),
    marketingStrategyTh: text('marketing_strategy_th'),
    keyUspEn: text('key_usp_en'),
    keyUspTh: text('key_usp_th'),
    healthScore: numeric('health_score', { precision: 5, scale: 2 }).notNull().default('0'),
    paidScore: numeric('paid_score', { precision: 5, scale: 2 }).notNull().default('0'),
    organicScore: numeric('organic_score', { precision: 5, scale: 2 }).notNull().default('0'),
    threatLevel: varchar('threat_level', { length: 20 }).notNull().default('low'),
    trend: varchar('trend', { length: 20 }).notNull().default('stable'),
    shareOfVoice: numeric('share_of_voice', { precision: 5, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('analyses_competitor_date_idx').on(
      table.competitorId,
      table.analysisDate,
    ),
    index('analyses_competitor_id_idx').on(table.competitorId),
    index('analyses_analysis_date_idx').on(table.analysisDate),
    index('analyses_threat_level_idx').on(table.threatLevel),
    index('analyses_health_score_idx').on(table.healthScore),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. TRENDS
// ─────────────────────────────────────────────────────────────────────────────

export const trends = pgTable(
  'trends',
  {
    id: serial('id').primaryKey(),
    trendDate: date('trend_date', { mode: 'date' }).notNull(),
    source: varchar('source', { length: 50 }).notNull(),
    keyword: varchar('keyword', { length: 255 }).notNull(),
    value: numeric('value', { precision: 12, scale: 4 }).notNull().default('0'),
    changePct: numeric('change_pct', { precision: 8, scale: 4 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('trends_trend_date_idx').on(table.trendDate),
    index('trends_source_idx').on(table.source),
    index('trends_keyword_idx').on(table.keyword),
    uniqueIndex('trends_date_source_keyword_idx').on(
      table.trendDate,
      table.source,
      table.keyword,
    ),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. ALERTS
// ─────────────────────────────────────────────────────────────────────────────

export const alerts = pgTable(
  'alerts',
  {
    id: serial('id').primaryKey(),
    alertDate: date('alert_date', { mode: 'date' }).notNull(),
    alertType: varchar('alert_type', { length: 50 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull().default('info'),
    competitorId: integer('competitor_id')
      .notNull()
      .references(() => competitors.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull(),
    actionRequired: text('action_required'),
    isSent: boolean('is_sent').notNull().default(false),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('alerts_alert_date_idx').on(table.alertDate),
    index('alerts_competitor_id_idx').on(table.competitorId),
    index('alerts_severity_idx').on(table.severity),
    index('alerts_is_sent_idx').on(table.isSent),
    index('alerts_type_date_idx').on(table.alertType, table.alertDate),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. REPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    reportUuid: uuid('report_uuid').notNull().defaultRandom(),
    title: varchar('title', { length: 500 }).notNull(),
    clientName: varchar('client_name', { length: 255 }),
    marketLocation: varchar('market_location', { length: 255 }).notNull().default('Hua Hin, Thailand'),
    reportMonth: integer('report_month').notNull(),
    reportYear: integer('report_year').notNull(),
    reportDate: timestamp('report_date', { withTimezone: true }).notNull().defaultNow(),
    competitorsCount: integer('competitors_count').notNull().default(0),
    activeAdvertisers: integer('active_advertisers').notNull().default(0),
    totalActiveAds: integer('total_active_ads').notNull().default(0),
    htmlContent: text('html_content').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    generatedBy: varchar('generated_by', { length: 255 }).notNull().default('system'),
    llmModelUsed: varchar('llm_model_used', { length: 255 }).notNull().default('anthropic/claude-sonnet-4-5'),
    generationTimeSec: numeric('generation_time_sec', { precision: 8, scale: 2 }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('reports_report_uuid_idx').on(table.reportUuid),
    index('reports_status_idx').on(table.status),
    index('reports_date_idx').on(table.reportDate),
  ],
);

export const reportCompetitors = pgTable(
  'report_competitors',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    competitorName: varchar('competitor_name', { length: 255 }).notNull(),
    facebookPageId: varchar('facebook_page_id', { length: 255 }),
    facebookPageUrl: text('facebook_page_url'),
    totalActiveAds: integer('total_active_ads').notNull().default(0),
    healthScore: numeric('health_score', { precision: 5, scale: 2 }),
    budgetTier: varchar('budget_tier', { length: 50 }),
    threatLevel: varchar('threat_level', { length: 50 }),
    isNewEntrant: boolean('is_new_entrant').notNull().default(false),
    isMarketLeader: boolean('is_market_leader').notNull().default(false),
    newestAdDate: date('newest_ad_date', { mode: 'date' }),
    adTypes: jsonb('ad_types').$type<string[]>().notNull().default([]),
    targetSegments: jsonb('target_segments').$type<string[]>().notNull().default([]),
    keyUspEn: text('key_usp_en'),
    marketingStrategyEn: text('marketing_strategy_en'),
    pricingInfo: text('pricing_info'),
    languageSplit: text('language_split'),
    estimatedAdSpend: text('estimated_ad_spend'),
    competitorHtml: text('competitor_html'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('report_competitors_report_id_idx').on(table.reportId),
    index('report_competitors_name_idx').on(table.competitorName),
  ],
);

export const reportAccessLog = pgTable(
  'report_access_log',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    reportUuid: varchar('report_uuid', { length: 255 }).notNull(),
    accessedBy: varchar('accessed_by', { length: 255 }).notNull().default('anonymous'),
    accessType: varchar('access_type', { length: 50 }).notNull(),
    ipAddress: varchar('ip_address', { length: 100 }),
    accessedAt: timestamp('accessed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('report_access_log_report_id_idx').on(table.reportId),
    index('report_access_log_uuid_idx').on(table.reportUuid),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. FOLLOWER HISTORY
// ─────────────────────────────────────────────────────────────────────────────

export const followerHistory = pgTable(
  'follower_history',
  {
    id: serial('id').primaryKey(),
    competitorId: integer('competitor_id')
      .notNull()
      .references(() => competitors.id, { onDelete: 'cascade' }),
    recordedDate: date('recorded_date', { mode: 'date' }).notNull(),
    followers: integer('followers').notNull(),
    previousFollowers: integer('previous_followers'),
    changeAbsolute: integer('change_absolute'),
    changePct: numeric('change_pct', { precision: 8, scale: 4 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('follower_history_competitor_date_idx').on(
      table.competitorId,
      table.recordedDate,
    ),
    index('follower_history_competitor_id_idx').on(table.competitorId),
    index('follower_history_recorded_date_idx').on(table.recordedDate),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. PIPELINE RUNS
// ─────────────────────────────────────────────────────────────────────────────

export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: text('id').primaryKey(),
    status: varchar('status', { length: 20 }).notNull().default('running'),
    stage: varchar('stage', { length: 50 }).notNull().default('idle'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    results: jsonb('results').$type<Record<string, unknown>>().notNull().default({}),
    error: text('error'),
    dryRun: boolean('dry_run').notNull().default(false),
  },
  (table) => [
    index('pipeline_runs_started_at_idx').on(table.startedAt),
    index('pipeline_runs_status_idx').on(table.status),
  ],
);
