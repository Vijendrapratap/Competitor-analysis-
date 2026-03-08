// =============================================================================
// Alert Detector — identifies important market changes
//
// Compares current scrape data against historical data to detect significant
// events that warrant attention: new entrants, ad surges, price wars,
// viral content, rating drops, seasonal pushes, and more.
//
// Each alert is categorised by severity (critical → info) and includes a
// recommended action.
// =============================================================================
import { createLogger } from '../utils/logger.js';
import { round, toErrorMessage } from '../utils/helpers.js';
import { AlertType, AlertSeverity, } from '../types/index.js';
const log = createLogger('AlertDetector');
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MS_PER_DAY = 1_000 * 60 * 60 * 24;
/**
 * Seasonal themes to detect when multiple competitors push the same campaign.
 * Key = theme label, value = content-category + keywords to match.
 */
const SEASONAL_THEMES = [
    { label: 'Songkran', pattern: /songkran|สงกรานต์|water\s*festival/i },
    { label: 'Loy Krathong', pattern: /loy\s*krathong|ลอยกระทง/i },
    { label: 'Chinese New Year', pattern: /chinese\s*new\s*year|ตรุษจีน|lunar\s*new\s*year/i },
    { label: 'Christmas & New Year', pattern: /christmas|new\s*year|festive|holiday\s*season|คริสต์มาส|ปีใหม่/i },
    { label: 'Valentine\'s Day', pattern: /valentine|romantic|วาเลนไทน์/i },
    { label: 'Summer Holidays', pattern: /summer|school\s*holiday|family\s*getaway|ปิดเทอม/i },
];
// ─────────────────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────────────────
export class AlertDetector {
    // ─── Main detection pipeline ────────────────────────────────────────────
    detectAlerts(currentData, historicalData, trendSnapshot) {
        const alerts = [];
        const now = new Date();
        log.info(`Detecting alerts for ${currentData.length} competitors...`);
        // ── Per-competitor checks ──────────────────────────────────────────
        for (const current of currentData) {
            const history = historicalData.get(current.competitor.id);
            try {
                const competitorAlerts = this.detectCompetitorAlerts(current, history ?? null, now);
                alerts.push(...competitorAlerts);
            }
            catch (err) {
                log.warn(`  Alert detection failed for ${current.competitor.name}: ${toErrorMessage(err)}`);
            }
        }
        // ── Cross-competitor checks ────────────────────────────────────────
        alerts.push(...this.detectPriceWar(currentData, now));
        alerts.push(...this.detectSeasonalPush(currentData, now));
        // ── Trend checks ──────────────────────────────────────────────────
        if (trendSnapshot) {
            alerts.push(...this.detectTrendSpikes(trendSnapshot, now));
        }
        log.info(`Detected ${alerts.length} alert${alerts.length !== 1 ? 's' : ''}: ` +
            `${alerts.filter((a) => a.severity === AlertSeverity.Critical).length} critical, ` +
            `${alerts.filter((a) => a.severity === AlertSeverity.Warning).length} warning, ` +
            `${alerts.filter((a) => a.severity === AlertSeverity.Info).length} info`);
        return alerts;
    }
    // ─── Categorize by priority ─────────────────────────────────────────────
    categorizeByPriority(alerts) {
        return {
            critical: alerts.filter((a) => a.severity === AlertSeverity.Critical),
            high: alerts.filter((a) => a.severity === AlertSeverity.Warning &&
                [
                    AlertType.HighAdVolume,
                    AlertType.ThreatEscalation,
                    AlertType.EngagementSpike,
                ].includes(a.alertType)),
            medium: alerts.filter((a) => a.severity === AlertSeverity.Warning &&
                ![
                    AlertType.HighAdVolume,
                    AlertType.ThreatEscalation,
                    AlertType.EngagementSpike,
                ].includes(a.alertType)),
            low: alerts.filter((a) => a.severity === AlertSeverity.Info),
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Per-competitor detection
    // ─────────────────────────────────────────────────────────────────────────
    detectCompetitorAlerts(current, history, now) {
        const alerts = [];
        const { competitor, ads, posts, pageMetrics } = current;
        const cid = competitor.id;
        // ── CRITICAL: New entrant ──────────────────────────────────────────
        if (!history && ads.length > 0) {
            alerts.push(this.makeAlert(now, AlertType.NewCompetitor, AlertSeverity.Critical, cid, competitor.name, `New advertiser detected: ${competitor.name}`, `${competitor.name} has appeared in the ad landscape with ${ads.length} active ad${ads.length !== 1 ? 's' : ''}. ` +
                `No historical data exists, indicating this is a new entrant or a competitor that has resumed advertising.`, `Review their ad creatives and landing pages to understand their positioning. ` +
                `Assess whether they target overlapping segments.`));
        }
        // ── CRITICAL: Competitor went dark ────────────────────────────────
        if (history && history.previousAds.length >= 5 && ads.length === 0) {
            const daysSinceLastAd = this.daysSinceNewestAd(history.previousAds, now);
            if (daysSinceLastAd >= 30) {
                alerts.push(this.makeAlert(now, AlertType.NewCampaign, AlertSeverity.Critical, cid, competitor.name, `Competitor went dark: ${competitor.name}`, `${competitor.name} had ${history.previousAds.length} active ads but now has zero. ` +
                    `Their newest known ad is ${daysSinceLastAd} days old. This may indicate a strategic pause, ` +
                    `budget reallocation, or preparation for a major new campaign.`, `Monitor for reactivation. Consider increasing your own ad presence to capture their share of voice.`));
            }
        }
        // ── HIGH: Scaling campaign ────────────────────────────────────────
        if (history) {
            const prevMaxVariations = Math.max(1, ...history.previousAds.map((a) => a.adVariationsCount));
            const currMaxVariations = Math.max(1, ...ads.map((a) => a.adVariationsCount));
            if (prevMaxVariations <= 2 && currMaxVariations >= 5) {
                alerts.push(this.makeAlert(now, AlertType.NewCampaign, AlertSeverity.Warning, cid, competitor.name, `Campaign scaling: ${competitor.name}`, `${competitor.name} scaled their ad variations from ${prevMaxVariations} to ${currMaxVariations}. ` +
                    `This indicates A/B testing at scale and a likely budget increase.`, `Analyse their new creatives for messaging shifts. Consider diversifying your own ad variations.`));
            }
        }
        // ── HIGH: Ad surge (50%+ week-over-week) ─────────────────────────
        if (history && history.previousAds.length > 0) {
            const growth = ((ads.length - history.previousAds.length) / history.previousAds.length) * 100;
            if (growth >= 50 && ads.length >= 5) {
                alerts.push(this.makeAlert(now, AlertType.HighAdVolume, AlertSeverity.Warning, cid, competitor.name, `Ad surge: ${competitor.name} (+${round(growth, 0)}%)`, `${competitor.name} increased from ${history.previousAds.length} to ${ads.length} active ads ` +
                    `(+${round(growth, 0)}% week over week). This aggressive expansion suggests a new campaign launch or budget spike.`, `Review the new ads for themes or offers that may compete directly with your campaigns.`));
            }
        }
        // ── HIGH: Rating drop ────────────────────────────────────────────
        if (history?.previousPageMetrics?.rating != null &&
            pageMetrics?.rating != null) {
            const drop = history.previousPageMetrics.rating - pageMetrics.rating;
            if (drop >= 0.3) {
                alerts.push(this.makeAlert(now, AlertType.ThreatEscalation, AlertSeverity.Warning, cid, competitor.name, `Rating drop: ${competitor.name} (${history.previousPageMetrics.rating} → ${pageMetrics.rating})`, `${competitor.name}'s page rating dropped from ${history.previousPageMetrics.rating} to ${pageMetrics.rating} ` +
                    `(−${round(drop, 1)} stars). This may indicate service quality issues or negative press.`, `Monitor their reviews for specific complaints. This could be an opportunity to differentiate on quality.`));
            }
        }
        // ── MEDIUM: Viral post ───────────────────────────────────────────
        if (history && history.avgEngagement > 0) {
            const viralThreshold = history.avgEngagement * 5;
            const viralPosts = posts.filter((p) => {
                const engagement = p.reactions + p.comments * 2 + p.shares * 3;
                return engagement >= viralThreshold;
            });
            for (const vp of viralPosts.slice(0, 2)) {
                const engagement = vp.reactions + vp.comments * 2 + vp.shares * 3;
                alerts.push(this.makeAlert(now, AlertType.ViralContent, AlertSeverity.Warning, cid, competitor.name, `Viral content: ${competitor.name}`, `A ${vp.postType} post from ${competitor.name} received ${vp.reactions} reactions, ` +
                    `${vp.comments} comments, and ${vp.shares} shares (engagement score: ${engagement}, ` +
                    `${round(engagement / history.avgEngagement, 1)}× their average). ` +
                    `Category: ${vp.contentCategory}.`, `Study the content format and topic. Consider creating similar content or a timely response.`));
            }
        }
        // ── MEDIUM: Format shift (50%+ video) ────────────────────────────
        if (history && history.previousAds.length >= 3 && ads.length >= 3) {
            const prevVideoRatio = history.previousAds.filter((a) => a.creativeType === 'video').length /
                history.previousAds.length;
            const currVideoRatio = ads.filter((a) => a.creativeType === 'video').length / ads.length;
            if (prevVideoRatio < 0.3 && currVideoRatio >= 0.5) {
                alerts.push(this.makeAlert(now, AlertType.NewCampaign, AlertSeverity.Warning, cid, competitor.name, `Format shift to video: ${competitor.name}`, `${competitor.name} shifted from ${round(prevVideoRatio * 100, 0)}% to ${round(currVideoRatio * 100, 0)}% ` +
                    `video content in their ads. This suggests a strategic move towards richer media formats.`, `Evaluate your own video content strategy. Video typically drives higher engagement in hospitality.`));
            }
        }
        // ── LOW: Minor ad changes ────────────────────────────────────────
        if (history && history.previousAds.length > 0 && ads.length > 0) {
            const change = Math.abs(ads.length - history.previousAds.length);
            const changePct = (change / history.previousAds.length) * 100;
            if (changePct > 10 && changePct < 50 && change >= 2) {
                const direction = ads.length > history.previousAds.length ? 'increased' : 'decreased';
                alerts.push(this.makeAlert(now, AlertType.NewCampaign, AlertSeverity.Info, cid, competitor.name, `Ad count ${direction}: ${competitor.name}`, `${competitor.name} ${direction} their active ads from ${history.previousAds.length} to ${ads.length} ` +
                    `(${direction === 'increased' ? '+' : '−'}${round(changePct, 0)}%).`, null));
            }
        }
        // ── MEDIUM: Page milestone ───────────────────────────────────────
        if (pageMetrics?.followers && history?.previousPageMetrics?.followers) {
            const milestones = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
            for (const milestone of milestones) {
                if (history.previousPageMetrics.followers < milestone &&
                    pageMetrics.followers >= milestone) {
                    alerts.push(this.makeAlert(now, AlertType.PageMilestone, AlertSeverity.Warning, cid, competitor.name, `Milestone: ${competitor.name} reached ${this.formatNumber(milestone)} followers`, `${competitor.name} crossed the ${this.formatNumber(milestone)}-follower mark ` +
                        `(now at ${this.formatNumber(pageMetrics.followers)}). This enhances their organic reach significantly.`, `Review their growth tactics and engagement strategy around this milestone.`));
                    break; // Only report the highest milestone crossed
                }
            }
        }
        return alerts;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Cross-competitor detection
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * CRITICAL: Price war — 3+ competitors offering 30%+ discounts.
     */
    detectPriceWar(currentData, now) {
        const heavyDiscounters = [];
        for (const { competitor, ads } of currentData) {
            for (const ad of ads) {
                if (ad.extractedDiscount != null && ad.extractedDiscount >= 30) {
                    const existing = heavyDiscounters.find((d) => d.name === competitor.name);
                    if (existing) {
                        existing.maxDiscount = Math.max(existing.maxDiscount, ad.extractedDiscount);
                    }
                    else {
                        heavyDiscounters.push({ name: competitor.name, maxDiscount: ad.extractedDiscount });
                    }
                }
            }
        }
        if (heavyDiscounters.length >= 3) {
            const names = heavyDiscounters.map((d) => `${d.name} (${d.maxDiscount}%)`).join(', ');
            return [
                this.makeAlert(now, AlertType.PriceChange, AlertSeverity.Critical, 0, undefined, `Price war detected: ${heavyDiscounters.length} competitors offering 30%+ discounts`, `Multiple competitors are running aggressive discount campaigns: ${names}. ` +
                    `This indicates a price war in the market that could erode margins across the segment.`, `Evaluate whether to match discounts or differentiate on value-add. ` +
                    `Consider highlighting exclusive benefits rather than price alone.`),
            ];
        }
        return [];
    }
    /**
     * HIGH: Seasonal push — 3+ competitors launched the same seasonal theme.
     */
    detectSeasonalPush(currentData, now) {
        const alerts = [];
        for (const theme of SEASONAL_THEMES) {
            const matchingCompetitors = [];
            for (const { competitor, ads, posts } of currentData) {
                const allText = [
                    ...ads.map((a) => [a.adCopy, a.headline].filter(Boolean).join(' ')),
                    ...posts.map((p) => p.postText ?? ''),
                ].join(' ');
                if (theme.pattern.test(allText)) {
                    matchingCompetitors.push(competitor.name);
                }
            }
            if (matchingCompetitors.length >= 3) {
                alerts.push(this.makeAlert(now, AlertType.EngagementSpike, AlertSeverity.Warning, 0, undefined, `Seasonal push: ${theme.label} (${matchingCompetitors.length} competitors)`, `${matchingCompetitors.length} competitors are running ${theme.label}-themed campaigns: ` +
                    `${matchingCompetitors.slice(0, 5).join(', ')}${matchingCompetitors.length > 5 ? '...' : ''}. ` +
                    `This is a coordinated seasonal push in the market.`, `If you haven't launched a ${theme.label} campaign, consider a timely response. ` +
                    `Focus on unique angles to stand out from the competition.`));
            }
        }
        return alerts;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Trend-based detection
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * MEDIUM: Trend spike — keyword +50% MoM on Google Trends.
     */
    detectTrendSpikes(trendSnapshot, now) {
        const alerts = [];
        for (const trend of trendSnapshot.trends) {
            if (trend.changePct !== null && trend.changePct >= 50) {
                alerts.push(this.makeAlert(now, AlertType.EngagementSpike, AlertSeverity.Warning, 0, undefined, `Trend spike: "${trend.keyword}" (+${round(trend.changePct, 0)}%)`, `Google Trends data shows "${trend.keyword}" surged ${round(trend.changePct, 0)}% month-over-month ` +
                    `(current value: ${trend.value}/100). This indicates rising consumer interest.`, `Consider creating content or ads targeting "${trend.keyword}" to capture the demand spike.`));
            }
        }
        return alerts;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────
    makeAlert(now, alertType, severity, competitorId, competitorName, title, description, actionRequired) {
        return {
            alertDate: now,
            alertType,
            severity,
            competitorId,
            competitorName,
            title,
            description,
            actionRequired,
            isSent: false,
        };
    }
    daysSinceNewestAd(ads, now) {
        let newest = null;
        for (const ad of ads) {
            if (ad.startedRunning && (!newest || ad.startedRunning > newest)) {
                newest = ad.startedRunning;
            }
        }
        if (!newest)
            return 999;
        return Math.floor((now.getTime() - newest.getTime()) / MS_PER_DAY);
    }
    formatNumber(n) {
        if (n >= 1_000_000)
            return `${round(n / 1_000_000, 1)}M`;
        if (n >= 1_000)
            return `${round(n / 1_000, 0)}K`;
        return String(n);
    }
}
//# sourceMappingURL=alerts.js.map