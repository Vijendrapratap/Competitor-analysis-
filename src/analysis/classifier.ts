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
import {
  sleep,
  toErrorMessage,
  truncate,
  round,
  formatDuration,
} from '../utils/helpers.js';
import { settings } from '../config/settings.js';
import type {
  Competitor,
  Ad,
  FacebookPost,
  FacebookPageMetrics,
  TargetSegment,
  ThreatLevel,
} from '../types/index.js';

const log = createLogger('StrategyClassifier');

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output types
// ─────────────────────────────────────────────────────────────────────────────

/** Everything the classifier needs for one competitor. */
export interface CompetitorAnalysisInput {
  competitor: Competitor;
  ads: Ad[];
  posts: FacebookPost[];
  pageMetrics: FacebookPageMetrics | null;
  /** Share of voice (0–1), pre-computed. */
  shareOfVoice: number;
}

/** Structured output returned by the Claude analysis. */
export interface StrategyAnalysis {
  competitorId: number;
  competitorName: string;
  /** 2–3 sentence English narrative of the competitor's marketing strategy. */
  marketingStrategyEn: string;
  /** Thai translation of the strategy narrative. */
  marketingStrategyTh: string;
  /** One-sentence English USP. */
  keyUspEn: string;
  /** Thai translation of the USP. */
  keyUspTh: string;
  /** 3–5 target audience segments. */
  targetSegments: TargetSegment[];
  /** Pricing tier assessment. */
  pricingTier: 'budget' | 'mid' | 'premium' | 'ultra_premium';
  /** Threat level with reasoning. */
  threatLevel: ThreatLevel;
  threatReason: string;
  /** ISO timestamp. */
  analysedAt: Date;
}

/** Shape we expect Claude to return in JSON. */
interface ClaudeJsonResponse {
  marketingStrategyEn: string;
  marketingStrategyTh: string;
  keyUspEn: string;
  keyUspTh: string;
  targetSegments: Array<{
    segment: string;
    confidence: 'low' | 'medium' | 'high';
    evidence: string[];
  }>;
  pricingTier: 'budget' | 'mid' | 'premium' | 'ultra_premium';
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  threatReason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple in-memory cache
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  hash: string;
  result: StrategyAnalysis;
  createdAt: number;
}

/** TTL for cached results (6 hours). */
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

// ─────────────────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────────────────

export class StrategyClassifier {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly maxRetries: number;
  private readonly cache = new Map<number, CacheEntry>();

  constructor(apiKey?: string) {
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

  async analyzeAll(
    allData: CompetitorAnalysisInput[],
  ): Promise<Map<number, StrategyAnalysis>> {
    const results = new Map<number, StrategyAnalysis>();

    log.info(
      `Classifying strategy for ${allData.length} competitors using ${this.model}`,
    );

    for (let i = 0; i < allData.length; i++) {
      const data = allData[i]!;
      const start = Date.now();

      try {
        const analysis = await this.analyzeCompetitor(data);
        results.set(data.competitor.id, analysis);
        log.info(
          `  [${i + 1}/${allData.length}] \u2714 ${data.competitor.name} (${formatDuration(Date.now() - start)})`,
        );
      } catch (err) {
        log.error(
          `  [${i + 1}/${allData.length}] \u2716 ${data.competitor.name}: ${toErrorMessage(err)}`,
        );
      }

      // Brief pause between API calls to stay well within rate limits
      if (i < allData.length - 1) {
        await sleep(500);
      }
    }

    log.info(
      `Classification complete: ${results.size}/${allData.length} succeeded`,
    );

    return results;
  }

  // ─── Analyse a single competitor ────────────────────────────────────────

  async analyzeCompetitor(
    data: CompetitorAnalysisInput,
  ): Promise<StrategyAnalysis> {
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

  private buildPrompt(data: CompetitorAnalysisInput): string {
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
      .map((a) => a.extractedPrice!)
      .sort((a, b) => a - b);
    const priceRange =
      prices.length > 0
        ? `${prices[0]} – ${prices[prices.length - 1]} THB (${prices.length} price points found)`
        : 'No prices detected';

    // Engagement rate
    const engRate = pageMetrics?.avgEngagementRate;
    const engRateStr =
      engRate != null ? `${round(engRate, 2)}%` : 'Unknown';

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

  private async callClaudeWithRetry(prompt: string): Promise<string> {
    let lastErr: unknown;

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
          system:
            'You are an expert hospitality marketing analyst specialising in the Thai hotel market. ' +
            'You analyse competitor data and produce structured JSON reports. ' +
            'Always respond with valid JSON only — no markdown fences, no explanatory text.',
        });

        // Extract text content from response
        const textBlock = message.content.find((b: any) => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('No text content in Claude response');
        }

        return textBlock.text;
      } catch (err) {
        lastErr = err;
        const msg = toErrorMessage(err);

        // Retry on rate limits (429) or server errors (5xx)
        const isRetryable =
          msg.includes('429') ||
          msg.includes('overloaded') ||
          msg.includes('529') ||
          msg.includes('500') ||
          msg.includes('502') ||
          msg.includes('503');

        if (attempt < this.maxRetries && isRetryable) {
          const backoff = 2_000 * 2 ** attempt;
          log.warn(
            `  Claude API attempt ${attempt + 1}/${this.maxRetries + 1} failed: ${msg}. Retrying in ${backoff / 1_000}s`,
          );
          await sleep(backoff);
        } else if (!isRetryable) {
          throw err;
        }
      }
    }

    throw lastErr;
  }

  // ─── Response parsing ───────────────────────────────────────────────────

  private parseResponse(
    rawJson: string,
    data: CompetitorAnalysisInput,
  ): StrategyAnalysis {
    // Strip markdown fences if present (safety measure despite prompt instructions)
    let cleaned = rawJson.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: ClaudeJsonResponse;
    try {
      parsed = JSON.parse(cleaned) as ClaudeJsonResponse;
    } catch (err) {
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

  private validateSegments(
    raw: unknown,
  ): TargetSegment[] {
    if (!Array.isArray(raw)) return [];

    return raw
      .filter(
        (s): s is { segment: string; confidence: string; evidence: string[] } =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as Record<string, unknown>)['segment'] === 'string',
      )
      .slice(0, 5) // Cap at 5 segments
      .map((s) => ({
        segment: s.segment,
        confidence: (['low', 'medium', 'high'].includes(s.confidence)
          ? s.confidence
          : 'medium') as TargetSegment['confidence'],
        evidence: Array.isArray(s.evidence)
          ? s.evidence.filter((e): e is string => typeof e === 'string').slice(0, 5)
          : [],
      }));
  }

  private validatePricingTier(
    raw: unknown,
  ): 'budget' | 'mid' | 'premium' | 'ultra_premium' {
    const valid = ['budget', 'mid', 'premium', 'ultra_premium'];
    return valid.includes(raw as string)
      ? (raw as 'budget' | 'mid' | 'premium' | 'ultra_premium')
      : 'mid';
  }

  private validateThreatLevel(raw: unknown): ThreatLevel {
    const valid = ['low', 'medium', 'high', 'critical'];
    return valid.includes(raw as string)
      ? (raw as ThreatLevel)
      : ('medium' as ThreatLevel);
  }

  // ─── Fallback for failed analyses ───────────────────────────────────────

  private buildFallback(
    data: CompetitorAnalysisInput,
    reason: string,
  ): StrategyAnalysis {
    return {
      competitorId: data.competitor.id,
      competitorName: data.competitor.name,
      marketingStrategyEn: `Analysis unavailable: ${reason}`,
      marketingStrategyTh: `ไม่สามารถวิเคราะห์ได้: ${reason}`,
      keyUspEn: 'Unable to determine USP.',
      keyUspTh: 'ไม่สามารถระบุจุดขายหลักได้',
      targetSegments: [],
      pricingTier: 'mid',
      threatLevel: 'medium' as ThreatLevel,
      threatReason: reason,
      analysedAt: new Date(),
    };
  }

  // ─── Hashing for cache invalidation ─────────────────────────────────────

  /**
   * Compute a simple hash from the input data to detect changes.
   * We hash: ad count, newest ad date, follower count, post count.
   */
  private computeHash(data: CompetitorAnalysisInput): string {
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

  private summariseAdTypes(ads: Ad[]): string {
    if (ads.length === 0) return 'None';

    const counts = new Map<string, number>();
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
