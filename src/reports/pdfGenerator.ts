// =============================================================================
// PDF Report Generator — compiles Handlebars templates → HTML → PDF via Puppeteer
// =============================================================================

import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import type { Browser, PDFOptions } from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { settings } from '../config/settings.js';
import { createLogger } from '../utils/logger.js';
import { formatDate, toIsoDate, round, truncate, slugify, toErrorMessage } from '../utils/helpers.js';
import { ChartGenerator } from './charts.js';
import type {
  ReportData,
  CompetitorSummary,
  Alert,
  Recommendation,
  TrendData,
  Trend,
  AlertSeverity,
  HealthScore,
} from '../types/index.js';
import type {
  ShareOfVoiceEntry,
  HealthScoreEntry,
  TrendLineEntry,
  SegmentEntry,
  EngagementEntry,
  PostFrequencyEntry,
} from './charts.js';

const log = createLogger('PDFGenerator');
const __dirname = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers registered on Handlebars
// ─────────────────────────────────────────────────────────────────────────────

function registerHelpers(): void {
  // Formatting
  Handlebars.registerHelper('formatDate', (d: unknown) =>
    formatDate(d as Date | string | null),
  );
  Handlebars.registerHelper('formatDateTime', (d: unknown) => {
    if (d == null) return '—';
    const dt = typeof d === 'string' ? new Date(d) : d as Date;
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(dt);
  });
  Handlebars.registerHelper('round', (val: unknown, decimals: unknown) =>
    round(Number(val) || 0, typeof decimals === 'number' ? decimals : 0),
  );
  Handlebars.registerHelper('truncate', (text: unknown, len: unknown) =>
    truncate(String(text ?? ''), Number(len) || 100),
  );
  Handlebars.registerHelper('formatNumber', (val: unknown) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US').format(n);
  });
  Handlebars.registerHelper('formatCurrency', (amount: unknown, currency: unknown) => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '—';
    const cur = String(currency || 'THB');
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${cur} ${new Intl.NumberFormat('en-US').format(n)}`;
    }
  });

  // Score styling
  Handlebars.registerHelper('scoreClass', (score: unknown) => {
    const s = Number(score) || 0;
    if (s >= 70) return 'score-green';
    if (s >= 40) return 'score-yellow';
    return 'score-red';
  });
  Handlebars.registerHelper('scoreColor', (score: unknown) => {
    const s = Number(score) || 0;
    if (s >= 70) return '#38a169';
    if (s >= 40) return '#d69e2e';
    return '#e53e3e';
  });

  // Trend helpers
  Handlebars.registerHelper('trendArrow', (trend: unknown) => {
    const t = String(trend).toLowerCase();
    if (t === 'rising') return '▲';
    if (t === 'declining') return '▼';
    if (t === 'new') return '★';
    return '—';
  });
  Handlebars.registerHelper('lowercase', (val: unknown) => String(val ?? '').toLowerCase());

  // Percentages
  Handlebars.registerHelper('pct', (part: unknown, total: unknown) => {
    const p = Number(part) || 0;
    const t = Number(total) || 1;
    return Math.round((p / t) * 100);
  });

  // Saturation colour
  Handlebars.registerHelper('saturationColor', (pct: unknown) => {
    const p = Number(pct) || 0;
    if (p >= 75) return '#e53e3e';
    if (p >= 50) return '#d69e2e';
    if (p >= 25) return '#3182ce';
    return '#38a169';
  });

  // Day colour for alert timeline heatmap
  Handlebars.registerHelper('dayColor', (count: unknown, severity: unknown) => {
    const c = Number(count) || 0;
    if (c === 0) return '#f7fafc';
    const sev = String(severity).toLowerCase();
    if (sev === 'critical' || sev === 'high') return '#e53e3e';
    if (c >= 3) return '#d69e2e';
    return '#ecc94b44';
  });

  // Threat badge class
  Handlebars.registerHelper('threatBadgeClass', (level: unknown) => {
    const l = String(level).toLowerCase();
    if (l === 'critical') return 'badge-critical';
    if (l === 'high') return 'badge-warning';
    return 'badge-info';
  });

  // Array/string join
  Handlebars.registerHelper('join', (arr: unknown, sep: unknown) => {
    if (!Array.isArray(arr)) return '';
    return arr.join(String(sep ?? ', '));
  });

  // 1-based index
  Handlebars.registerHelper('@index1', function (this: { index?: number }) {
    return (this.index ?? 0) + 1;
  });

  // Comparison helpers
  Handlebars.registerHelper('gt', (a: unknown, b: unknown) => Number(a) > Number(b));
  Handlebars.registerHelper('lt', (a: unknown, b: unknown) => Number(a) < Number(b));
  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  Handlebars.registerHelper('and', (a: unknown, b: unknown) => a && b);
  Handlebars.registerHelper('or', (a: unknown, b: unknown) => a || b);
}

// ─────────────────────────────────────────────────────────────────────────────
// Template loading
// ─────────────────────────────────────────────────────────────────────────────

interface CompiledTemplates {
  base: Handlebars.TemplateDelegate;
  cover: Handlebars.TemplateDelegate;
  executiveBrief: Handlebars.TemplateDelegate;
  marketMomentum: Handlebars.TemplateDelegate;
  healthLeaderboard: Handlebars.TemplateDelegate;
  threatMatrix: Handlebars.TemplateDelegate;
  shareOfVoice: Handlebars.TemplateDelegate;
  pricingBattlefield: Handlebars.TemplateDelegate;
  promotionCalendar: Handlebars.TemplateDelegate;
  stealThisPlaybook: Handlebars.TemplateDelegate;
  creativeIntelligence: Handlebars.TemplateDelegate;
  strategyAnalysis: Handlebars.TemplateDelegate;
  customerComparison: Handlebars.TemplateDelegate;
  socialMediaIntel: Handlebars.TemplateDelegate;
  competitorProfile: Handlebars.TemplateDelegate;
  alerts: Handlebars.TemplateDelegate;
  recommendations: Handlebars.TemplateDelegate;
}

function loadTemplates(): CompiledTemplates {
  const dir = resolve(__dirname, 'templates');
  const load = (name: string): Handlebars.TemplateDelegate => {
    const path = resolve(dir, `${name}.hbs`);
    const source = readFileSync(path, 'utf-8');
    return Handlebars.compile(source);
  };

  log.info('Loading Handlebars templates from', { dir });
  return {
    base: load('base'),
    cover: load('cover'),
    executiveBrief: load('executiveBrief'),
    marketMomentum: load('marketMomentum'),
    healthLeaderboard: load('healthLeaderboard'),
    threatMatrix: load('threatMatrix'),
    shareOfVoice: load('shareOfVoice'),
    pricingBattlefield: load('pricingBattlefield'),
    promotionCalendar: load('promotionCalendar'),
    stealThisPlaybook: load('stealThisPlaybook'),
    creativeIntelligence: load('creativeIntelligence'),
    strategyAnalysis: load('strategyAnalysis'),
    customerComparison: load('customerComparison'),
    socialMediaIntel: load('socialMediaIntel'),
    competitorProfile: load('competitorProfile'),
    alerts: load('alerts'),
    recommendations: load('recommendations'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Data preparation helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildLeaderboard(data: ReportData, historicalScores?: Map<string, number>) {
  const entries = data.healthScoreRankings.map((r) => {
    const summary = data.competitors.find(
      (c) => c.competitor.name === r.competitorName,
    );
    const prevScore = historicalScores?.get(r.competitorName);
    const change = prevScore != null ? r.totalScore - prevScore : 0;
    return {
      rank: r.rank,
      name: r.competitorName,
      totalScore: r.totalScore,
      paidScore: r.paidScore,
      organicScore: r.organicScore,
      trend: r.trend,
      isCustomer: summary?.competitor.isCustomer ?? false,
      category: summary?.competitor.category ?? '',
      strategyEn: summary?.latestAnalysis?.marketingStrategyEn ?? '—',
      previousScore: prevScore ?? null,
      currentScore: r.totalScore,
      change,
    };
  });

  const withChange = entries.filter((e) => e.change !== 0);
  const biggestRisers = [...withChange]
    .filter((e) => e.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 3);
  const biggestFallers = [...withChange]
    .filter((e) => e.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 3);

  return { entries, biggestRisers, biggestFallers };
}

function buildAlertSummary(data: ReportData) {
  const allAlerts = data.criticalAlerts;
  return {
    critical: allAlerts.filter((a) => a.severity === 'critical').length,
    high: allAlerts.filter((a) => a.severity === 'warning').length,
    medium: allAlerts.filter((a) => a.severity === 'info').length,
    low: 0,
  };
}

function buildShareOfVoiceEntries(data: ReportData): ShareOfVoiceEntry[] {
  return data.competitors
    .filter((c) => c.latestAnalysis)
    .map((c) => ({
      name: c.competitor.name,
      adCount: c.latestAnalysis!.totalActiveAds,
      isCustomer: c.competitor.isCustomer,
    }));
}

function buildHealthScoreEntries(data: ReportData): HealthScoreEntry[] {
  return data.healthScoreRankings.map((r) => {
    const summary = data.competitors.find((c) => c.competitor.name === r.competitorName);
    return {
      name: r.competitorName,
      totalScore: r.totalScore,
      paidScore: r.paidScore,
      organicScore: r.organicScore,
      isCustomer: summary?.competitor.isCustomer ?? false,
    };
  });
}

function buildTrendLineEntries(trends: TrendData[]): TrendLineEntry[] {
  const byKeyword = new Map<string, Array<{ date: string; value: number }>>();
  for (const t of trends) {
    const key = t.keyword;
    if (!byKeyword.has(key)) byKeyword.set(key, []);
    byKeyword.get(key)!.push({ date: toIsoDate(t.trendDate), value: t.value });
  }
  return [...byKeyword.entries()].map(([keyword, dataPoints]) => ({ keyword, dataPoints }));
}

function buildSegmentEntries(data: ReportData): SegmentEntry[] {
  const counts = new Map<string, number>();
  for (const c of data.competitors) {
    if (!c.latestAnalysis?.targetSegments) continue;
    for (const seg of c.latestAnalysis.targetSegments) {
      counts.set(seg.segment, (counts.get(seg.segment) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([segment, count]) => ({ segment, count }));
}

function buildEngagementEntries(data: ReportData): EngagementEntry[] {
  return data.competitors
    .filter((c) => c.pageMetrics?.avgEngagementRate != null)
    .map((c) => ({
      name: c.competitor.name,
      engagementRate: c.pageMetrics!.avgEngagementRate!,
      followers: c.pageMetrics!.followers ?? 0,
      isCustomer: c.competitor.isCustomer,
    }));
}

function buildPostFrequencyEntries(data: ReportData): PostFrequencyEntry[] {
  return data.competitors
    .filter((c) => c.pageMetrics?.postsLast30d != null)
    .map((c) => ({
      name: c.competitor.name,
      postsLast30d: c.pageMetrics!.postsLast30d!,
      isCustomer: c.competitor.isCustomer,
    }));
}

function findCustomer(data: ReportData): CompetitorSummary | undefined {
  return data.competitors.find((c) => c.competitor.isCustomer);
}

function buildCustomerComparison(data: ReportData) {
  const customer = findCustomer(data);
  if (!customer) return null;

  const customerScore = customer.healthScore;
  const customerRank = data.healthScoreRankings.findIndex(
    (r) => r.competitorName === customer.competitor.name,
  ) + 1;

  const avgHealthScore = data.marketOverview.avgHealthScore;
  const delta = (customerScore?.totalScore ?? 0) - avgHealthScore;

  return {
    customer: {
      totalScore: customerScore?.totalScore ?? 0,
      paidScore: customerScore?.paidScore ?? 0,
      organicScore: customerScore?.organicScore ?? 0,
      trend: customerScore ? 'stable' : 'new',
      adVolume: customer.latestAnalysis?.totalActiveAds ?? 0,
      adFreshness: customerScore?.components.adFreshness.score ?? 0,
      adCreativity: customerScore?.components.adCreativity.score ?? 0,
      shareOfVoice: customer.latestAnalysis?.shareOfVoice ?? 0,
      followers: customer.pageMetrics?.followers ?? 0,
      engagementRate: customer.pageMetrics?.avgEngagementRate ?? 0,
      postsLast30d: customer.pageMetrics?.postsLast30d ?? 0,
      contentDiversity: customerScore?.components.contentDiversity.score ?? 0,
    },
    customerRank,
    customerAboveAverage: delta >= 0,
    customerDelta: delta,
    customerDeltaAbs: Math.abs(delta),
    dimensionComparison: buildDimensionComparison(data, customerScore),
    closestCompetitors: buildClosestCompetitors(data, customerScore?.totalScore ?? 0, customer.competitor.name),
    marketAvg: buildMarketAverages(data),
  };
}

function buildDimensionComparison(data: ReportData, customerScore: HealthScore | null) {
  const dimensions = [
    { nameEn: 'Total Score', nameTh: 'คะแนนรวม', key: 'totalScore' },
    { nameEn: 'Paid Score', nameTh: 'คะแนนโฆษณา', key: 'paidScore' },
    { nameEn: 'Organic Score', nameTh: 'คะแนนออร์แกนิก', key: 'organicScore' },
  ];

  return dimensions.map((dim) => {
    const customerValue = customerScore
      ? (customerScore[dim.key as keyof HealthScore] as number)
      : 0;
    const allScores = data.healthScoreRankings.map(
      (r) => r[dim.key as keyof typeof r] as number,
    );
    const marketAvg = allScores.length
      ? allScores.reduce((s, v) => s + v, 0) / allScores.length
      : 0;
    const leaderValue = Math.max(...allScores, 0);
    const leaderEntry = data.healthScoreRankings.find(
      (r) => (r[dim.key as keyof typeof r] as number) === leaderValue,
    );

    return {
      ...dim,
      customerValue,
      marketAvg,
      leaderValue,
      leaderName: leaderEntry?.competitorName ?? '—',
      gap: leaderValue - customerValue,
      isLeading: customerValue >= leaderValue,
    };
  });
}

function buildClosestCompetitors(data: ReportData, customerScore: number, customerName: string) {
  return data.healthScoreRankings
    .filter((r) => r.competitorName !== customerName)
    .map((r) => ({
      name: r.competitorName,
      totalScore: r.totalScore,
      category: data.competitors.find((c) => c.competitor.name === r.competitorName)?.competitor.category ?? '',
      delta: r.totalScore - customerScore,
      deltaAbs: Math.abs(r.totalScore - customerScore),
      isAbove: r.totalScore > customerScore,
    }))
    .sort((a, b) => a.deltaAbs - b.deltaAbs)
    .slice(0, 6);
}

function buildMarketAverages(data: ReportData) {
  const competitors = data.competitors;
  const count = competitors.length || 1;
  return {
    adVolume: competitors.reduce((s, c) => s + (c.latestAnalysis?.totalActiveAds ?? 0), 0) / count,
    adFreshness: 0,
    adCreativity: 0,
    followers: competitors.reduce((s, c) => s + (c.pageMetrics?.followers ?? 0), 0) / count,
    engagementRate: competitors.reduce((s, c) => s + (c.pageMetrics?.avgEngagementRate ?? 0), 0) / count,
    postsLast30d: competitors.reduce((s, c) => s + (c.pageMetrics?.postsLast30d ?? 0), 0) / count,
  };
}

function buildCompetitorProfiles(data: ReportData) {
  return data.competitors.map((c, i) => {
    const ranking = data.healthScoreRankings.find(
      (r) => r.competitorName === c.competitor.name,
    );
    const analysis = c.latestAnalysis;
    return {
      name: c.competitor.name,
      category: c.competitor.category,
      pricingTier: c.competitor.priceTier,
      rank: ranking?.rank ?? (i + 1),
      totalScore: ranking?.totalScore ?? 0,
      paidScore: ranking?.paidScore ?? 0,
      organicScore: ranking?.organicScore ?? 0,
      trend: ranking?.trend ?? 'new',
      activeAds: analysis?.totalActiveAds ?? 0,
      adFormats: analysis?.adTypes?.map((t) => t.type).join(', ') ?? '—',
      newestAdDate: analysis?.newestAdDate,
      strategyEn: analysis?.marketingStrategyEn ?? '—',
      strategyTh: analysis?.marketingStrategyTh ?? '—',
      uspEn: analysis?.keyUspEn ?? '—',
      uspTh: analysis?.keyUspTh ?? '—',
      targetSegments: analysis?.targetSegments?.map((s) => s.segment) ?? [],
      threatLevel: analysis?.threatLevel ?? null,
      threatReason: null,
      followers: c.pageMetrics?.followers ?? 0,
      engagementRate: c.pageMetrics?.avgEngagementRate ?? 0,
      postsLast30d: c.pageMetrics?.postsLast30d ?? 0,
      rating: c.pageMetrics?.rating ?? 0,
      reviewCount: c.pageMetrics?.reviewCount ?? 0,
      pricing: analysis?.pricingData
        ? {
          minPrice: analysis.pricingData.lowestRate,
          avgPrice: analysis.pricingData.averageRate,
          maxPrice: analysis.pricingData.highestRate,
          currency: analysis.pricingData.currency,
          hasPromotion: (analysis.pricingData.discounts?.length ?? 0) > 0,
          promotionDetail: analysis.pricingData.discounts?.[0]?.description ?? null,
        }
        : null,
      topPosts: c.topPosts.slice(0, 3),
    };
  });
}

function buildRecommendationGroups(recs: Recommendation[]) {
  return {
    urgentRecs: recs.filter((r) => r.priority === 'urgent'),
    importantRecs: recs.filter((r) => r.priority === 'high'),
    considerRecs: recs.filter((r) => r.priority === 'medium' || r.priority === 'low'),
    urgentCount: recs.filter((r) => r.priority === 'urgent').length,
    importantCount: recs.filter((r) => r.priority === 'high').length,
    considerCount: recs.filter((r) => r.priority === 'medium' || r.priority === 'low').length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Social Media & Ad Intelligence — data builder for Apify aggregated data
// ─────────────────────────────────────────────────────────────────────────────

function buildSocialMediaIntelContext(data: ReportData) {
  // @ts-ignore — socialMediaIntel is optional and comes from aggregated Apify data
  const intel = (data as any).socialMediaIntel;
  if (!intel) return null;

  const competitors = (intel.aggregated ?? []).map((comp: any) => {
    const topPost = comp.summary?.topPerformingPost;
    const topPostEng = topPost
      ? (topPost.likes ?? 0) + (topPost.comments ?? 0) + (topPost.shares ?? 0)
      : 0;

    // Top 2-3 ads for ad copy highlights
    const topAds = (comp.activeAds ?? []).slice(0, 3).map((ad: any) => ({
      headline: truncate(ad.adHeadline ?? '', 150),
      text: truncate(ad.adText ?? '', 150),
      cta: ad.callToAction ?? 'None',
      platforms: (ad.platforms ?? ['Facebook']).join(', '),
      startDate: ad.adStartDate ?? null,
    }));

    // Post themes extraction
    const themeKeywords: Record<string, RegExp> = {
      'Promotions': /\b(?:promo|discount|offer|deal|sale|free|save|โปร|ลดราคา)\b/i,
      'Dining': /\b(?:restaurant|dining|food|chef|menu|buffet|breakfast|อาหาร)\b/i,
      'Rooms': /\b(?:room|suite|villa|accommodation|ห้องพัก|วิลล่า)\b/i,
      'Wellness': /\b(?:spa|wellness|massage|yoga|retreat|สปา)\b/i,
      'Events': /\b(?:wedding|event|conference|ceremony|งานแต่ง)\b/i,
      'Beach & Nature': /\b(?:beach|sea|ocean|sunset|pool|ทะเล|ชายหาด)\b/i,
    };

    const postTexts = (comp.recentPosts ?? []).map((p: any) => p.postText ?? '');
    const postThemes = Object.entries(themeKeywords)
      .map(([theme, regex]) => ({
        theme,
        postCount: postTexts.filter((t: string) => regex.test(t)).length,
      }))
      .filter((t) => t.postCount > 0)
      .sort((a, b) => b.postCount - a.postCount);

    return {
      competitorName: comp.competitorName ?? 'Unknown',
      recentPostCount: (comp.recentPosts ?? []).length,
      activeAdsCount: comp.summary?.activeAdsCount ?? 0,
      topPostEngagement: topPostEng,
      avgEngagement: comp.summary?.avgEngagementPerPost ?? 0,
      totalAds: comp.summary?.totalAdsFound ?? 0,
      adCategories: {
        promotional: comp.adsByCategory?.promotional?.length ?? 0,
        branding: comp.adsByCategory?.branding?.length ?? 0,
        directResponse: comp.adsByCategory?.direct_response?.length ?? 0,
      },
      topAds,
      postThemes,
      errors: comp.errors ?? [],
    };
  });

  // Comparison rows
  const comparison = (intel.comparison?.competitors ?? []).map((row: any) => ({
    competitorName: row.competitorName,
    activeAds: row.adActivity?.activeAds ?? 0,
    postsLast7Days: row.postingFrequency?.postsLast7Days ?? 0,
    postingLabel: row.postingFrequency?.label ?? '',
    avgEngagement: row.engagement?.avgPerPost ?? 0,
    engagementLabel: row.engagement?.label ?? '',
    newCampaigns: row.adActivity?.newCampaignsLast7Days ?? 0,
    hasNewCampaigns: row.adActivity?.hasNewCampaigns ?? false,
  }));

  const marketSummary = intel.comparison?.marketSummary
    ? {
      totalPosts: intel.comparison.marketSummary.totalPostsAcrossAll ?? 0,
      totalAds: intel.comparison.marketSummary.totalAdsAcrossAll ?? 0,
      activeAds: intel.comparison.marketSummary.totalActiveAds ?? 0,
      avgEngagement: intel.comparison.marketSummary.marketAvgEngagement ?? 0,
    }
    : null;

  return {
    scrapedAt: intel.scrapedAt ?? new Date().toISOString(),
    competitors,
    comparison,
    marketSummary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PDFReportGenerator
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Alert mapper — bridge DB Alert fields to template field names
// ─────────────────────────────────────────────────────────────────────────────

function mapAlertForTemplate(a: Alert) {
  return {
    ...a,
    titleEn: a.title,
    descriptionEn: a.description,
    descriptionTh: a.description,
    detectedAt: a.alertDate,
    affectedCompetitors: (a as any).competitorName
      ? [(a as any).competitorName]
      : [`Competitor #${a.competitorId}`],
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// NEW: Market Momentum data builder
// ─────────────────────────────────────────────────────────────────────────────

function buildMarketMomentum(data: ReportData) {
  const marketAdHistory: Array<{ date: string; totalAds: number }> =
    (data as any).marketAdHistory ?? [];

  const totalAdsToday = data.marketOverview.totalActiveAds;
  const totalAdsLastWeek = marketAdHistory.length >= 7
    ? (marketAdHistory[marketAdHistory.length - 7]?.totalAds ?? totalAdsToday)
    : totalAdsToday;
  const adsChangePct = totalAdsLastWeek > 0
    ? round(((totalAdsToday - totalAdsLastWeek) / totalAdsLastWeek) * 100, 1)
    : 0;

  const newEntrants = data.competitors
    .filter((c) => c.latestAnalysis?.trend === 'new')
    .map((c) => ({ name: c.competitor.name, category: c.competitor.category }));

  const risingCompetitors = data.healthScoreRankings
    .filter((r) => r.trend === 'rising')
    .slice(0, 5)
    .map((r) => ({ name: r.competitorName, score: r.totalScore }));

  const topSOV = data.competitors
    .filter((c) => c.latestAnalysis?.shareOfVoice != null)
    .sort((a, b) => (b.latestAnalysis!.shareOfVoice!) - (a.latestAnalysis!.shareOfVoice!))
    .slice(0, 5)
    .map((c) => ({
      name: c.competitor.name,
      sov: round(c.latestAnalysis!.shareOfVoice!, 1),
      isCustomer: c.competitor.isCustomer,
    }));

  const activeAdvertisers = data.competitors.filter(
    (c) => (c.latestAnalysis?.totalActiveAds ?? 0) > 0,
  ).length;

  return {
    totalAdsToday,
    totalAdsLastWeek,
    adsChangePct,
    adsChangePositive: adsChangePct >= 0,
    activeAdvertisers,
    totalCompetitors: data.marketOverview.totalCompetitors,
    newEntrants,
    newEntrantsCount: newEntrants.length,
    risingCompetitors,
    topSOV,
    marketAdHistory,
    hasHistory: marketAdHistory.length > 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Threat Assessment Matrix data builder
// ─────────────────────────────────────────────────────────────────────────────

function buildThreatMatrix(data: ReportData) {
  const THREAT_SCORE: Record<string, number> = {
    critical: 4, high: 3, medium: 2, low: 1,
  };

  const entries = data.competitors.map((c) => {
    const level = c.latestAnalysis?.threatLevel ?? 'low';
    const sov = c.latestAnalysis?.shareOfVoice ?? 0;
    return {
      name: c.competitor.name,
      threatLevel: level,
      threatScore: THREAT_SCORE[level] ?? 1,
      shareOfVoice: round(sov, 1),
      isCustomer: c.competitor.isCustomer,
      category: c.competitor.category,
    };
  });

  const avgSov = entries.reduce((s, e) => s + e.shareOfVoice, 0) / (entries.length || 1);
  const sovThreshold = Math.max(avgSov, 5);

  const quadrants = {
    highThreatHighSov: entries.filter((e) => e.threatScore >= 3 && e.shareOfVoice >= sovThreshold),
    highThreatLowSov: entries.filter((e) => e.threatScore >= 3 && e.shareOfVoice < sovThreshold),
    lowThreatHighSov: entries.filter((e) => e.threatScore < 3 && e.shareOfVoice >= sovThreshold),
    lowThreatLowSov: entries.filter((e) => e.threatScore < 3 && e.shareOfVoice < sovThreshold),
  };

  return {
    entries,
    quadrants,
    sovThreshold: round(sovThreshold, 1),
    criticalCount: entries.filter((e) => e.threatLevel === 'critical').length,
    highCount: entries.filter((e) => e.threatLevel === 'high').length,
    mediumCount: entries.filter((e) => e.threatLevel === 'medium').length,
    lowCount: entries.filter((e) => e.threatLevel === 'low').length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Pricing Battlefield data builder
// ─────────────────────────────────────────────────────────────────────────────

function buildPricingBattlefield(data: ReportData) {
  const withPricing = data.competitors
    .filter((c) => c.latestAnalysis?.pricingData?.averageRate != null)
    .map((c) => {
      const pd = c.latestAnalysis!.pricingData!;
      return {
        name: c.competitor.name,
        isCustomer: c.competitor.isCustomer,
        category: c.competitor.category,
        minPrice: pd.lowestRate ?? 0,
        avgPrice: pd.averageRate ?? 0,
        maxPrice: pd.highestRate ?? 0,
        currency: pd.currency ?? 'THB',
        hasPromotion: (pd.discounts?.length ?? 0) > 0,
        promotionDetail: pd.discounts?.[0]?.description ?? null,
        roomRateCount: pd.roomRates?.length ?? 0,
      };
    })
    .sort((a, b) => a.avgPrice - b.avgPrice);

  if (withPricing.length === 0) {
    return { entries: [], hasPricingData: false, marketMinPrice: 0, marketAvgPrice: 0, marketMaxPrice: 0, currency: 'THB', premiumCount: 0, midRangeCount: 0, budgetCount: 0 };
  }

  const allAvgs = withPricing.map((e) => e.avgPrice).filter((p) => p > 0);
  const marketAvgPrice = allAvgs.reduce((s, p) => s + p, 0) / (allAvgs.length || 1);
  const marketMinPrice = Math.min(...withPricing.map((e) => e.minPrice).filter((p) => p > 0), 99999);
  const marketMaxPrice = Math.max(...withPricing.map((e) => e.maxPrice), 0);
  const currency = withPricing[0]?.currency ?? 'THB';

  const entriesWithPosition = withPricing.map((e) => ({
    ...e,
    positionLabel: e.avgPrice > marketAvgPrice * 1.15
      ? 'Premium'
      : e.avgPrice < marketAvgPrice * 0.85
        ? 'Budget'
        : 'Mid-Range',
    pctAboveMarket: round(((e.avgPrice - marketAvgPrice) / marketAvgPrice) * 100, 0),
  }));

  return {
    entries: entriesWithPosition,
    hasPricingData: true,
    marketMinPrice: round(marketMinPrice === 99999 ? 0 : marketMinPrice, 0),
    marketAvgPrice: round(marketAvgPrice, 0),
    marketMaxPrice: round(marketMaxPrice, 0),
    currency,
    premiumCount: entriesWithPosition.filter((e) => e.positionLabel === 'Premium').length,
    midRangeCount: entriesWithPosition.filter((e) => e.positionLabel === 'Mid-Range').length,
    budgetCount: entriesWithPosition.filter((e) => e.positionLabel === 'Budget').length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Promotion Calendar data builder
// ─────────────────────────────────────────────────────────────────────────────

const PROMO_PATTERNS: Record<string, RegExp> = {
  'Early Bird': /\b(?:early bird|book early|advance booking)\b/i,
  'Last Minute': /\b(?:last minute|flash sale|limited time|today only)\b/i,
  'Discount': /\b(?:\d{1,2}%\s*off|save\s+\d|discount|special rate)\b/i,
  'Free Night': /\b(?:free night|stay \d.*free)\b/i,
  'Package Deal': /\b(?:package|bundle|inclusive|all-inclusive)\b/i,
  'Seasonal': /\b(?:songkran|christmas|new year|valentine|summer|holiday|festival)\b/i,
  'Breakfast': /\b(?:breakfast included|free breakfast)\b/i,
  'Spa': /\b(?:spa credit|spa included|free massage)\b/i,
};

function buildPromoCalendar(data: ReportData) {
  const activePromos: Array<{
    name: string; promoType: string; snippet: string; isCustomer: boolean;
  }> = [];

  for (const c of data.competitors) {
    const allTexts = c.topAds.map((a) => `${a.headline ?? ''} ${a.adCopy ?? ''}`);
    const detectedTypes = new Set<string>();
    for (const text of allTexts) {
      for (const [type, regex] of Object.entries(PROMO_PATTERNS)) {
        if (regex.test(text)) detectedTypes.add(type);
      }
    }
    for (const promoType of detectedTypes) {
      const matchingAd = allTexts.find((t) => PROMO_PATTERNS[promoType]!.test(t));
      activePromos.push({
        name: c.competitor.name,
        promoType,
        snippet: truncate(matchingAd ?? '', 100),
        isCustomer: c.competitor.isCustomer,
      });
    }
  }

  const promoTypeCounts = new Map<string, number>();
  for (const p of activePromos) {
    promoTypeCounts.set(p.promoType, (promoTypeCounts.get(p.promoType) ?? 0) + 1);
  }
  const promoTypeSummary = [...promoTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  const activePromoters = new Set(activePromos.map((p) => p.name)).size;

  return {
    activePromos: activePromos.slice(0, 30),
    promoTypeSummary,
    activePromoCount: activePromos.length,
    activePromoters,
    totalCompetitors: data.marketOverview.totalCompetitors,
    hasPromos: activePromos.length > 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Steal This Playbook data builder
// ─────────────────────────────────────────────────────────────────────────────

function buildStealThisPlaybook(data: ReportData) {
  const llmIntel = (data as any).llmMarketIntel;

  if (llmIntel?.playbook?.length) {
    return {
      strategies: (llmIntel.playbook as any[]).slice(0, 5).map((item: any, i: number) => ({
        rank: i + 1,
        strategyName: item.strategy_name ?? item.title ?? `Strategy ${i + 1}`,
        description: item.description ?? item.rationale ?? '',
        whoDoesIt: item.who_does_it ?? item.competitor_examples ?? [],
        roiConfidence: item.roi_confidence ?? item.confidence ?? 0.7,
        howToSteal: item.how_to_steal ?? item.implementation_steps ?? [],
        estimatedImpact: item.estimated_impact ?? item.impact ?? 'Medium',
      })),
      hasLlmData: true,
      marketOpportunities: (llmIntel.gaps_and_opportunities ?? []).slice(0, 3),
    };
  }

  // Rule-based fallback
  const strategies: Array<{
    rank: number; strategyName: string; description: string;
    whoDoesIt: string[]; roiConfidence: number; howToSteal: string[]; estimatedImpact: string;
  }> = [];

  const strategyFreq = new Map<string, string[]>();
  for (const c of data.competitors) {
    const s = c.latestAnalysis?.marketingStrategyEn;
    if (s) {
      if (!strategyFreq.has(s)) strategyFreq.set(s, []);
      strategyFreq.get(s)!.push(c.competitor.name);
    }
  }
  const topStrategy = [...strategyFreq.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (topStrategy) {
    strategies.push({
      rank: 1,
      strategyName: topStrategy[0],
      description: `The most adopted strategy in the market — used by ${topStrategy[1].length} competitors.`,
      whoDoesIt: topStrategy[1].slice(0, 3),
      roiConfidence: 0.75,
      howToSteal: [
        'Study execution from top performers using this strategy',
        'Identify what differentiates their creative approach',
        'Adapt to your brand voice and primary target segments',
      ],
      estimatedImpact: 'High',
    });
  }

  const promoUsers = data.competitors
    .filter((c) => c.topAds.some((a) =>
      /\b(?:discount|special rate|\d{1,2}%\s*off|package)\b/i.test(`${a.headline ?? ''} ${a.adCopy ?? ''}`),
    ) && (c.pageMetrics?.avgEngagementRate ?? 0) > 2)
    .slice(0, 3);

  if (promoUsers.length > 0) {
    strategies.push({
      rank: 2,
      strategyName: 'Promotional Offers + High-Engagement Content Mix',
      description: 'Combining targeted discount campaigns with engaging organic content drives both conversions and brand recall.',
      whoDoesIt: promoUsers.map((c) => c.competitor.name),
      roiConfidence: 0.8,
      howToSteal: [
        'Run 10–20% off promotions on Meta Ads targeting past website visitors',
        'Pair with behind-the-scenes / guest-story organic posts for authenticity',
        'Retarget engaged users with offers within 7 days of interaction',
      ],
      estimatedImpact: 'High',
    });
  }

  const multiFormatUsers = data.competitors
    .filter((c) => (c.latestAnalysis?.adTypes?.length ?? 0) >= 2)
    .slice(0, 3);
  if (multiFormatUsers.length > 0) {
    strategies.push({
      rank: 3,
      strategyName: 'Multi-Format Creative Strategy',
      description: 'Using video + image + carousel ads in combination maximises reach across different audience segments.',
      whoDoesIt: multiFormatUsers.map((c) => c.competitor.name),
      roiConfidence: 0.7,
      howToSteal: [
        'Create a video showcasing your best room, pool, or facility (15–30s)',
        'Run carousel ads for package deals (swipe to see inclusions)',
        'Use static images for time-sensitive promotional offers',
      ],
      estimatedImpact: 'Medium',
    });
  }

  return {
    strategies: strategies.slice(0, 5),
    hasLlmData: false,
    marketOpportunities: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Creative Intelligence data builder
// ─────────────────────────────────────────────────────────────────────────────

function buildCreativeIntelligence(data: ReportData) {
  const formatTotals = new Map<string, number>();
  for (const c of data.competitors) {
    for (const t of c.latestAnalysis?.adTypes ?? []) {
      formatTotals.set(t.type, (formatTotals.get(t.type) ?? 0) + t.count);
    }
  }
  const formatTotal = [...formatTotals.values()].reduce((s, v) => s + v, 0) || 1;
  const formatEffectiveness = [...formatTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([format, count]) => ({
      format,
      count,
      pct: round((count / formatTotal) * 100, 0),
      label: format.charAt(0).toUpperCase() + format.slice(1),
    }));

  const byPostType = new Map<string, number[]>();
  for (const c of data.competitors) {
    for (const post of c.topPosts) {
      const type = String(post.postType ?? 'unknown');
      const eng = (post.reactions ?? 0) + (post.comments ?? 0) + (post.shares ?? 0);
      if (!byPostType.has(type)) byPostType.set(type, []);
      byPostType.get(type)!.push(eng);
    }
  }
  const postTypeEngagement = [...byPostType.entries()]
    .map(([type, engs]) => ({
      type,
      avgEngagement: round(engs.reduce((s, v) => s + v, 0) / engs.length, 0),
      postCount: engs.length,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  const themeKeywords: Record<string, RegExp> = {
    'Promotions': /\b(?:promo|discount|offer|deal|sale|free|save)\b/i,
    'Dining': /\b(?:restaurant|dining|food|chef|menu|buffet|breakfast)\b/i,
    'Rooms & Suites': /\b(?:room|suite|villa|accommodation)\b/i,
    'Wellness & Spa': /\b(?:spa|wellness|massage|yoga|retreat)\b/i,
    'Events': /\b(?:wedding|event|conference|ceremony)\b/i,
    'Beach & Pool': /\b(?:beach|sea|ocean|sunset|pool)\b/i,
  };

  const allPostTexts = data.competitors.flatMap((c) =>
    c.topPosts.map((p) => p.postText ?? ''),
  );

  const contentThemes = Object.entries(themeKeywords)
    .map(([theme, regex]) => ({
      theme,
      postCount: allPostTexts.filter((t) => regex.test(t)).length,
      pct: round((allPostTexts.filter((t) => regex.test(t)).length / (allPostTexts.length || 1)) * 100, 0),
    }))
    .filter((t) => t.postCount > 0)
    .sort((a, b) => b.postCount - a.postCount);

  const ctaTotals = new Map<string, number>();
  for (const c of data.competitors) {
    for (const ad of c.topAds) {
      const cta = String(ad.ctaType ?? 'unknown');
      ctaTotals.set(cta, (ctaTotals.get(cta) ?? 0) + 1);
    }
  }
  const ctaBreakdown = [...ctaTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cta, count]) => ({
      cta: cta.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      count,
      pct: round((count / ([...ctaTotals.values()].reduce((s, v) => s + v, 0) || 1)) * 100, 0),
    }));

  const topEngagers = data.competitors
    .filter((c) => c.pageMetrics?.avgEngagementRate != null)
    .sort((a, b) => (b.pageMetrics!.avgEngagementRate!) - (a.pageMetrics!.avgEngagementRate!))
    .slice(0, 5)
    .map((c) => ({
      name: c.competitor.name,
      engagementRate: round(c.pageMetrics!.avgEngagementRate!, 2),
      postsLast30d: c.pageMetrics?.postsLast30d ?? 0,
      strategy: c.latestAnalysis?.marketingStrategyEn ?? '—',
      isCustomer: c.competitor.isCustomer,
    }));

  return {
    formatEffectiveness,
    postTypeEngagement,
    contentThemes,
    ctaBreakdown,
    topEngagers,
    totalPostsAnalyzed: allPostTexts.length,
    hasData: allPostTexts.length > 0 || formatTotals.size > 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Strategy Analysis data builder
// ─────────────────────────────────────────────────────────────────────────────

function buildStrategyAnalysis(data: ReportData) {
  const llmIntel = (data as any).llmMarketIntel;

  const strategyFreq = new Map<string, number>();
  const strategyUsers = new Map<string, string[]>();
  for (const c of data.competitors) {
    const s = c.latestAnalysis?.marketingStrategyEn;
    if (s) {
      strategyFreq.set(s, (strategyFreq.get(s) ?? 0) + 1);
      if (!strategyUsers.has(s)) strategyUsers.set(s, []);
      strategyUsers.get(s)!.push(c.competitor.name);
    }
  }

  const dominantStrategies = [...strategyFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([strategy, count]) => ({
      strategy,
      count,
      pct: round((count / (data.competitors.length || 1)) * 100, 0),
      users: (strategyUsers.get(strategy) ?? []).slice(0, 3),
    }));

  const leader = data.healthScoreRankings[0];
  const leaderSummary = leader
    ? data.competitors.find((c) => c.competitor.name === leader.competitorName)
    : null;
  const leaderProfile = leader && leaderSummary ? {
    name: leader.competitorName,
    totalScore: leader.totalScore,
    paidScore: leader.paidScore,
    organicScore: leader.organicScore,
    strategy: leaderSummary.latestAnalysis?.marketingStrategyEn ?? '—',
    usp: leaderSummary.latestAnalysis?.keyUspEn ?? '—',
    activeAds: leaderSummary.latestAnalysis?.totalActiveAds ?? 0,
    followers: leaderSummary.pageMetrics?.followers ?? 0,
    targetSegments: leaderSummary.latestAnalysis?.targetSegments?.map((s) => s.segment) ?? [],
  } : null;

  const avgScore = data.marketOverview.avgHealthScore;
  const topChallengers = data.healthScoreRankings
    .filter((r) => r.trend === 'rising' && r.totalScore > avgScore && r.rank !== 1)
    .slice(0, 3)
    .map((r) => {
      const sum = data.competitors.find((c) => c.competitor.name === r.competitorName);
      return {
        name: r.competitorName,
        score: r.totalScore,
        strategy: sum?.latestAnalysis?.marketingStrategyEn ?? '—',
      };
    });

  const keyInsights: string[] = (llmIntel?.recommended_actions ?? []).slice(0, 3);
  if (keyInsights.length === 0) {
    keyInsights.push(
      `Market average health score: ${round(avgScore, 0)}/100`,
      dominantStrategies[0]
        ? `"${dominantStrategies[0].strategy}" used by ${dominantStrategies[0].count} competitors (${dominantStrategies[0].pct}%)`
        : 'No dominant strategy identified',
      `${data.competitors.filter(c => (c.latestAnalysis?.totalActiveAds ?? 0) > 0).length} of ${data.marketOverview.totalCompetitors} competitors actively advertising`,
    );
  }

  const uspFreq = new Map<string, number>();
  for (const c of data.competitors) {
    const u = c.latestAnalysis?.keyUspEn;
    if (u) uspFreq.set(u, (uspFreq.get(u) ?? 0) + 1);
  }
  const topUSPs = [...uspFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([usp, count]) => ({ usp, count }));

  return {
    dominantStrategies,
    leaderProfile,
    topChallengers,
    keyInsights,
    topUSPs,
    hasLlmData: !!llmIntel,
    llmMarketOverview: llmIntel?.market_overview ?? null,
    llmRiskFactors: (llmIntel?.risk_factors ?? []).slice(0, 3),
  };
}

export class PDFReportGenerator {
  private templates: CompiledTemplates | null = null;
  private chartGen: ChartGenerator;

  constructor() {
    this.chartGen = new ChartGenerator(700, 400);
  }

  private ensureTemplates(): CompiledTemplates {
    if (!this.templates) {
      registerHelpers();
      this.templates = loadTemplates();
    }
    return this.templates;
  }

  // ── Generate complete HTML report ──────────────────────────────────────────

  async generateHtml(data: ReportData): Promise<string> {
    log.info('Building HTML report');
    const t = this.ensureTemplates();

    // 1. Generate charts
    const charts = await this.chartGen.generateAll({
      shareOfVoice: buildShareOfVoiceEntries(data),
      healthScores: buildHealthScoreEntries(data),
      trendLines: buildTrendLineEntries(data.trends),
      segments: buildSegmentEntries(data),
      engagement: buildEngagementEntries(data),
      postFrequency: buildPostFrequencyEntries(data),
      pricingRange: (() => {
        const pd = buildPricingBattlefield(data);
        return pd.hasPricingData ? pd.entries : undefined;
      })(),
      marketAdHistory: (data as any).marketAdHistory ?? undefined,
    });

    // 2. Build template context
    const leaderboardResult = buildLeaderboard(data, (data as any).historicalScores);
    const leaderboard = leaderboardResult.entries;
    const customerComparison = buildCustomerComparison(data);
    const competitorProfiles = buildCompetitorProfiles(data);
    const recGroups = buildRecommendationGroups(data.recommendations);
    const alertSummary = buildAlertSummary(data);

    const criticalAlerts = data.criticalAlerts.filter((a) => a.severity === 'critical').map(mapAlertForTemplate);
    const highAlerts = data.criticalAlerts.filter((a) => a.severity === 'warning').map(mapAlertForTemplate);
    const mediumAlerts = data.criticalAlerts.filter((a) => a.severity === 'info').map(mapAlertForTemplate);

    const ctx = {
      ...data,
      charts,
      leaderboard,
      biggestRisers: leaderboardResult.biggestRisers,
      biggestFallers: leaderboardResult.biggestFallers,
      customerComparison,
      customerRank: customerComparison?.customerRank,
      customerAboveAverage: customerComparison?.customerAboveAverage,
      customerDelta: customerComparison?.customerDelta,
      customerDeltaAbs: customerComparison?.customerDeltaAbs,
      customer: customerComparison?.customer,
      dimensionComparison: customerComparison?.dimensionComparison,
      closestCompetitors: customerComparison?.closestCompetitors,
      marketAvg: customerComparison?.marketAvg,
      competitorProfiles,
      alertSummary,
      criticalAlerts,
      highAlerts,
      mediumAlerts,
      lowAlerts: [],
      alertTimeline: [],
      trendData: data.trends.length > 0,
      trendHighlights: data.trends.slice(0, 6).map((t) => ({
        keyword: t.keyword,
        currentValue: t.value,
        changePct: t.changePct ?? 0,
        trend: (t.changePct ?? 0) > 5 ? 'rising' : (t.changePct ?? 0) < -5 ? 'declining' : 'stable',
      })),
      ...recGroups,

      // SOV-specific
      topAdvertisers: buildShareOfVoiceEntries(data)
        .sort((a, b) => b.adCount - a.adCount)
        .slice(0, 10)
        .map((e, _, arr) => {
          const total = arr.reduce((s, x) => s + x.adCount, 0) || 1;
          return { ...e, activeAds: e.adCount, sharePercent: (e.adCount / total) * 100 };
        }),
      adFormatBreakdown: data.competitors.map((c) => {
        const types = c.latestAnalysis?.adTypes ?? [];
        const total = types.reduce((s, t) => s + t.count, 0) || 1;
        const findType = (name: string) => types.find((t) => t.type === name)?.count ?? 0;
        return {
          name: c.competitor.name,
          isCustomer: c.competitor.isCustomer,
          imageCount: findType('image'),
          imagePct: (findType('image') / total) * 100,
          videoCount: findType('video'),
          videoPct: (findType('video') / total) * 100,
          carouselCount: findType('carousel'),
          carouselPct: (findType('carousel') / total) * 100,
          otherCount: total - findType('image') - findType('video') - findType('carousel'),
          totalAds: c.latestAnalysis?.totalActiveAds ?? 0,
        };
      }),
      segmentSaturation: buildSegmentEntries(data).map((s) => ({
        segmentName: s.segment,
        competitorCount: s.count,
        saturationPct: Math.min(100, Math.round((s.count / (data.marketOverview.totalCompetitors || 1)) * 100)),
      })),

      // New McKinsey sections
      marketMomentum: buildMarketMomentum(data),
      threatMatrix: buildThreatMatrix(data),
      pricingBattlefield: buildPricingBattlefield(data),
      promoCalendar: buildPromoCalendar(data),
      stealThisPlaybook: buildStealThisPlaybook(data),
      creativeIntelligence: buildCreativeIntelligence(data),
      strategyAnalysis: buildStrategyAnalysis(data),

      // Social Media & Ad Intelligence (Apify data)
      socialMediaIntel: buildSocialMediaIntelContext(data),

      // Executive brief — spread to top level so template fields are accessible directly
      ...buildExecutiveBrief(data),
    };

    // 3. Render section partials in McKinsey-style order
    const sections = [
      t.cover(ctx),                                          // 1. Cover
      t.executiveBrief(ctx),                                // 2. Executive Brief
      t.marketMomentum(ctx),                                // 3. Market Momentum
      t.healthLeaderboard(ctx),                             // 4. Health Score Leaderboard
      t.threatMatrix(ctx),                                  // 5. Threat Assessment Matrix
      t.shareOfVoice(ctx),                                  // 6. Share of Voice
      t.pricingBattlefield(ctx),                           // 7. Pricing Battlefield
      t.promotionCalendar(ctx),                             // 8. Promotion Calendar
      t.stealThisPlaybook(ctx),                             // 9. Steal This Playbook
      t.recommendations(ctx),                               // 10. Recommended Actions
      t.creativeIntelligence(ctx),                          // 11. Creative Intelligence
      t.strategyAnalysis(ctx),                              // 12. Strategy Analysis
      customerComparison ? t.customerComparison(ctx) : '', // 13. Your Position
      t.socialMediaIntel(ctx),                              // 14. Social Media Intel
      t.competitorProfile(ctx),                             // 15. Competitor Deep-Dives
      t.alerts(ctx),                                        // 16. Alerts Dashboard
    ].join('\n');

    // 4. Wrap in base layout
    const html = t.base({ ...ctx, body: new Handlebars.SafeString(sections) });
    log.info('HTML report assembled', { length: html.length });
    return html;
  }

  // ── Generate PDF from HTML ─────────────────────────────────────────────────

  async generatePdf(data: ReportData): Promise<{ pdfPath: string; htmlPath: string }> {
    log.info('Starting PDF generation');

    const html = await this.generateHtml(data);

    // Ensure output directory exists
    const outputDir = resolve(settings.pdf.outputDir);
    mkdirSync(outputDir, { recursive: true });

    const dateSlug = toIsoDate(new Date());
    const baseName = `competitor-intel-${dateSlug}`;
    const htmlPath = resolve(outputDir, `${baseName}.html`);
    const pdfPath = resolve(outputDir, `${baseName}.pdf`);

    // Save HTML version (dashboard)
    writeFileSync(htmlPath, html, 'utf-8');
    log.info('HTML dashboard saved', { htmlPath });

    // Launch Puppeteer and render PDF
    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: settings.pdf.puppeteerPath || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60_000 });

      const pdfOptions: PDFOptions = {
        path: pdfPath,
        format: settings.pdf.format as 'A4',
        printBackground: true,
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="font-size:8px;width:100%;text-align:center;color:#a0aec0;padding:0 15mm;">
            <span>Competitor Intelligence Report — ${data.reportDate}</span>
            <span style="float:right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `,
      };

      await page.pdf(pdfOptions);
      log.info('PDF generated successfully', { pdfPath, pages: 'auto' });
    } finally {
      if (browser) await browser.close();
    }

    return { pdfPath, htmlPath };
  }

  // ── Quick generate from ReportData ─────────────────────────────────────────

  async generate(data: ReportData): Promise<ReportData> {
    try {
      const { pdfPath, htmlPath } = await this.generatePdf(data);
      data.pdfPath = pdfPath;
      data.charts = {
        ...data.charts,
        healthScoreComparison: htmlPath,
      };
      log.info('Report generation complete', { pdfPath, htmlPath });
      return data;
    } catch (err) {
      log.error('Report generation failed', { error: toErrorMessage(err) });
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Executive brief builder
// ─────────────────────────────────────────────────────────────────────────────

function buildExecutiveBrief(data: ReportData) {
  const customer = findCustomer(data);
  const customerRanking = data.healthScoreRankings.find(
    (r) => r.competitorName === customer?.competitor.name,
  );

  // Top 3 things to know — template expects topInsights with descriptionEn/descriptionTh
  const topInsights: Array<{ titleEn: string; descriptionEn: string; descriptionTh: string }> = [];

  const topRiser = data.healthScoreRankings[0];
  if (topRiser) {
    topInsights.push({
      titleEn: `${topRiser.competitorName} leads market with score ${round(topRiser.totalScore, 0)}`,
      descriptionEn: `Trend: ${topRiser.trend}. Paid: ${round(topRiser.paidScore, 0)}, Organic: ${round(topRiser.organicScore, 0)}.`,
      descriptionTh: `${topRiser.competitorName} นำตลาดด้วยคะแนน ${round(topRiser.totalScore, 0)} แนวโน้ม: ${topRiser.trend}`,
    });
  }

  const critCount = data.criticalAlerts.filter((a) => a.severity === 'critical').length;
  if (critCount > 0) {
    topInsights.push({
      titleEn: `${critCount} critical alert(s) require immediate attention`,
      descriptionEn: data.criticalAlerts[0]?.title ?? 'Review alerts dashboard for details.',
      descriptionTh: `${critCount} การแจ้งเตือนวิกฤตต้องการความสนใจทันที`,
    });
  }

  topInsights.push({
    titleEn: `${data.marketOverview.totalActiveAds} active ads across ${data.marketOverview.activeCompetitors} advertisers`,
    descriptionEn: `Market average health score: ${round(data.marketOverview.avgHealthScore, 0)}/100.`,
    descriptionTh: `${data.marketOverview.totalActiveAds} โฆษณาจาก ${data.marketOverview.activeCompetitors} คู่แข่ง คะแนนเฉลี่ย ${round(data.marketOverview.avgHealthScore, 0)}/100`,
  });

  const topActions = data.recommendations.slice(0, 3).map((r) => ({
    title: r.title,
    description: truncate(r.description, 100),
    priority: r.priority,
  }));

  const sortedByScore = [...data.healthScoreRankings].sort((a, b) => a.totalScore - b.totalScore);
  const weakest = sortedByScore[0];
  const strongest = sortedByScore[sortedByScore.length - 1];

  const segCounts = new Map<string, number>();
  for (const c of data.competitors) {
    for (const seg of c.latestAnalysis?.targetSegments ?? []) {
      segCounts.set(seg.segment, (segCounts.get(seg.segment) ?? 0) + 1);
    }
  }
  const underServed = [...segCounts.entries()].sort((a, b) => a[1] - b[1])[0];

  return {
    marketStatus: `${data.marketOverview.activeCompetitors} active advertisers / ${data.marketOverview.totalActiveAds} ads`,
    customerPosition: customer
      ? `Rank #${customerRanking?.rank ?? '—'} | Score: ${round(customerRanking?.totalScore ?? 0, 0)}`
      : 'No customer tagged',
    customerScore: customerRanking?.totalScore ?? 0,
    avgHealthScore: data.marketOverview.avgHealthScore,
    totalActiveAds: data.marketOverview.totalActiveAds,
    activeCompetitors: data.marketOverview.activeCompetitors,
    topInsights: topInsights.slice(0, 3),
    topActions,
    biggestOpportunity: weakest
      ? {
        titleEn: underServed
          ? `"${underServed[0]}" segment targeted by only ${underServed[1]} competitors`
          : `${weakest.competitorName} has weak score (${round(weakest.totalScore, 0)}) — potential market gap`,
        titleTh: underServed
          ? `กลุ่ม "${underServed[0]}" มีคู่แข่งเพียง ${underServed[1]} ราย — โอกาสตลาดสูง`
          : `${weakest.competitorName} มีคะแนนต่ำ — ช่องว่างตลาด`,
        detail: 'Increase presence in under-served segments to capture more bookings.',
      }
      : null,
    biggestThreat: strongest
      ? {
        titleEn: `${strongest.competitorName} dominates with score ${round(strongest.totalScore, 0)} — aggressive advertiser`,
        titleTh: `${strongest.competitorName} ครองตลาดด้วยคะแนน ${round(strongest.totalScore, 0)}`,
        detail: 'Monitor their campaigns, creative strategy, and new launch cadence closely.',
      }
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Export singleton for convenience
// ─────────────────────────────────────────────────────────────────────────────

export const pdfGenerator = new PDFReportGenerator();
