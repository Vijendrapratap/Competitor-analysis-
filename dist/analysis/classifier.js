// =============================================================================
// Strategy Classifier — Claude AI-powered
//
// Uses the Anthropic SDK (Claude Haiku) to analyse each competitor's ads,
// posts, and engagement data and produce a structured strategy analysis
// including marketing narrative, USP, target segments, pricing tier, and
// threat level — in both English and Thai.
// =============================================================================
import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger.js';
import { sleep, toErrorMessage, truncate, round, formatDuration, } from '../utils/helpers.js';
import { settings } from '../config/settings.js';
const log = createLogger('StrategyClassifier');
/** TTL for cached results (6 hours). */
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
// ─────────────────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────────────────
export class StrategyClassifier {
    client;
    model;
    maxTokens;
    maxRetries;
    cache = new Map();
    constructor(apiKey) {
        const key = apiKey ?? settings.openrouter.apiKey;
        this.client = new Anthropic({
            apiKey: key,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Competitor Intel System',
            },
        });
        this.model = settings.openrouter.model;
        this.maxTokens = settings.openrouter.maxTokens;
        this.maxRetries = settings.openrouter.maxRetries;
    }
    // ─── Analyse all competitors ────────────────────────────────────────────
    async analyzeAll(allData) {
        const results = new Map();
        log.info(`Classifying strategy for ${allData.length} competitors using ${this.model}`);
        for (let i = 0; i < allData.length; i++) {
            const data = allData[i];
            const start = Date.now();
            try {
                const analysis = await this.analyzeCompetitor(data);
                results.set(data.competitor.id, analysis);
                log.info(`  [${i + 1}/${allData.length}] \u2714 ${data.competitor.name} (${formatDuration(Date.now() - start)})`);
            }
            catch (err) {
                log.error(`  [${i + 1}/${allData.length}] \u2716 ${data.competitor.name}: ${toErrorMessage(err)}`);
            }
            // Brief pause between API calls to stay well within rate limits
            if (i < allData.length - 1) {
                await sleep(500);
            }
        }
        log.info(`Classification complete: ${results.size}/${allData.length} succeeded`);
        return results;
    }
    // ─── Analyse a single competitor ────────────────────────────────────────
    async analyzeCompetitor(data) {
        // Check cache
        const inputHash = this.computeHash(data);
        const cached = this.cache.get(data.competitor.id);
        if (cached && cached.hash === inputHash && Date.now() - cached.createdAt < CACHE_TTL_MS) {
            log.debug(`  Cache hit for ${data.competitor.name}`);
            return cached.result;
        }
        // Build the prompt
        const prompt = this.buildPrompt(data);
        // Call Claude with retry
        const jsonResponse = await this.callClaudeWithRetry(prompt);
        // Parse the response
        const parsed = this.parseResponse(jsonResponse, data);
        // Cache the result
        this.cache.set(data.competitor.id, {
            hash: inputHash,
            result: parsed,
            createdAt: Date.now(),
        });
        return parsed;
    }
    // ─── Prompt construction ────────────────────────────────────────────────
    buildPrompt(data) {
        const { competitor, ads, posts, pageMetrics, shareOfVoice } = data;
        // Prepare ad samples (2–3 ad copies, truncated)
        const adSamples = ads
            .filter((a) => a.adCopy)
            .slice(0, 3)
            .map((a, i) => {
            const copy = truncate(a.adCopy ?? '', 300);
            const headline = a.headline ? ` | Headline: ${truncate(a.headline, 100)}` : '';
            const price = a.extractedPrice != null ? ` | Price: ${a.extractedPrice}` : '';
            const cta = a.ctaType !== 'UNKNOWN' ? ` | CTA: ${a.ctaType}` : '';
            return `  Ad ${i + 1}: ${copy}${headline}${price}${cta}`;
        })
            .join('\n');
        // Prepare post samples (2–3 recent posts, truncated)
        const postSamples = posts
            .filter((p) => p.postText)
            .slice(0, 3)
            .map((p, i) => {
            const text = truncate(p.postText ?? '', 300);
            const engagement = `Reactions: ${p.reactions}, Comments: ${p.comments}, Shares: ${p.shares}`;
            return `  Post ${i + 1}: ${text}\n    [${engagement}]`;
        })
            .join('\n');
        // Collect ad types
        const adTypesSummary = this.summariseAdTypes(ads);
        // Extract prices found
        const prices = ads
            .filter((a) => a.extractedPrice != null)
            .map((a) => a.extractedPrice)
            .sort((a, b) => a - b);
        const priceRange = prices.length > 0
            ? `${prices[0]} – ${prices[prices.length - 1]} THB (${prices.length} price points found)`
            : 'No prices detected';
        // Engagement rate
        const engRate = pageMetrics?.avgEngagementRate;
        const engRateStr = engRate != null ? `${round(engRate, 2)}%` : 'Unknown';
        // Build the user message
        return `Analyse the following hotel competitor in the Hua Hin, Thailand market and return a JSON object.

COMPETITOR: ${competitor.name}
CATEGORY: ${competitor.category}
PRICE TIER (current): ${competitor.priceTier}

PAID MEDIA:
  Total active ads: ${ads.length}
  Ad types: ${adTypesSummary}
  Price range in ads: ${priceRange}
  Share of voice: ${round(shareOfVoice * 100, 1)}%
${adSamples ? `  Sample ad copies:\n${adSamples}` : '  No ad copy available.'}

ORGANIC MEDIA:
  Followers: ${pageMetrics?.followers ?? 'Unknown'}
  Page likes: ${pageMetrics?.pageLikes ?? 'Unknown'}
  Rating: ${pageMetrics?.rating ?? 'Unknown'}/5 (${pageMetrics?.reviewCount ?? '?'} reviews)
  Engagement rate: ${engRateStr}
  Posts last 30d: ${pageMetrics?.postsLast30d ?? posts.length}
${postSamples ? `  Sample posts:\n${postSamples}` : '  No post text available.'}

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "marketingStrategyEn": "2-3 sentence English narrative of their marketing strategy",
  "marketingStrategyTh": "Thai translation of the above strategy narrative",
  "keyUspEn": "One sentence describing their key unique selling proposition in English",
  "keyUspTh": "Thai translation of the USP",
  "targetSegments": [
    {
      "segment": "Segment name",
      "confidence": "low" | "medium" | "high",
      "evidence": ["Evidence 1", "Evidence 2"]
    }
  ],
  "pricingTier": "budget" | "mid" | "premium" | "ultra_premium",
  "threatLevel": "low" | "medium" | "high" | "critical",
  "threatReason": "One sentence explaining the threat assessment"
}

Guidelines:
- Provide 3-5 target segments.
- For hotels in Hua Hin, common segments include: luxury leisure, family vacations, honeymoons/weddings, MICE/corporate, wellness/spa seekers, digital nomads/workation, golf tourism, weekend getaways from Bangkok.
- Base threatLevel on: ad volume, freshness, share of voice, engagement, content quality. "critical" means they are aggressively competing. "low" means minimal competitive pressure.
- pricingTier should be inferred from ad prices, property positioning, and target audience.
- All Thai translations should be natural, professional Thai suitable for a business report.`;
    }
    // ─── Claude API call with retry ─────────────────────────────────────────
    async callClaudeWithRetry(prompt) {
        let lastErr;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const message = await this.client.messages.create({
                    model: this.model,
                    max_tokens: this.maxTokens,
                    messages: [
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    system: 'You are an expert hospitality marketing analyst specialising in the Thai hotel market. ' +
                        'You analyse competitor data and produce structured JSON reports. ' +
                        'Always respond with valid JSON only — no markdown fences, no explanatory text.',
                });
                // Extract text content from response
                const textBlock = message.content.find((b) => b.type === 'text');
                if (!textBlock || textBlock.type !== 'text') {
                    throw new Error('No text content in Claude response');
                }
                return textBlock.text;
            }
            catch (err) {
                lastErr = err;
                const msg = toErrorMessage(err);
                // Retry on rate limits (429) or server errors (5xx)
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
    parseResponse(rawJson, data) {
        // Strip markdown fences if present (safety measure despite prompt instructions)
        let cleaned = rawJson.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        }
        catch (err) {
            log.error(`  Failed to parse Claude response as JSON: ${toErrorMessage(err)}`);
            log.debug(`  Raw response: ${truncate(rawJson, 500)}`);
            // Return a safe fallback
            return this.buildFallback(data, `JSON parse error: ${toErrorMessage(err)}`);
        }
        // Validate and normalise
        return {
            competitorId: data.competitor.id,
            competitorName: data.competitor.name,
            marketingStrategyEn: parsed.marketingStrategyEn || 'No strategy analysis available.',
            marketingStrategyTh: parsed.marketingStrategyTh || 'ไม่มีข้อมูลการวิเคราะห์กลยุทธ์',
            keyUspEn: parsed.keyUspEn || 'No USP identified.',
            keyUspTh: parsed.keyUspTh || 'ไม่สามารถระบุจุดขายหลักได้',
            targetSegments: this.validateSegments(parsed.targetSegments),
            pricingTier: this.validatePricingTier(parsed.pricingTier),
            threatLevel: this.validateThreatLevel(parsed.threatLevel),
            threatReason: parsed.threatReason || 'No threat reasoning provided.',
            analysedAt: new Date(),
        };
    }
    // ─── Validation helpers ─────────────────────────────────────────────────
    validateSegments(raw) {
        if (!Array.isArray(raw))
            return [];
        return raw
            .filter((s) => typeof s === 'object' &&
            s !== null &&
            typeof s['segment'] === 'string')
            .slice(0, 5) // Cap at 5 segments
            .map((s) => ({
            segment: s.segment,
            confidence: (['low', 'medium', 'high'].includes(s.confidence)
                ? s.confidence
                : 'medium'),
            evidence: Array.isArray(s.evidence)
                ? s.evidence.filter((e) => typeof e === 'string').slice(0, 5)
                : [],
        }));
    }
    validatePricingTier(raw) {
        const valid = ['budget', 'mid', 'premium', 'ultra_premium'];
        return valid.includes(raw)
            ? raw
            : 'mid';
    }
    validateThreatLevel(raw) {
        const valid = ['low', 'medium', 'high', 'critical'];
        return valid.includes(raw)
            ? raw
            : 'medium';
    }
    // ─── Fallback for failed analyses ───────────────────────────────────────
    buildFallback(data, reason) {
        return {
            competitorId: data.competitor.id,
            competitorName: data.competitor.name,
            marketingStrategyEn: `Analysis unavailable: ${reason}`,
            marketingStrategyTh: `ไม่สามารถวิเคราะห์ได้: ${reason}`,
            keyUspEn: 'Unable to determine USP.',
            keyUspTh: 'ไม่สามารถระบุจุดขายหลักได้',
            targetSegments: [],
            pricingTier: 'mid',
            threatLevel: 'medium',
            threatReason: reason,
            analysedAt: new Date(),
        };
    }
    // ─── Hashing for cache invalidation ─────────────────────────────────────
    /**
     * Compute a simple hash from the input data to detect changes.
     * We hash: ad count, newest ad date, follower count, post count.
     */
    computeHash(data) {
        const parts = [
            data.competitor.id,
            data.ads.length,
            data.ads[0]?.metaAdId ?? '',
            data.ads[data.ads.length - 1]?.metaAdId ?? '',
            data.pageMetrics?.followers ?? 0,
            data.posts.length,
            data.shareOfVoice,
        ];
        return parts.join('|');
    }
    // ─── Ad type summary ───────────────────────────────────────────────────
    summariseAdTypes(ads) {
        if (ads.length === 0)
            return 'None';
        const counts = new Map();
        for (const ad of ads) {
            const type = ad.creativeType;
            counts.set(type, (counts.get(type) ?? 0) + 1);
        }
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => `${type} (${count})`)
            .join(', ');
    }
}
//# sourceMappingURL=classifier.js.map