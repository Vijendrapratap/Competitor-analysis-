// =============================================================================
// Database Queries — all data-access functions using Drizzle ORM
// =============================================================================

import {
  and,
  asc,
  avg,
  count,
  desc,
  eq,
  gte,
  inArray,
  notInArray,
  sql,
  sum,
} from 'drizzle-orm';
import { db } from './index.js';
import {
  ads,
  alerts,
  analyses,
  competitors,
  facebookPages,
  facebookPosts,
  followerHistory,
  reports,
  trends,
} from './schema.js';
import { createLogger } from '../utils/logger.js';
import { toIsoDate } from '../utils/helpers.js';
import type {
  Ad,
  Alert,
  Analysis,
  Competitor,
  FacebookPageMetrics,
  FacebookPost,
  MarketOverview,
  ThreatLevel,
  Trend,
  TrendData,
} from '../types/index.js';

const log = createLogger('queries');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function today(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function daysAgoDate(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Convert numeric-string columns from Drizzle back to `number`. */
function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : parseFloat(val);
}

function toNumOrNull(val: string | number | null | undefined): number | null {
  if (val == null) return null;
  return typeof val === 'number' ? val : parseFloat(val);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPETITORS
// ─────────────────────────────────────────────────────────────────────────────

export async function getCompetitors(): Promise<Competitor[]> {
  log.debug('Fetching all active competitors');
  const rows = await db
    .select()
    .from(competitors)
    .where(eq(competitors.isActive, true))
    .orderBy(competitors.name);

  return rows.map(mapCompetitorRow);
}

export async function getCompetitorById(id: number): Promise<Competitor | null> {
  const [row] = await db
    .select()
    .from(competitors)
    .where(eq(competitors.id, id))
    .limit(1);
  return row ? mapCompetitorRow(row) : null;
}

export async function getCompetitorByName(name: string): Promise<Competitor | null> {
  const [row] = await db
    .select()
    .from(competitors)
    .where(eq(competitors.name, name))
    .limit(1);
  return row ? mapCompetitorRow(row) : null;
}

export async function getCustomer(): Promise<Competitor | null> {
  const [row] = await db
    .select()
    .from(competitors)
    .where(eq(competitors.isCustomer, true))
    .limit(1);
  return row ? mapCompetitorRow(row) : null;
}

export async function insertCompetitor(
  data: typeof competitors.$inferInsert,
): Promise<number> {
  const [result] = await db
    .insert(competitors)
    .values(data)
    .returning({ id: competitors.id });
  log.info(`Inserted competitor id=${result!.id} name=${data.name}`);
  return result!.id;
}

export async function updateCompetitor(
  id: number,
  data: Partial<Omit<typeof competitors.$inferInsert, 'id' | 'createdAt'>>,
): Promise<void> {
  await db
    .update(competitors)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(competitors.id, id));
  log.info(`Updated competitor id=${id}`);
}

export async function deleteCompetitor(id: number): Promise<void> {
  await db.delete(competitors).where(eq(competitors.id, id));
  log.info(`Deleted competitor id=${id} (cascade)`);
}

export async function toggleCompetitorActive(id: number): Promise<boolean> {
  const [row] = await db
    .select({ isActive: competitors.isActive })
    .from(competitors)
    .where(eq(competitors.id, id))
    .limit(1);
  if (!row) throw new Error(`Competitor ${id} not found`);

  const newStatus = !row.isActive;
  await db
    .update(competitors)
    .set({ isActive: newStatus, updatedAt: new Date() })
    .where(eq(competitors.id, id));
  log.info(`Toggled competitor id=${id} isActive=${newStatus}`);
  return newStatus;
}

function mapCompetitorRow(row: typeof competitors.$inferSelect): Competitor {
  return {
    id: row.id,
    name: row.name,
    facebookPageId: row.facebookPageId,
    facebookPageUrl: row.facebookPageUrl,
    adsLibraryUrl: row.adsLibraryUrl,
    category: row.category,
    priceTier: row.priceTier as Competitor['priceTier'],
    isCustomer: row.isCustomer,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // ── NEW FIELDS (002_schema_enhancements) ────────────────────────────
    cachedHealthScore: row.cachedHealthScore ? parseFloat(row.cachedHealthScore as string) : null,
    cachedShareOfVoice: row.cachedShareOfVoice ? parseFloat(row.cachedShareOfVoice as string) : null,
    cachedThreatLevel: row.cachedThreatLevel as any,
    positioningSimilarity: row.positioningSimilarity as any,
    estimatedDailySpend: row.estimatedDailySpend,
    spendTier: row.spendTier as any,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADS
// ─────────────────────────────────────────────────────────────────────────────

export async function insertAd(
  data: typeof ads.$inferInsert,
): Promise<number> {
  const [result] = await db
    .insert(ads)
    .values(data)
    .onConflictDoUpdate({
      target: ads.metaAdId,
      set: {
        isActive: data.isActive,
        platforms: data.platforms,
        creativeType: data.creativeType,
        adCopy: data.adCopy,
        headline: data.headline,
        ctaType: data.ctaType,
        landingUrl: data.landingUrl,
        adVariationsCount: data.adVariationsCount,
        extractedPrice: data.extractedPrice,
        extractedDiscount: data.extractedDiscount,
        language: data.language,
        screenshotPath: data.screenshotPath,
        scrapedAt: data.scrapedAt ?? sql`now()`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: ads.id });
  return result!.id;
}

export async function insertAds(
  dataArray: Array<typeof ads.$inferInsert>,
): Promise<void> {
  if (dataArray.length === 0) return;
  log.debug(`Batch inserting ${dataArray.length} ads`);

  // Process in chunks of 100 to avoid hitting PG parameter limits
  const CHUNK = 100;
  for (let i = 0; i < dataArray.length; i += CHUNK) {
    const chunk = dataArray.slice(i, i + CHUNK);
    await db
      .insert(ads)
      .values(chunk)
      .onConflictDoUpdate({
        target: ads.metaAdId,
        set: {
          isActive: sql`excluded.is_active`,
          platforms: sql`excluded.platforms`,
          creativeType: sql`excluded.creative_type`,
          adCopy: sql`excluded.ad_copy`,
          headline: sql`excluded.headline`,
          ctaType: sql`excluded.cta_type`,
          landingUrl: sql`excluded.landing_url`,
          adVariationsCount: sql`excluded.ad_variations_count`,
          extractedPrice: sql`excluded.extracted_price`,
          extractedDiscount: sql`excluded.extracted_discount`,
          language: sql`excluded.language`,
          screenshotPath: sql`excluded.screenshot_path`,
          scrapedAt: sql`excluded.scraped_at`,
          updatedAt: sql`now()`,
        },
      });
  }

  log.info(`Upserted ${dataArray.length} ads`);
}

export async function getCompetitorAds(
  competitorId: number,
  sinceDate?: Date,
): Promise<Ad[]> {
  const conditions = [eq(ads.competitorId, competitorId)];
  if (sinceDate) {
    conditions.push(gte(ads.scrapedAt, sinceDate));
  }

  const rows = await db
    .select()
    .from(ads)
    .where(and(...conditions))
    .orderBy(desc(ads.scrapedAt));

  return rows.map(mapAdRow);
}

export async function getActiveAdsCount(competitorId: number): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(ads)
    .where(
      and(eq(ads.competitorId, competitorId), eq(ads.isActive, true)),
    );
  return result?.count ?? 0;
}

export async function getTodayAds(): Promise<Ad[]> {
  const rows = await db
    .select()
    .from(ads)
    .where(gte(ads.scrapedAt, today()))
    .orderBy(desc(ads.scrapedAt));

  return rows.map(mapAdRow);
}

export async function markAdsInactive(
  competitorId: number,
  activeAdIds: string[],
): Promise<void> {
  if (activeAdIds.length === 0) {
    // Mark ALL ads for this competitor as inactive
    await db
      .update(ads)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(ads.competitorId, competitorId));
    return;
  }

  await db
    .update(ads)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(ads.competitorId, competitorId),
        eq(ads.isActive, true),
        notInArray(ads.metaAdId, activeAdIds),
      ),
    );

  log.debug(`Marked ads inactive for competitor ${competitorId} (kept ${activeAdIds.length} active)`);
}

function mapAdRow(row: typeof ads.$inferSelect): Ad {
  return {
    id: row.id,
    competitorId: row.competitorId,
    metaAdId: row.metaAdId,
    startedRunning: row.startedRunning,
    isActive: row.isActive,
    platforms: (row.platforms ?? []) as Ad['platforms'],
    creativeType: row.creativeType as Ad['creativeType'],
    adCopy: row.adCopy,
    headline: row.headline,
    ctaType: row.ctaType as Ad['ctaType'],
    landingUrl: row.landingUrl,
    adVariationsCount: row.adVariationsCount,
    extractedPrice: toNumOrNull(row.extractedPrice),
    extractedDiscount: toNumOrNull(row.extractedDiscount),
    language: row.language,
    screenshotPath: row.screenshotPath,
    scrapedAt: row.scrapedAt,
    // ── NEW FIELDS (002_schema_enhancements) ────────────────────────────
    adArchiveId: row.adArchiveId,
    adText: row.adText,
    adCreativeBodies: (row.adCreativeBodies ?? []) as string[],
    publisherPlatforms: (row.publisherPlatforms ?? []) as string[],
    adStatus: row.adStatus,
    startDate: row.startDate,
    endDate: row.endDate,
    adCreationTime: row.adCreationTime,
    estimatedAudienceSize: row.estimatedAudienceSize,
    ctaDomain: row.ctaDomain,
    ctaHeadline: row.ctaHeadline,
    ctaDescription: row.ctaDescription,
    adSnapshotUrl: row.adSnapshotUrl,
    adLibraryUrl: row.adLibraryUrl,
    creativeTypeEnum: row.creativeTypeEnum as any,
    categoryTag: row.categoryTag as any,
    extractedPriceStr: row.extractedPriceStr,
    discountDepth: row.discountDepth,
    isHighFocus: row.isHighFocus,
    roiConfidence: row.roiConfidence as any,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FACEBOOK PAGES
// ─────────────────────────────────────────────────────────────────────────────

export async function insertPageMetrics(
  data: typeof facebookPages.$inferInsert,
): Promise<number> {
  const [result] = await db
    .insert(facebookPages)
    .values(data)
    .returning({ id: facebookPages.id });
  log.debug(`Inserted page metrics id=${result!.id} for competitor=${data.competitorId}`);
  return result!.id;
}

export async function getLatestPageMetrics(
  competitorId: number,
): Promise<FacebookPageMetrics | null> {
  const [row] = await db
    .select()
    .from(facebookPages)
    .where(eq(facebookPages.competitorId, competitorId))
    .orderBy(desc(facebookPages.scrapedAt))
    .limit(1);

  return row ? mapPageMetricsRow(row) : null;
}

function mapPageMetricsRow(row: typeof facebookPages.$inferSelect): FacebookPageMetrics {
  return {
    id: row.id,
    competitorId: row.competitorId,
    pageUrl: row.pageUrl,
    followers: row.followers,
    pageLikes: row.pageLikes,
    rating: toNumOrNull(row.rating),
    reviewCount: row.reviewCount,
    postsLast30d: row.postsLast30d,
    avgEngagementRate: toNumOrNull(row.avgEngagementRate),
    lastPostDate: row.lastPostDate,
    scrapedAt: row.scrapedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FACEBOOK POSTS
// ─────────────────────────────────────────────────────────────────────────────

export async function insertPost(
  data: typeof facebookPosts.$inferInsert,
): Promise<number> {
  const [result] = await db
    .insert(facebookPosts)
    .values(data)
    .onConflictDoUpdate({
      target: facebookPosts.postId,
      set: {
        postType: data.postType,
        postText: data.postText,
        reactions: data.reactions,
        comments: data.comments,
        shares: data.shares,
        videoViews: data.videoViews,
        contentCategory: data.contentCategory,
        isTopPerformer: data.isTopPerformer,
        scrapedAt: data.scrapedAt ?? sql`now()`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: facebookPosts.id });
  return result!.id;
}

export async function getRecentPosts(
  competitorId: number,
  days = 30,
): Promise<FacebookPost[]> {
  const since = daysAgoDate(days);
  const rows = await db
    .select()
    .from(facebookPosts)
    .where(
      and(
        eq(facebookPosts.competitorId, competitorId),
        gte(facebookPosts.postedAt, since),
      ),
    )
    .orderBy(desc(facebookPosts.postedAt));

  return rows.map(mapPostRow);
}

function mapPostRow(row: typeof facebookPosts.$inferSelect): FacebookPost {
  return {
    id: row.id,
    competitorId: row.competitorId,
    postId: row.postId,
    postUrl: row.postUrl,
    postType: row.postType as FacebookPost['postType'],
    postText: row.postText,
    postedAt: row.postedAt,
    reactions: row.reactions,
    comments: row.comments,
    shares: row.shares,
    videoViews: row.videoViews,
    contentCategory: row.contentCategory as FacebookPost['contentCategory'],
    language: row.language,
    isTopPerformer: row.isTopPerformer,
    scrapedAt: row.scrapedAt,
    // ── NEW FIELDS (002_schema_enhancements) ────────────────────────────
    likes: row.likes,
    viewsCount: row.viewsCount,
    reactionLikeCount: row.reactionLikeCount,
    reactionLoveCount: row.reactionLoveCount,
    reactionWowCount: row.reactionWowCount,
    reactionHahaCount: row.reactionHahaCount,
    reactionCareCount: row.reactionCareCount,
    mediaType: row.mediaType as any,
    thumbnailUrl: row.thumbnailUrl,
    engagementScore: row.engagementScore ? parseFloat(row.engagementScore as string) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOWER HISTORY
// ─────────────────────────────────────────────────────────────────────────────

export async function insertFollowerHistory(
  competitorId: number,
  followers: number,
): Promise<void> {
  // Fetch previous record to compute change
  const [prev] = await db
    .select()
    .from(followerHistory)
    .where(eq(followerHistory.competitorId, competitorId))
    .orderBy(desc(followerHistory.recordedDate))
    .limit(1);

  const changeAbsolute = prev ? followers - prev.followers : null;
  const changePct =
    prev && prev.followers > 0
      ? String(((followers - prev.followers) / prev.followers) * 100)
      : null;

  await db
    .insert(followerHistory)
    .values({
      competitorId,
      recordedDate: today(),
      followers,
      previousFollowers: prev?.followers ?? null,
      changeAbsolute,
      changePct,
    })
    .onConflictDoUpdate({
      target: [followerHistory.competitorId, followerHistory.recordedDate],
      set: {
        followers,
        previousFollowers: prev?.followers ?? null,
        changeAbsolute,
        changePct,
      },
    });

  log.debug(`Recorded follower history for competitor=${competitorId}: ${followers}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYSES
// ─────────────────────────────────────────────────────────────────────────────

export async function insertAnalysis(
  data: typeof analyses.$inferInsert,
): Promise<number> {
  const [result] = await db
    .insert(analyses)
    .values(data)
    .onConflictDoUpdate({
      target: [analyses.competitorId, analyses.analysisDate],
      set: {
        totalActiveAds: data.totalActiveAds,
        newestAdDate: data.newestAdDate,
        adTypes: data.adTypes,
        targetSegments: data.targetSegments,
        pricingData: data.pricingData,
        marketingStrategyEn: data.marketingStrategyEn,
        marketingStrategyTh: data.marketingStrategyTh,
        keyUspEn: data.keyUspEn,
        keyUspTh: data.keyUspTh,
        healthScore: data.healthScore,
        paidScore: data.paidScore,
        organicScore: data.organicScore,
        threatLevel: data.threatLevel,
        trend: data.trend,
        shareOfVoice: data.shareOfVoice,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: analyses.id });

  log.debug(`Upserted analysis id=${result!.id} for competitor=${data.competitorId}`);
  return result!.id;
}

export async function getLatestAnalysis(
  competitorId: number,
): Promise<Analysis | null> {
  const [row] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.competitorId, competitorId))
    .orderBy(desc(analyses.analysisDate))
    .limit(1);

  return row ? mapAnalysisRow(row) : null;
}

export async function getTodayAnalyses(): Promise<Analysis[]> {
  const rows = await db
    .select()
    .from(analyses)
    .where(eq(analyses.analysisDate, today()))
    .orderBy(analyses.competitorId);

  return rows.map(mapAnalysisRow);
}

export async function getHistoricalAnalysis(
  competitorId: number,
  days = 90,
): Promise<Analysis[]> {
  const since = daysAgoDate(days);
  const rows = await db
    .select()
    .from(analyses)
    .where(
      and(
        eq(analyses.competitorId, competitorId),
        gte(analyses.analysisDate, since),
      ),
    )
    .orderBy(desc(analyses.analysisDate));

  return rows.map(mapAnalysisRow);
}

function mapAnalysisRow(row: typeof analyses.$inferSelect): Analysis {
  return {
    id: row.id,
    competitorId: row.competitorId,
    analysisDate: row.analysisDate,
    totalActiveAds: row.totalActiveAds,
    newestAdDate: row.newestAdDate,
    adTypes: (row.adTypes ?? []) as Analysis['adTypes'],
    targetSegments: (row.targetSegments ?? []) as Analysis['targetSegments'],
    pricingData: row.pricingData as Analysis['pricingData'],
    marketingStrategyEn: row.marketingStrategyEn,
    marketingStrategyTh: row.marketingStrategyTh,
    keyUspEn: row.keyUspEn,
    keyUspTh: row.keyUspTh,
    healthScore: toNum(row.healthScore),
    paidScore: toNum(row.paidScore),
    organicScore: toNum(row.organicScore),
    threatLevel: row.threatLevel as Analysis['threatLevel'],
    trend: row.trend as Analysis['trend'],
    shareOfVoice: toNumOrNull(row.shareOfVoice),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────────────────────────────────────

export async function insertAlert(
  data: typeof alerts.$inferInsert,
): Promise<number> {
  const [result] = await db
    .insert(alerts)
    .values(data)
    .returning({ id: alerts.id });
  log.debug(`Inserted alert id=${result!.id} type=${data.alertType}`);
  return result!.id;
}

export async function getTodayAlerts(): Promise<Alert[]> {
  const rows = await db
    .select()
    .from(alerts)
    .where(eq(alerts.alertDate, today()))
    .orderBy(desc(alerts.severity), alerts.competitorId);

  return rows.map(mapAlertRow);
}

export async function getUnsentAlerts(): Promise<Alert[]> {
  const rows = await db
    .select()
    .from(alerts)
    .where(eq(alerts.isSent, false))
    .orderBy(desc(alerts.severity), alerts.alertDate);

  return rows.map(mapAlertRow);
}

export async function markAlertSent(alertId: number): Promise<void> {
  await db
    .update(alerts)
    .set({ isSent: true, sentAt: new Date() })
    .where(eq(alerts.id, alertId));
}

function mapAlertRow(row: typeof alerts.$inferSelect): Alert {
  return {
    id: row.id,
    alertDate: row.alertDate,
    alertType: row.alertType as Alert['alertType'],
    severity: row.severity as Alert['severity'],
    competitorId: row.competitorId,
    title: row.title,
    description: row.description,
    actionRequired: row.actionRequired,
    isSent: row.isSent,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRENDS
// ─────────────────────────────────────────────────────────────────────────────

export async function insertTrend(
  data: typeof trends.$inferInsert,
): Promise<number> {
  const [result] = await db
    .insert(trends)
    .values(data)
    .onConflictDoUpdate({
      target: [trends.trendDate, trends.source, trends.keyword],
      set: {
        value: data.value,
        changePct: data.changePct,
        metadata: data.metadata,
      },
    })
    .returning({ id: trends.id });
  return result!.id;
}

export async function getRecentTrends(days = 30): Promise<TrendData[]> {
  const since = daysAgoDate(days);
  const rows = await db
    .select()
    .from(trends)
    .where(gte(trends.trendDate, since))
    .orderBy(desc(trends.trendDate));

  return rows.map(mapTrendRow);
}

function mapTrendRow(row: typeof trends.$inferSelect): TrendData {
  return {
    id: row.id,
    trendDate: row.trendDate,
    source: row.source as TrendData['source'],
    keyword: row.keyword,
    value: toNum(row.value),
    changePct: toNumOrNull(row.changePct),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────

export async function insertReport(
  data: typeof reports.$inferInsert,
): Promise<number> {
  const [result] = await db
    .insert(reports)
    .values(data)
    .returning({ id: reports.id });
  log.info(`Inserted report id=${result!.id} title=${data.title}`);
  return result!.id;
}

export async function markReportDelivered(
  reportDate: Date,
  deliveredTo: string[] = [],
): Promise<void> {
  await db
    .update(reports)
    .set({
      status: 'delivered',
      metadata: sql`jsonb_set(metadata, '{deliveredTo}', ${JSON.stringify(deliveredTo)}::jsonb)`,
      updatedAt: new Date(),
    })
    .where(eq(reports.reportDate, reportDate));
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATIONS
// ─────────────────────────────────────────────────────────────────────────────

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

export async function getMarketOverview(): Promise<MarketOverview> {
  // Total & active competitors
  const [compCounts] = await db
    .select({
      total: count(),
      active: count(
        sql`CASE WHEN ${competitors.isActive} THEN 1 END`,
      ),
    })
    .from(competitors);

  // Total active ads
  const [adCounts] = await db
    .select({ total: count() })
    .from(ads)
    .where(eq(ads.isActive, true));

  // Avg health score and share of voice from today's analyses
  const [analysisAgg] = await db
    .select({
      avgHealth: avg(analyses.healthScore),
      avgSov: avg(analyses.shareOfVoice),
    })
    .from(analyses)
    .where(eq(analyses.analysisDate, today()));

  // Threat distribution
  const threatRows = await db
    .select({
      threatLevel: analyses.threatLevel,
      count: count(),
    })
    .from(analyses)
    .where(eq(analyses.analysisDate, today()))
    .groupBy(analyses.threatLevel);

  const threatDistribution = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  } as Record<ThreatLevel, number>;
  for (const r of threatRows) {
    const key = r.threatLevel as ThreatLevel;
    if (key in threatDistribution) {
      threatDistribution[key] = r.count;
    }
  }

  // Trend distribution
  const trendRows = await db
    .select({
      trend: analyses.trend,
      count: count(),
    })
    .from(analyses)
    .where(eq(analyses.analysisDate, today()))
    .groupBy(analyses.trend);

  const trendDistribution = {
    rising: 0,
    stable: 0,
    declining: 0,
    new: 0,
  } as Record<Trend, number>;
  for (const r of trendRows) {
    const key = r.trend as Trend;
    if (key in trendDistribution) {
      trendDistribution[key] = r.count;
    }
  }

  return {
    totalCompetitors: compCounts?.total ?? 0,
    activeCompetitors: Number(compCounts?.active ?? 0),
    totalActiveAds: adCounts?.total ?? 0,
    avgHealthScore: toNum(analysisAgg?.avgHealth),
    avgShareOfVoice: toNum(analysisAgg?.avgSov),
    threatDistribution,
    trendDistribution,
  };
}

export async function getHealthLeaderboard(
  analysisDate?: Date,
): Promise<HealthScoreEntry[]> {
  const targetDate = analysisDate ?? today();

  const rows = await db
    .select({
      competitorId: analyses.competitorId,
      competitorName: competitors.name,
      healthScore: analyses.healthScore,
      paidScore: analyses.paidScore,
      organicScore: analyses.organicScore,
      threatLevel: analyses.threatLevel,
      trend: analyses.trend,
      totalActiveAds: analyses.totalActiveAds,
      shareOfVoice: analyses.shareOfVoice,
    })
    .from(analyses)
    .innerJoin(competitors, eq(analyses.competitorId, competitors.id))
    .where(eq(analyses.analysisDate, targetDate))
    .orderBy(desc(analyses.healthScore));

  return rows.map((r) => ({
    competitorId: r.competitorId,
    competitorName: r.competitorName,
    healthScore: toNum(r.healthScore),
    paidScore: toNum(r.paidScore),
    organicScore: toNum(r.organicScore),
    threatLevel: r.threatLevel,
    trend: r.trend,
    totalActiveAds: r.totalActiveAds,
    shareOfVoice: toNumOrNull(r.shareOfVoice),
  }));
}

export async function getShareOfVoice(): Promise<ShareOfVoiceEntry[]> {
  // Count active ads per competitor, compute share as percentage of total
  const rows = await db
    .select({
      competitorId: ads.competitorId,
      competitorName: competitors.name,
      totalActiveAds: count(),
    })
    .from(ads)
    .innerJoin(competitors, eq(ads.competitorId, competitors.id))
    .where(eq(ads.isActive, true))
    .groupBy(ads.competitorId, competitors.name)
    .orderBy(desc(count()));

  const grandTotal = rows.reduce((sum, r) => sum + r.totalActiveAds, 0);

  return rows.map((r) => ({
    competitorId: r.competitorId,
    competitorName: r.competitorName,
    totalActiveAds: r.totalActiveAds,
    shareOfVoice:
      grandTotal > 0
        ? Math.round((r.totalActiveAds / grandTotal) * 10000) / 100
        : 0,
  }));
}

export async function getMarketAdHistory(days = 30): Promise<{ date: string; totalAds: number }[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = await db
    .select({
      date: analyses.analysisDate,
      total: sql<number>`sum(${analyses.totalActiveAds})`,
    })
    .from(analyses)
    .where(gte(analyses.analysisDate, since))
    .groupBy(analyses.analysisDate)
    .orderBy(asc(analyses.analysisDate));
  return rows.map((r) => ({ date: String(r.date), totalAds: Number(r.total) }));
}
