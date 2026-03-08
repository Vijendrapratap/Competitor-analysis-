import * as path from 'path';
import * as nunjucks from 'nunjucks';

// ─────────────────────────────────────────────────────────────────────────────
// Health Score Calculator
// ─────────────────────────────────────────────────────────────────────────────

export function calculateHealthScore(
    adCount: number,
    newestAdAgeDays: number | null,
    maxAdVariations: number,
    strategyCount: number,
    engagementRate: number = 0.0,
    marketLeaderAds: number = 31
): number {
    /**
     * Calculate competitor health score (0–100).
     *
     * Formula:
     *   Ad Volume (20%)       — capped at market leader level
     *   Freshness (20%)       — 1.0 if newest < 7 days, degrades to 0
     *   Creative Variations (20%) — capped at 8
     *   Strategy Diversity (20%)  — capped at 7
     *   Engagement (20%)      — capped at 5.0%
     */

    // Ad Volume: 0–20
    const adScore = Math.min(adCount / Math.max(marketLeaderAds, 1), 1.0) * 20;

    // Freshness: 0–20
    let freshness = 0.0;
    if (newestAdAgeDays === null) {
        freshness = 0.0;
    } else if (newestAdAgeDays <= 7) {
        freshness = 1.0;
    } else if (newestAdAgeDays <= 30) {
        freshness = 1.0 - ((newestAdAgeDays - 7) / 23);
    } else if (newestAdAgeDays <= 90) {
        freshness = 0.3 - ((newestAdAgeDays - 30) / 60 * 0.3);
    } else {
        freshness = 0.0;
    }
    const freshnessScore = Math.max(freshness, 0.0) * 20;

    // Creative Variations: 0–20
    const variationScore = Math.min(maxAdVariations / 8, 1.0) * 20;

    // Strategy Diversity: 0–20
    const strategyScore = Math.min(strategyCount / 7, 1.0) * 20;

    // Engagement: 0–20
    const engagementScore = Math.min(engagementRate / 5.0, 1.0) * 20;

    return Math.round((adScore + freshnessScore + variationScore + strategyScore + engagementScore) * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// Share of Voice Calculator
// ─────────────────────────────────────────────────────────────────────────────

export function calculateShareOfVoice(competitors: any[]): any[] {
    /**
     * Calculate share of voice (% of total ads) per competitor.
     * Returns sorted list descending by percentage.
     */
    const totalAds = competitors.reduce((sum, c) => sum + (c.total_active_ads || 0), 0);

    if (totalAds === 0) {
        return competitors.map(c => ({
            name: c.name || 'Unknown',
            pct: 0,
            ad_count: 0,
            trend: c.trend || 'stable',
            is_customer: c.is_customer || false,
        }));
    }

    const result = competitors.map(c => ({
        name: c.name || 'Unknown',
        pct: ((c.total_active_ads || 0) / totalAds) * 100,
        ad_count: c.total_active_ads || 0,
        trend: c.trend || 'stable',
        is_customer: c.is_customer || false,
    }));

    return result.sort((a, b) => b.pct - a.pct);
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Timeline Builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildActivityTimeline(competitors: any[], reportDate: Date = new Date()): any {
    /**
     * Build 4-week activity timeline, last-7-days list, gone-dark list,
     * and campaign velocity stats.
     */
    const weeks = [];
    for (let i = 0; i < 4; i++) {
        const weekStart = new Date(reportDate);
        weekStart.setDate(weekStart.getDate() - 7 * (i + 1));
        const weekEnd = new Date(reportDate);
        weekEnd.setDate(weekEnd.getDate() - 7 * i);

        // Formatting: e.g. "05 Mar"
        const startStr = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const endStr = weekEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

        weeks.push({
            label: `Week ${4 - i} (${startStr} – ${endStr})`,
            start: weekStart,
            end: weekEnd,
            events: [] as Array<{ name: string; type: string }>,
        });
    }

    const last7: string[] = [];
    const goneDark: string[] = [];
    const velocity: any[] = [];

    for (const c of competitors) {
        const name = c.name || 'Unknown';
        const newestDateStr = c.newest_ad_date;
        const adCount = c.total_active_ads || 0;

        let newest: Date | null = null;
        let daysAgo: number | null = null;

        if (newestDateStr) {
            const parsed = new Date(String(newestDateStr).substring(0, 10));
            if (!isNaN(parsed.getTime())) {
                newest = parsed;
                daysAgo = Math.floor((reportDate.getTime() - newest.getTime()) / (1000 * 3600 * 24));
            }
        }

        let eventType = '';
        const isNew = c.is_new_entrant || false;
        if (isNew) {
            eventType = 'new_entrant';
        } else if (adCount >= 5) {
            eventType = 'scaling';
        } else if (adCount > 0) {
            eventType = 'refreshed';
        } else {
            eventType = 'dark';
        }

        if (newest) {
            for (const week of weeks) {
                if (newest >= week.start && newest < week.end) {
                    week.events.push({ name, type: eventType });
                    break;
                }
            }
        }

        if (daysAgo !== null && daysAgo <= 7) {
            last7.push(`${name} — ${adCount} ads (newest ${daysAgo}d ago)`);
        }

        if (daysAgo !== null && daysAgo > 30) {
            goneDark.push(name);
        } else if (daysAgo === null && adCount === 0) {
            goneDark.push(name);
        }

        velocity.push({
            name,
            rate: adCount / 4.0,
        });
    }

    velocity.sort((a, b) => b.rate - a.rate);

    return {
        weeks,
        last_7_days: last7.slice(0, 8),
        gone_dark: goneDark.slice(0, 8),
        campaign_velocity: velocity.slice(0, 5),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Segment Analysis
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SEGMENTS = [
    'Families', 'Couples/Romance', 'Weddings', 'MICE/Corporate',
    'Pet Owners', 'Wellness', 'Thai Residents', 'International',
];

export function buildSegmentMatrix(competitors: any[], segmentData: any = null): any[] {
    if (segmentData) {
        const rows = [];
        for (const [segName, data] of Object.entries<any>(segmentData)) {
            const opp = data.opportunity ?? 50;
            rows.push({
                name: segName,
                active_count: data.active_count || 0,
                saturation: data.saturation || 'medium',
                opportunity_score: opp,
                is_top_opportunity: opp >= 75,
            });
        }
        return rows.sort((a, b) => b.opportunity_score - a.opportunity_score);
    }

    const total = competitors.length;
    const segCounts: Record<string, number> = {};
    for (const seg of DEFAULT_SEGMENTS) {
        segCounts[seg] = 0;
    }

    for (const c of competitors) {
        const targets = c.target_segments || [];
        for (const seg of targets) {
            const segNorm = String(seg).trim();
            if (segCounts[segNorm] !== undefined) {
                segCounts[segNorm]++;
            } else {
                // fuzzy match
                for (const key of Object.keys(segCounts)) {
                    if (segNorm.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(segNorm.toLowerCase())) {
                        segCounts[key] = (segCounts[key] || 0) + 1;
                        break;
                    }
                }
            }
        }
    }

    const rows = [];
    for (const [seg, count] of Object.entries(segCounts)) {
        const pct = total ? (count / total * 100) : 0;
        let saturation = 'low';
        if (pct >= 50) saturation = 'high';
        else if (pct >= 25) saturation = 'medium';

        const opportunity = Math.max(0, Math.min(100, Math.round(100 - pct * 1.2)));

        rows.push({
            name: seg,
            active_count: count,
            saturation,
            opportunity_score: opportunity,
            is_top_opportunity: opportunity >= 75,
        });
    }

    return rows.sort((a, b) => b.opportunity_score - a.opportunity_score);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Generator
// ─────────────────────────────────────────────────────────────────────────────

export function generateIntelligenceSections(reportData: any, intelligence: any): string {
    const competitors = reportData.competitors || [];
    const clientName = reportData.client_name || '';

    let reportDtStr = reportData.report_date || new Date().toISOString().substring(0, 10);
    let reportDt = new Date(reportDtStr);
    if (isNaN(reportDt.getTime())) {
        reportDt = new Date();
    }

    // Set to first of month for consistent formatting
    const dateEn = reportDt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ];
    const dateTh = `${thaiMonths[reportDt.getMonth()]} ${reportDt.getFullYear() + 543}`;

    const totalCompetitors = competitors.length;

    // ── A: Health Scores ────────────────────────────────────────────────────
    const suppliedScores = intelligence.health_scores || {};
    let maxAds = 1;
    for (const c of competitors) {
        const act = c.total_active_ads || 0;
        if (act > maxAds) maxAds = act;
    }

    const healthEntries = [];
    for (const c of competitors) {
        const name = c.name || 'Unknown';
        let score = 0;

        if (suppliedScores[name] !== undefined) {
            score = suppliedScores[name];
        } else {
            const adCount = c.total_active_ads || 0;
            const newest = c.newest_ad_date;
            let age: number | null = null;
            if (newest) {
                const parsed = new Date(String(newest).substring(0, 10));
                if (!isNaN(parsed.getTime())) {
                    age = Math.floor((reportDt.getTime() - parsed.getTime()) / (1000 * 3600 * 24));
                }
            }

            let variations = 0;
            if (c.ad_variations) {
                variations = Math.max(...Object.values(c.ad_variations as Record<string, number>), 0);
            }

            const strats = c.marketing_strategy ? String(c.marketing_strategy).split(',').length : 0;
            const engagement = c.engagement_rate || 0.0;

            score = calculateHealthScore(adCount, age, variations, strats, engagement, maxAds);
        }

        healthEntries.push({
            name,
            score,
            is_customer: clientName ? name.toLowerCase() === clientName.toLowerCase() : false,
            is_leader: c.is_market_leader || false,
            is_inactive: (c.total_active_ads || 0) === 0,
            is_new: c.is_new_entrant || false,
        });
    }

    healthEntries.sort((a, b) => b.score - a.score);

    // ── B: Share of Voice ───────────────────────────────────────────────────
    const trends = intelligence.trends || {};
    for (const c of competitors) {
        c.trend = trends[c.name || ''] || 'stable';
        c.is_customer = clientName ? String(c.name || '').toLowerCase() === clientName.toLowerCase() : false;
    }

    const sov = calculateShareOfVoice(competitors);

    let customerSov = null;
    if (clientName) {
        for (let i = 0; i < sov.length; i++) {
            if (sov[i].is_customer) {
                customerSov = {
                    ...sov[i],
                    rank: i + 1,
                    rank_score: Math.max(0, 100 - (i / Math.max(totalCompetitors, 1)) * 100),
                };
                break;
            }
        }
    }

    // ── C: Activity Timeline ────────────────────────────────────────────────
    const timeline = buildActivityTimeline(competitors, reportDt);

    // ── D: Segments ─────────────────────────────────────────────────────────
    const segmentData = intelligence.segment_matrix || null;
    const segments = buildSegmentMatrix(competitors, segmentData);

    // ── E: Playbook ─────────────────────────────────────────────────────────
    const playbook = intelligence.playbook || [
        {
            campaign_name: 'Analysis pending',
            competitor: 'N/A',
            why_it_works: 'Run the AI analysis pipeline to generate playbook insights.',
            evidence: 'No data yet',
            your_move: 'Complete the data collection and analysis workflow.',
        },
    ];

    // ── F: Actions ──────────────────────────────────────────────────────────
    const urgent = intelligence.urgent_actions || ['Run the competitor analysis pipeline to generate actionable insights.'];
    const important = intelligence.important_actions || ['Configure all competitor profiles.'];
    const strategic = intelligence.strategic_opportunities || ['Review market positioning.'];

    // ── Render ──────────────────────────────────────────────────────────────
    const templateDir = path.join(__dirname, '..', 'templates');

    // Create an environment with the FileSystemLoader
    const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(templateDir), { autoescape: false });

    // If we need to pass a context object instead of multiple args, Nunjucks natively uses a single context object
    const context = {
        brand_name: 'UPMY SKILLS',
        date_en: dateEn,
        date_th: dateTh,
        total_competitors: totalCompetitors,
        page_offset: reportData.page_offset || 3,

        // A
        health_leaderboard: healthEntries,

        // B
        share_of_voice: sov,
        customer_sov: customerSov,

        // C
        activity_weeks: timeline.weeks,
        last_7_days: timeline.last_7_days,
        gone_dark: timeline.gone_dark,
        campaign_velocity: timeline.campaign_velocity,

        // D
        segments: segments,

        // E
        playbook: playbook,

        // F
        urgent_actions: urgent,
        important_actions: important,
        strategic_opportunities: strategic,
    };

    return env.render('intelligence_sections.html', context);
}
