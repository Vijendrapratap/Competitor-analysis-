// =============================================================================
// PDF Report Generator — compiles Handlebars templates → HTML → PDF via Puppeteer
// =============================================================================
import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { settings } from '../config/settings.js';
import { createLogger } from '../utils/logger.js';
import { formatDate, toIsoDate, round, truncate, toErrorMessage } from '../utils/helpers.js';
import { ChartGenerator } from './charts.js';
const log = createLogger('PDFGenerator');
const __dirname = dirname(fileURLToPath(import.meta.url));
// ─────────────────────────────────────────────────────────────────────────────
// Helpers registered on Handlebars
// ─────────────────────────────────────────────────────────────────────────────
function registerHelpers() {
    // Formatting
    Handlebars.registerHelper('formatDate', (d) => formatDate(d));
    Handlebars.registerHelper('formatDateTime', (d) => {
        if (d == null)
            return '—';
        const dt = typeof d === 'string' ? new Date(d) : d;
        return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        }).format(dt);
    });
    Handlebars.registerHelper('round', (val, decimals) => round(Number(val) || 0, typeof decimals === 'number' ? decimals : 0));
    Handlebars.registerHelper('truncate', (text, len) => truncate(String(text ?? ''), Number(len) || 100));
    Handlebars.registerHelper('formatNumber', (val) => {
        const n = Number(val);
        if (!Number.isFinite(n))
            return '—';
        return new Intl.NumberFormat('en-US').format(n);
    });
    Handlebars.registerHelper('formatCurrency', (amount, currency) => {
        const n = Number(amount);
        if (!Number.isFinite(n))
            return '—';
        const cur = String(currency || 'THB');
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
        }
        catch {
            return `${cur} ${new Intl.NumberFormat('en-US').format(n)}`;
        }
    });
    // Score styling
    Handlebars.registerHelper('scoreClass', (score) => {
        const s = Number(score) || 0;
        if (s >= 70)
            return 'score-green';
        if (s >= 40)
            return 'score-yellow';
        return 'score-red';
    });
    Handlebars.registerHelper('scoreColor', (score) => {
        const s = Number(score) || 0;
        if (s >= 70)
            return '#38a169';
        if (s >= 40)
            return '#d69e2e';
        return '#e53e3e';
    });
    // Trend helpers
    Handlebars.registerHelper('trendArrow', (trend) => {
        const t = String(trend).toLowerCase();
        if (t === 'rising')
            return '▲';
        if (t === 'declining')
            return '▼';
        if (t === 'new')
            return '★';
        return '—';
    });
    Handlebars.registerHelper('lowercase', (val) => String(val ?? '').toLowerCase());
    // Percentages
    Handlebars.registerHelper('pct', (part, total) => {
        const p = Number(part) || 0;
        const t = Number(total) || 1;
        return Math.round((p / t) * 100);
    });
    // Saturation colour
    Handlebars.registerHelper('saturationColor', (pct) => {
        const p = Number(pct) || 0;
        if (p >= 75)
            return '#e53e3e';
        if (p >= 50)
            return '#d69e2e';
        if (p >= 25)
            return '#3182ce';
        return '#38a169';
    });
    // Day colour for alert timeline heatmap
    Handlebars.registerHelper('dayColor', (count, severity) => {
        const c = Number(count) || 0;
        if (c === 0)
            return '#f7fafc';
        const sev = String(severity).toLowerCase();
        if (sev === 'critical' || sev === 'high')
            return '#e53e3e';
        if (c >= 3)
            return '#d69e2e';
        return '#ecc94b44';
    });
    // Threat badge class
    Handlebars.registerHelper('threatBadgeClass', (level) => {
        const l = String(level).toLowerCase();
        if (l === 'critical')
            return 'badge-critical';
        if (l === 'high')
            return 'badge-warning';
        return 'badge-info';
    });
    // Array/string join
    Handlebars.registerHelper('join', (arr, sep) => {
        if (!Array.isArray(arr))
            return '';
        return arr.join(String(sep ?? ', '));
    });
    // 1-based index
    Handlebars.registerHelper('@index1', function () {
        return (this.index ?? 0) + 1;
    });
    // Comparison helpers
    Handlebars.registerHelper('gt', (a, b) => Number(a) > Number(b));
    Handlebars.registerHelper('lt', (a, b) => Number(a) < Number(b));
    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('and', (a, b) => a && b);
    Handlebars.registerHelper('or', (a, b) => a || b);
}
function loadTemplates() {
    const dir = resolve(__dirname, 'templates');
    const load = (name) => {
        const path = resolve(dir, `${name}.hbs`);
        const source = readFileSync(path, 'utf-8');
        return Handlebars.compile(source);
    };
    log.info('Loading Handlebars templates from', { dir });
    return {
        base: load('base'),
        cover: load('cover'),
        executiveBrief: load('executiveBrief'),
        healthLeaderboard: load('healthLeaderboard'),
        customerComparison: load('customerComparison'),
        shareOfVoice: load('shareOfVoice'),
        socialMediaIntel: load('socialMediaIntel'),
        competitorProfile: load('competitorProfile'),
        alerts: load('alerts'),
        recommendations: load('recommendations'),
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Data preparation helpers
// ─────────────────────────────────────────────────────────────────────────────
function buildLeaderboard(data) {
    return data.healthScoreRankings.map((r) => {
        const summary = data.competitors.find((c) => c.competitor.name === r.competitorName);
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
        };
    });
}
function buildAlertSummary(data) {
    const allAlerts = data.criticalAlerts;
    return {
        critical: allAlerts.filter((a) => a.severity === 'critical').length,
        high: allAlerts.filter((a) => a.severity === 'warning').length,
        medium: allAlerts.filter((a) => a.severity === 'info').length,
        low: 0,
    };
}
function buildShareOfVoiceEntries(data) {
    return data.competitors
        .filter((c) => c.latestAnalysis)
        .map((c) => ({
        name: c.competitor.name,
        adCount: c.latestAnalysis.totalActiveAds,
        isCustomer: c.competitor.isCustomer,
    }));
}
function buildHealthScoreEntries(data) {
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
function buildTrendLineEntries(trends) {
    const byKeyword = new Map();
    for (const t of trends) {
        const key = t.keyword;
        if (!byKeyword.has(key))
            byKeyword.set(key, []);
        byKeyword.get(key).push({ date: toIsoDate(t.trendDate), value: t.value });
    }
    return [...byKeyword.entries()].map(([keyword, dataPoints]) => ({ keyword, dataPoints }));
}
function buildSegmentEntries(data) {
    const counts = new Map();
    for (const c of data.competitors) {
        if (!c.latestAnalysis?.targetSegments)
            continue;
        for (const seg of c.latestAnalysis.targetSegments) {
            counts.set(seg.segment, (counts.get(seg.segment) ?? 0) + 1);
        }
    }
    return [...counts.entries()].map(([segment, count]) => ({ segment, count }));
}
function buildEngagementEntries(data) {
    return data.competitors
        .filter((c) => c.pageMetrics?.avgEngagementRate != null)
        .map((c) => ({
        name: c.competitor.name,
        engagementRate: c.pageMetrics.avgEngagementRate,
        followers: c.pageMetrics.followers ?? 0,
        isCustomer: c.competitor.isCustomer,
    }));
}
function buildPostFrequencyEntries(data) {
    return data.competitors
        .filter((c) => c.pageMetrics?.postsLast30d != null)
        .map((c) => ({
        name: c.competitor.name,
        postsLast30d: c.pageMetrics.postsLast30d,
        isCustomer: c.competitor.isCustomer,
    }));
}
function findCustomer(data) {
    return data.competitors.find((c) => c.competitor.isCustomer);
}
function buildCustomerComparison(data) {
    const customer = findCustomer(data);
    if (!customer)
        return null;
    const customerScore = customer.healthScore;
    const customerRank = data.healthScoreRankings.findIndex((r) => r.competitorName === customer.competitor.name) + 1;
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
function buildDimensionComparison(data, customerScore) {
    const dimensions = [
        { nameEn: 'Total Score', nameTh: 'คะแนนรวม', key: 'totalScore' },
        { nameEn: 'Paid Score', nameTh: 'คะแนนโฆษณา', key: 'paidScore' },
        { nameEn: 'Organic Score', nameTh: 'คะแนนออร์แกนิก', key: 'organicScore' },
    ];
    return dimensions.map((dim) => {
        const customerValue = customerScore
            ? customerScore[dim.key]
            : 0;
        const allScores = data.healthScoreRankings.map((r) => r[dim.key]);
        const marketAvg = allScores.length
            ? allScores.reduce((s, v) => s + v, 0) / allScores.length
            : 0;
        const leaderValue = Math.max(...allScores, 0);
        const leaderEntry = data.healthScoreRankings.find((r) => r[dim.key] === leaderValue);
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
function buildClosestCompetitors(data, customerScore, customerName) {
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
function buildMarketAverages(data) {
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
function buildCompetitorProfiles(data) {
    return data.competitors.map((c, i) => {
        const ranking = data.healthScoreRankings.find((r) => r.competitorName === c.competitor.name);
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
function buildRecommendationGroups(recs) {
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
function buildSocialMediaIntelContext(data) {
    // @ts-ignore — socialMediaIntel is optional and comes from aggregated Apify data
    const intel = data.socialMediaIntel;
    if (!intel)
        return null;
    const competitors = (intel.aggregated ?? []).map((comp) => {
        const topPost = comp.summary?.topPerformingPost;
        const topPostEng = topPost
            ? (topPost.likes ?? 0) + (topPost.comments ?? 0) + (topPost.shares ?? 0)
            : 0;
        // Top 2-3 ads for ad copy highlights
        const topAds = (comp.activeAds ?? []).slice(0, 3).map((ad) => ({
            headline: truncate(ad.adHeadline ?? '', 150),
            text: truncate(ad.adText ?? '', 150),
            cta: ad.callToAction ?? 'None',
            platforms: (ad.platforms ?? ['Facebook']).join(', '),
            startDate: ad.adStartDate ?? null,
        }));
        // Post themes extraction
        const themeKeywords = {
            'Promotions': /\b(?:promo|discount|offer|deal|sale|free|save|โปร|ลดราคา)\b/i,
            'Dining': /\b(?:restaurant|dining|food|chef|menu|buffet|breakfast|อาหาร)\b/i,
            'Rooms': /\b(?:room|suite|villa|accommodation|ห้องพัก|วิลล่า)\b/i,
            'Wellness': /\b(?:spa|wellness|massage|yoga|retreat|สปา)\b/i,
            'Events': /\b(?:wedding|event|conference|ceremony|งานแต่ง)\b/i,
            'Beach & Nature': /\b(?:beach|sea|ocean|sunset|pool|ทะเล|ชายหาด)\b/i,
        };
        const postTexts = (comp.recentPosts ?? []).map((p) => p.postText ?? '');
        const postThemes = Object.entries(themeKeywords)
            .map(([theme, regex]) => ({
            theme,
            postCount: postTexts.filter((t) => regex.test(t)).length,
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
    const comparison = (intel.comparison?.competitors ?? []).map((row) => ({
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
export class PDFReportGenerator {
    templates = null;
    chartGen;
    constructor() {
        this.chartGen = new ChartGenerator(700, 400);
    }
    ensureTemplates() {
        if (!this.templates) {
            registerHelpers();
            this.templates = loadTemplates();
        }
        return this.templates;
    }
    // ── Generate complete HTML report ──────────────────────────────────────────
    async generateHtml(data) {
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
        });
        // 2. Build template context
        const leaderboard = buildLeaderboard(data);
        const customerComparison = buildCustomerComparison(data);
        const competitorProfiles = buildCompetitorProfiles(data);
        const recGroups = buildRecommendationGroups(data.recommendations);
        const alertSummary = buildAlertSummary(data);
        const criticalAlerts = data.criticalAlerts.filter((a) => a.severity === 'critical');
        const highAlerts = data.criticalAlerts.filter((a) => a.severity === 'warning');
        const mediumAlerts = data.criticalAlerts.filter((a) => a.severity === 'info');
        const ctx = {
            ...data,
            charts,
            leaderboard,
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
                const findType = (name) => types.find((t) => t.type === name)?.count ?? 0;
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
            // Executive brief fields
            executiveBrief: buildExecutiveBrief(data),
            // Social Media & Ad Intelligence (Apify data)
            socialMediaIntel: buildSocialMediaIntelContext(data),
        };
        // 3. Render section partials
        const sections = [
            t.cover(ctx),
            t.executiveBrief(ctx),
            t.healthLeaderboard(ctx),
            customerComparison ? t.customerComparison(ctx) : '',
            t.shareOfVoice(ctx),
            t.socialMediaIntel(ctx),
            t.competitorProfile(ctx),
            t.alerts(ctx),
            t.recommendations(ctx),
        ].join('\n');
        // 4. Wrap in base layout
        const html = t.base({ ...ctx, body: new Handlebars.SafeString(sections) });
        log.info('HTML report assembled', { length: html.length });
        return html;
    }
    // ── Generate PDF from HTML ─────────────────────────────────────────────────
    async generatePdf(data) {
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
        let browser = null;
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
            const pdfOptions = {
                path: pdfPath,
                format: settings.pdf.format,
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
        }
        finally {
            if (browser)
                await browser.close();
        }
        return { pdfPath, htmlPath };
    }
    // ── Quick generate from ReportData ─────────────────────────────────────────
    async generate(data) {
        try {
            const { pdfPath, htmlPath } = await this.generatePdf(data);
            data.pdfPath = pdfPath;
            data.charts = {
                ...data.charts,
                healthScoreComparison: htmlPath,
            };
            log.info('Report generation complete', { pdfPath, htmlPath });
            return data;
        }
        catch (err) {
            log.error('Report generation failed', { error: toErrorMessage(err) });
            throw err;
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Executive brief builder
// ─────────────────────────────────────────────────────────────────────────────
function buildExecutiveBrief(data) {
    const customer = findCustomer(data);
    const customerRanking = data.healthScoreRankings.find((r) => r.competitorName === customer?.competitor.name);
    // Top 3 things to know
    const insights = [];
    // Highest riser
    const topRiser = data.healthScoreRankings[0];
    if (topRiser) {
        insights.push({
            titleEn: `${topRiser.competitorName} leads with score ${round(topRiser.totalScore, 0)}`,
            titleTh: `${topRiser.competitorName} นำด้วยคะแนน ${round(topRiser.totalScore, 0)}`,
            detail: `Trend: ${topRiser.trend}`,
        });
    }
    // Alert count
    const critCount = data.criticalAlerts.filter((a) => a.severity === 'critical').length;
    if (critCount > 0) {
        insights.push({
            titleEn: `${critCount} critical alert(s) require immediate attention`,
            titleTh: `${critCount} การแจ้งเตือนวิกฤตต้องการความสนใจทันที`,
            detail: data.criticalAlerts[0]?.title ?? '',
        });
    }
    // Total ads in market
    insights.push({
        titleEn: `${data.marketOverview.totalActiveAds} active ads across ${data.marketOverview.activeCompetitors} competitors`,
        titleTh: `${data.marketOverview.totalActiveAds} โฆษณาจาก ${data.marketOverview.activeCompetitors} คู่แข่ง`,
        detail: `Average health score: ${round(data.marketOverview.avgHealthScore, 0)}`,
    });
    // Top 3 recommended actions
    const topActions = data.recommendations.slice(0, 3).map((r) => ({
        title: r.title,
        description: truncate(r.description, 100),
        priority: r.priority,
    }));
    // Biggest opportunity & threat
    const sortedByScore = [...data.healthScoreRankings].sort((a, b) => a.totalScore - b.totalScore);
    const weakest = sortedByScore[0];
    const strongest = sortedByScore[sortedByScore.length - 1];
    return {
        marketStatus: `${data.marketOverview.activeCompetitors} active competitors, ${data.marketOverview.totalActiveAds} ads`,
        customerPosition: customer
            ? `Rank #${customerRanking?.rank ?? '—'} | Score: ${round(customerRanking?.totalScore ?? 0, 0)}`
            : 'No customer tagged',
        customerScore: customerRanking?.totalScore ?? 0,
        avgHealthScore: data.marketOverview.avgHealthScore,
        totalActiveAds: data.marketOverview.totalActiveAds,
        activeCompetitors: data.marketOverview.activeCompetitors,
        insights: insights.slice(0, 3),
        topActions,
        biggestOpportunity: weakest
            ? { name: weakest.competitorName, score: weakest.totalScore, reason: 'Lowest health score — potential market gap' }
            : null,
        biggestThreat: strongest
            ? { name: strongest.competitorName, score: strongest.totalScore, reason: 'Highest health score — dominant player' }
            : null,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Export singleton for convenience
// ─────────────────────────────────────────────────────────────────────────────
export const pdfGenerator = new PDFReportGenerator();
//# sourceMappingURL=pdfGenerator.js.map