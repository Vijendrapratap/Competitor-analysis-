// =============================================================================
// Recommendation Engine — AI-powered actionable insights
//
// Combines the customer's current metrics, market averages, leader metrics,
// active trends, and recent alerts to generate 5–10 concrete, prioritised
// recommendations using Claude AI. Each recommendation is specific to the
// hotel/hospitality industry in the Thai market.
// =============================================================================
import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger.js';
import { sleep, toErrorMessage, truncate, round, formatDuration, } from '../utils/helpers.js';
import { settings } from '../config/settings.js';
import { RecommendationPriority } from '../types/index.js';
const log = createLogger('RecommendationEngine');
// ─────────────────────────────────────────────────────────────────────────────
// Priority mapping
// ─────────────────────────────────────────────────────────────────────────────
const PRIORITY_MAP = {
    urgent: RecommendationPriority.Urgent,
    important: RecommendationPriority.High,
    consider: RecommendationPriority.Medium,
};
// ─────────────────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────────────────
export class RecommendationEngine {
    client;
    model;
    maxTokens;
    maxRetries;
    constructor(apiKey) {
        const key = apiKey ?? settings.openrouter.apiKey;
        this.client = new Anthropic({
            apiKey: key,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'http://localhost:3000', // Update with your actual site URL in prod
                'X-Title': 'Competitor Intel System',
            },
        });
        this.model = settings.openrouter.model;
        this.maxTokens = 2_000; // Recommendations need more tokens
        this.maxRetries = settings.openrouter.maxRetries;
    }
    // ─── Generate recommendations ───────────────────────────────────────────
    async generateRecommendations(customerData, marketData) {
        const start = Date.now();
        log.info('Generating AI-powered recommendations...');
        try {
            // Build context prompt
            const prompt = this.buildPrompt(customerData, marketData);
            // Call Claude
            const rawJson = await this.callClaudeWithRetry(prompt);
            // Parse response
            const recommendations = this.parseResponse(rawJson, marketData);
            log.info(`Generated ${recommendations.length} recommendations in ${formatDuration(Date.now() - start)}: ` +
                `${recommendations.filter((r) => r.priority === RecommendationPriority.Urgent).length} urgent, ` +
                `${recommendations.filter((r) => r.priority === RecommendationPriority.High).length} important, ` +
                `${recommendations.filter((r) => r.priority === RecommendationPriority.Medium).length} consider`);
            return recommendations;
        }
        catch (err) {
            log.error(`Recommendation generation failed: ${toErrorMessage(err)}`);
            // Return rule-based fallback recommendations
            return this.generateFallbackRecommendations(customerData, marketData);
        }
    }
    // ─── Prompt construction ────────────────────────────────────────────────
    buildPrompt(customerData, marketData) {
        const { competitor, analysis, healthScore, pageMetrics } = customerData;
        // ── Customer metrics ──────────────────────────────────────────────
        const customerSection = `
CUSTOMER: ${competitor.name}
Category: ${competitor.category}
Price tier: ${competitor.priceTier}
Health score: ${healthScore?.totalScore ?? 'N/A'}/100 (paid: ${healthScore?.paidScore ?? '?'}, organic: ${healthScore?.organicScore ?? '?'})
Active ads: ${analysis?.totalActiveAds ?? 0}
Followers: ${pageMetrics?.followers ?? 'Unknown'}
Engagement rate: ${pageMetrics?.avgEngagementRate != null ? `${round(pageMetrics.avgEngagementRate, 2)}%` : 'Unknown'}
Rating: ${pageMetrics?.rating ?? 'Unknown'}/5
Share of voice: ${analysis?.shareOfVoice != null ? `${round(analysis.shareOfVoice, 1)}%` : 'Unknown'}
Threat level: ${analysis?.threatLevel ?? 'Unknown'}
Trend: ${analysis?.trend ?? 'Unknown'}`.trim();
        // ── Market benchmarks ─────────────────────────────────────────────
        const marketSection = `
MARKET AVERAGES:
Avg ads per competitor: ${round(marketData.avgAdCount, 1)}
Avg engagement rate: ${round(marketData.avgEngagementRate, 2)}%
Avg followers: ${this.formatNumber(marketData.avgFollowers)}
Avg health score: ${round(marketData.avgHealthScore, 1)}/100`.trim();
        // ── Leader info ───────────────────────────────────────────────────
        const leaderSection = marketData.leader
            ? `
MARKET LEADER:
Name: ${marketData.leader.competitorName}
Health score: ${marketData.leader.totalScore}/100 (paid: ${marketData.leader.paidScore}, organic: ${marketData.leader.organicScore})`.trim()
            : 'MARKET LEADER: No data available';
        // ── Top competitors summary ──────────────────────────────────────
        const topCompetitors = marketData.healthScores
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, 5)
            .map((h) => `  - ${h.competitorName}: score ${h.totalScore} (paid=${h.paidScore}, organic=${h.organicScore})`)
            .join('\n');
        // ── Recent alerts (truncated) ─────────────────────────────────────
        const alertSummary = marketData.recentAlerts
            .slice(0, 8)
            .map((a) => `  - [${a.severity}] ${a.title}`)
            .join('\n');
        // ── Trending keywords ─────────────────────────────────────────────
        const trendSummary = marketData.trends
            .filter((t) => t.changePct !== null && t.changePct > 0)
            .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
            .slice(0, 5)
            .map((t) => `  - "${t.keyword}": value ${t.value}, +${round(t.changePct, 0)}% MoM`)
            .join('\n');
        // ── Segment saturation ────────────────────────────────────────────
        const saturationSummary = [...marketData.segmentSaturation.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([seg, count]) => `  - ${seg}: ${count} competitor${count !== 1 ? 's' : ''} active`)
            .join('\n');
        return `You are a hospitality marketing strategist advising a hotel in Hua Hin, Thailand.
Based on the following data, generate 5-10 actionable recommendations for the CUSTOMER.

${customerSection}

${marketSection}

${leaderSection}

TOP 5 COMPETITORS:
${topCompetitors || '  No data available'}

RECENT MARKET ALERTS:
${alertSummary || '  No recent alerts'}

TRENDING KEYWORDS (Google Trends, Thailand):
${trendSummary || '  No trend data'}

SEGMENT SATURATION (how many competitors target each segment):
${saturationSummary || '  No saturation data'}

Generate recommendations as a JSON array. Each recommendation must have:
- "priority": "urgent" (do within 7 days), "important" (do within 30 days), or "consider" (strategic)
- "title": Short action title (5-10 words)
- "description": 2-3 sentences explaining WHY this matters
- "actionItems": Array of 2-4 specific steps to take
- "estimatedImpact": One sentence on expected results
- "relatedCompetitors": Array of {id, name} of competitors this responds to (use real IDs from the data above; use [] if market-wide)

Guidelines:
- URGENT recommendations should address active threats: seasonal campaigns to counter, price wars, rating issues.
- IMPORTANT recommendations should address gaps: underserved segments, format shifts, content scaling.
- CONSIDER recommendations should address strategic positioning: new markets, long-term brand moves, platform expansion.
- Be specific to the hotel/hospitality industry in Hua Hin.
- Reference specific competitors and data points where possible.
- Action items should be concrete and implementable by a marketing team.
- Generate at least 2 urgent, 2 important, and 1 consider recommendation.

Return ONLY a valid JSON array (no markdown, no explanation).`;
    }
    // ─── Claude API call ────────────────────────────────────────────────────
    async callClaudeWithRetry(prompt) {
        let lastErr;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const message = await this.client.messages.create({
                    model: this.model,
                    max_tokens: this.maxTokens,
                    messages: [{ role: 'user', content: prompt }],
                    system: 'You are an expert hotel marketing strategist specialising in the Thai hospitality market. ' +
                        'Generate actionable, data-driven recommendations. Always respond with valid JSON only.',
                });
                const textBlock = message.content.find((b) => b.type === 'text');
                if (!textBlock || textBlock.type !== 'text') {
                    throw new Error('No text content in Claude response');
                }
                return textBlock.text;
            }
            catch (err) {
                lastErr = err;
                const msg = toErrorMessage(err);
                const isRetryable = msg.includes('429') ||
                    msg.includes('overloaded') ||
                    msg.includes('529') ||
                    msg.includes('500') ||
                    msg.includes('502') ||
                    msg.includes('503');
                if (attempt < this.maxRetries && isRetryable) {
                    const backoff = 2_000 * 2 ** attempt;
                    log.warn(`  Claude API attempt ${attempt + 1}/${this.maxRetries + 1} failed: ${msg}. Retrying in ${backoff / 1_000}s`);
                    await sleep(backoff);
                }
                else if (!isRetryable) {
                    throw err;
                }
            }
        }
        throw lastErr;
    }
    // ─── Response parsing ───────────────────────────────────────────────────
    parseResponse(rawJson, marketData) {
        let cleaned = rawJson.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }
        let parsed;
        try {
            const data = JSON.parse(cleaned);
            parsed = Array.isArray(data) ? data : [];
        }
        catch (err) {
            log.error(`Failed to parse recommendations JSON: ${toErrorMessage(err)}`);
            log.debug(`Raw response: ${truncate(rawJson, 500)}`);
            return [];
        }
        // Validate known competitor IDs
        const validIds = new Set(marketData.analyses.map((a) => a.competitor.id));
        return parsed
            .filter((r) => typeof r === 'object' &&
            r !== null &&
            typeof r.title === 'string' &&
            typeof r.description === 'string')
            .slice(0, 10) // Cap at 10 recommendations
            .map((r) => ({
            priority: PRIORITY_MAP[r.priority] ?? RecommendationPriority.Medium,
            title: r.title,
            description: r.description,
            actionItems: Array.isArray(r.actionItems)
                ? r.actionItems.filter((i) => typeof i === 'string').slice(0, 5)
                : [],
            estimatedImpact: r.estimatedImpact || 'Impact assessment not available.',
            relatedCompetitors: Array.isArray(r.relatedCompetitors)
                ? r.relatedCompetitors
                    .filter((c) => typeof c === 'object' &&
                    c !== null &&
                    typeof c['id'] === 'number' &&
                    typeof c['name'] === 'string' &&
                    validIds.has(c.id))
                    .slice(0, 5)
                : [],
        }));
    }
    // ─── Rule-based fallback (no AI needed) ─────────────────────────────────
    generateFallbackRecommendations(customerData, marketData) {
        const recs = [];
        const { analysis, healthScore, pageMetrics } = customerData;
        // ── URGENT: Low ad presence ──────────────────────────────────────
        if (analysis && analysis.totalActiveAds < marketData.avgAdCount * 0.5) {
            const leader = marketData.leader;
            recs.push({
                priority: RecommendationPriority.Urgent,
                title: 'Increase paid ad presence immediately',
                description: `You have ${analysis.totalActiveAds} active ads vs. the market average of ${round(marketData.avgAdCount, 0)}. ` +
                    `This significantly limits your visibility and share of voice.` +
                    (leader ? ` The market leader ${leader.competitorName} scores ${leader.paidScore} on paid media.` : ''),
                actionItems: [
                    'Launch 3-5 new ad creatives targeting your primary segments',
                    'Test both image and video formats for best performance',
                    'Allocate additional budget to match at least market-average ad volume',
                ],
                estimatedImpact: 'Expected 20-40% increase in visibility and lead generation within 2 weeks.',
                relatedCompetitors: leader
                    ? [{ id: leader.competitorId, name: leader.competitorName }]
                    : [],
            });
        }
        // ── URGENT: Rating below average ─────────────────────────────────
        if (pageMetrics?.rating != null && pageMetrics.rating < 4.0) {
            recs.push({
                priority: RecommendationPriority.Urgent,
                title: 'Address review rating decline',
                description: `Your current rating of ${pageMetrics.rating}/5 is below the typical threshold ` +
                    `for premium hotels. Negative reviews can significantly impact booking decisions.`,
                actionItems: [
                    'Respond professionally to all recent negative reviews within 24 hours',
                    'Identify and address the top 3 recurring complaints',
                    'Implement a guest feedback survey to catch issues before they become reviews',
                    'Encourage satisfied guests to leave positive reviews',
                ],
                estimatedImpact: 'Rating improvement of 0.2-0.5 stars over 60 days, improving conversion rates by 10-15%.',
                relatedCompetitors: [],
            });
        }
        // ── URGENT: Respond to active price war ──────────────────────────
        const priceWarAlerts = marketData.recentAlerts.filter((a) => a.alertType === 'price_change' && a.severity === 'critical');
        if (priceWarAlerts.length > 0) {
            recs.push({
                priority: RecommendationPriority.Urgent,
                title: 'Respond to market price war',
                description: `Multiple competitors are running aggressive discount campaigns (30%+ off). ` +
                    `Rather than matching on price, differentiate through value-added packages.`,
                actionItems: [
                    'Create value-add packages (e.g., spa credit, dining included) instead of pure discounts',
                    'Highlight unique amenities and experiences in ad copy',
                    'Target high-intent audiences willing to pay for quality',
                ],
                estimatedImpact: 'Maintain margins while capturing quality-conscious travellers who avoid heavy-discount properties.',
                relatedCompetitors: [],
            });
        }
        // ── IMPORTANT: Low engagement ────────────────────────────────────
        if (pageMetrics?.avgEngagementRate != null &&
            pageMetrics.avgEngagementRate < marketData.avgEngagementRate * 0.7) {
            recs.push({
                priority: RecommendationPriority.High,
                title: 'Improve organic content engagement',
                description: `Your engagement rate of ${round(pageMetrics.avgEngagementRate, 2)}% is below the ` +
                    `market average of ${round(marketData.avgEngagementRate, 2)}%. Higher engagement ` +
                    `amplifies organic reach and reduces paid media dependency.`,
                actionItems: [
                    'Increase video and reel content — these typically get 2-3x more engagement',
                    'Post behind-the-scenes content and staff stories',
                    'Use interactive formats: polls, questions, carousel posts',
                    'Post consistently 4-5 times per week at peak engagement hours',
                ],
                estimatedImpact: 'Target 50% engagement rate improvement within 30 days.',
                relatedCompetitors: [],
            });
        }
        // ── IMPORTANT: Growing trend opportunity ─────────────────────────
        const topTrend = marketData.trends
            .filter((t) => t.changePct !== null && t.changePct > 30)
            .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0];
        if (topTrend) {
            recs.push({
                priority: RecommendationPriority.High,
                title: `Capitalise on "${topTrend.keyword}" trend`,
                description: `Google Trends shows "${topTrend.keyword}" is up ${round(topTrend.changePct, 0)}% ` +
                    `month-over-month. This represents rising consumer demand that you can capture.`,
                actionItems: [
                    `Create targeted ad campaigns around "${topTrend.keyword}"`,
                    `Publish SEO-optimised content on your website about this topic`,
                    `Develop a social media content series aligned with this trend`,
                ],
                estimatedImpact: `Capture early-mover advantage in a growing search segment.`,
                relatedCompetitors: [],
            });
        }
        // ── CONSIDER: Underserved segments ───────────────────────────────
        const underserved = [...marketData.segmentSaturation.entries()]
            .filter(([, count]) => count <= 2)
            .map(([segment]) => segment);
        if (underserved.length > 0) {
            recs.push({
                priority: RecommendationPriority.Medium,
                title: 'Explore underserved market segments',
                description: `The following segments have fewer than 3 active competitors: ` +
                    `${underserved.slice(0, 3).join(', ')}. These represent opportunities for differentiation.`,
                actionItems: [
                    `Research guest demand for ${underserved[0] ?? 'these segments'}`,
                    `Develop targeted packages and landing pages for the most promising segment`,
                    `Test ad campaigns targeting these audiences with a small budget`,
                ],
                estimatedImpact: 'First-mover advantage in niche segments with less competition and lower CPA.',
                relatedCompetitors: [],
            });
        }
        // ── CONSIDER: Follower growth ────────────────────────────────────
        if (pageMetrics?.followers != null && pageMetrics.followers < marketData.avgFollowers) {
            recs.push({
                priority: RecommendationPriority.Medium,
                title: 'Invest in audience growth strategy',
                description: `Your follower count of ${this.formatNumber(pageMetrics.followers)} is below the ` +
                    `market average of ${this.formatNumber(marketData.avgFollowers)}. A larger organic audience ` +
                    `reduces long-term paid media costs.`,
                actionItems: [
                    'Run a follower-growth campaign with compelling lead magnets',
                    'Partner with local influencers for cross-promotion',
                    'Consistently post shareable, high-value content',
                ],
                estimatedImpact: 'Target 15-25% follower growth over 90 days, reducing long-term CAC.',
                relatedCompetitors: [],
            });
        }
        return recs;
    }
    // ─── Helpers ────────────────────────────────────────────────────────────
    formatNumber(n) {
        if (n >= 1_000_000)
            return `${round(n / 1_000_000, 1)}M`;
        if (n >= 1_000)
            return `${round(n / 1_000, 0)}K`;
        return String(Math.round(n));
    }
}
//# sourceMappingURL=recommendations.js.map