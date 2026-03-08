// =============================================================================
// Pricing Extractor — hybrid regex + optional AI fallback
//
// Scans ad copies, headlines, and post text for price signals using a battery
// of regex patterns tuned for Thai hotel advertising. When regex finds nothing
// but the text looks promotional, an optional Claude Haiku call extracts
// structured pricing in context.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

import { createLogger } from '../utils/logger.js';
import {
  round,
  clamp,
  toErrorMessage,
  truncate,
  sleep,
} from '../utils/helpers.js';
import { settings } from '../config/settings.js';
import { PricePosition } from '../types/index.js';
import type {
  Ad,
  RoomRate,
  Discount,
  PackagePrice,
  PricingData,
} from '../types/index.js';

const log = createLogger('PricingExtractor');

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

/** Raw extraction result from a single text passage. */
export interface ExtractedPricing {
  prices: Array<{ value: number; currency: 'THB' | 'USD'; context: string }>;
  discounts: Array<{ raw: string; pct: number | null; absolute: number | null }>;
  confidence: 'high' | 'medium' | 'low';
}

/** AI-enriched pricing result (only used as fallback). */
export interface AIPricingResult {
  roomRates: Array<{ type: string; price: number; currency: string }>;
  packages: Array<{ name: string; price: number; currency: string; inclusions: string[] }>;
  discounts: Array<{ description: string; pct: number | null }>;
  priceContext: string;
}

/** Full pricing analysis across all of a competitor's ads. */
export interface PricingAnalysis {
  pricingData: PricingData;
  confidence: 'high' | 'medium' | 'low';
  priceCount: number;
  discountCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Regex patterns
// ─────────────────────────────────────────────────────────────────────────────

/** THB / Baht price patterns. */
const THB_PATTERNS: RegExp[] = [
  // ฿3,500  ฿ 3500
  /฿\s*([\d,]+(?:\.\d{1,2})?)/gi,
  // THB 3,500  thb3500
  /(?:THB|thb)\s*([\d,]+(?:\.\d{1,2})?)/gi,
  // Baht 3,500  baht 3500
  /(?:Baht|baht)\s*([\d,]+(?:\.\d{1,2})?)/gi,
  // 3,500 Baht  3500 baht  3,500 บาท
  /([\d,]+(?:\.\d{1,2})?)\s*(?:Baht|baht|บาท)/gi,
  // 3,500 THB
  /([\d,]+(?:\.\d{1,2})?)\s*(?:THB|thb)\b/gi,
];

/** USD price patterns. */
const USD_PATTERNS: RegExp[] = [
  // $199  $ 199
  /\$\s*([\d,]+(?:\.\d{1,2})?)/gi,
  // USD 199  usd199
  /(?:USD|usd)\s*([\d,]+(?:\.\d{1,2})?)/gi,
  // 199 USD
  /([\d,]+(?:\.\d{1,2})?)\s*(?:USD|usd)\b/gi,
];

/** "Starting from" / "from" patterns (currency-agnostic, capture the number). */
const STARTING_FROM_PATTERNS: RegExp[] = [
  /(?:starting\s+(?:from|at)|from\s+only|เริ่มต้น(?:ที่)?|ราคาเริ่มต้น)\s*(?:฿|THB|Baht|\$|USD)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
];

/** Per-night patterns. */
const PER_NIGHT_PATTERNS: RegExp[] = [
  /([\d,]+(?:\.\d{1,2})?)\s*(?:\/\s*night|per\s*night|ต่อคืน|\/คืน)/gi,
];

/** Discount percentage patterns. */
const DISCOUNT_PCT_PATTERNS: RegExp[] = [
  // 30% off, 25% discount, ส่วนลด 20%
  /(\d{1,3})\s*%\s*(?:off|discount|ส่วนลด|ลด)/gi,
  /(?:ส่วนลด|ลด)\s*(\d{1,3})\s*%/gi,
  // save 25%, up to 40%
  /(?:save|up\s*to|ประหยัด)\s*(\d{1,3})\s*%/gi,
];

/** "Save up to" absolute patterns. */
const DISCOUNT_ABS_PATTERNS: RegExp[] = [
  /(?:save|ประหยัด)\s*(?:฿|THB|Baht)?\s*([\d,]+)/gi,
  /(?:discount|ส่วนลด)\s*(?:฿|THB|Baht)?\s*([\d,]+)/gi,
];

/** Promotional keywords that suggest the text might contain pricing. */
const PROMO_KEYWORDS =
  /\b(?:promo|offer|deal|package|rate|price|book|reserve|special|sale|flash|early\s*bird|ราคา|จอง|แพ็คเกจ|โปรโมชั่น|ส่วนลด|พิเศษ)\b/i;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toNum(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''));
}

function isReasonablePrice(value: number): boolean {
  // Filter out clearly erroneous values (dates, phone numbers, etc.)
  return Number.isFinite(value) && value > 0 && value < 10_000_000;
}

function isReasonableHotelPrice(value: number, currency: 'THB' | 'USD'): boolean {
  if (currency === 'THB') {
    // Reasonable Thai hotel: 500 – 500,000 THB/night
    return value >= 500 && value <= 500_000;
  }
  // USD: 10 – 15,000
  return value >= 10 && value <= 15_000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────────────────

export class PricingExtractor {
  private readonly client: Anthropic | null;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(enableAI = true) {
    if (enableAI) {
      try {
        this.client = new Anthropic({
          apiKey: settings.openrouter.apiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Competitor Intel System'
          }
        });
      } catch {
        log.warn('Anthropic SDK not initialised — AI pricing fallback disabled');
        this.client = null;
      }
    } else {
      this.client = null;
    }

    this.model = settings.openrouter.model;
    this.maxTokens = 500; // Pricing extraction needs fewer tokens
  }

  // ─── Extract pricing from a single text ─────────────────────────────────

  extractFromText(text: string): ExtractedPricing {
    if (!text || text.trim().length === 0) {
      return { prices: [], discounts: [], confidence: 'low' };
    }

    const prices: ExtractedPricing['prices'] = [];
    const discounts: ExtractedPricing['discounts'] = [];

    // ── THB prices ──────────────────────────────────────────────────────
    for (const pattern of THB_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
          const value = toNum(match[1]);
          if (isReasonablePrice(value)) {
            prices.push({ value, currency: 'THB', context: match[0] });
          }
        }
      }
    }

    // ── USD prices ──────────────────────────────────────────────────────
    for (const pattern of USD_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
          const value = toNum(match[1]);
          if (isReasonablePrice(value)) {
            prices.push({ value, currency: 'USD', context: match[0] });
          }
        }
      }
    }

    // ── "Starting from" prices ──────────────────────────────────────────
    for (const pattern of STARTING_FROM_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
          const value = toNum(match[1]);
          if (isReasonablePrice(value)) {
            // Determine currency from surrounding context
            const currency = this.inferCurrency(text, match.index);
            prices.push({ value, currency, context: match[0] });
          }
        }
      }
    }

    // ── Per-night prices ────────────────────────────────────────────────
    for (const pattern of PER_NIGHT_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
          const value = toNum(match[1]);
          if (isReasonablePrice(value)) {
            const currency = this.inferCurrency(text, match.index);
            prices.push({ value, currency, context: match[0] });
          }
        }
      }
    }

    // ── Discount percentages ────────────────────────────────────────────
    for (const pattern of DISCOUNT_PCT_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
          const pct = parseInt(match[1], 10);
          if (pct > 0 && pct <= 99) {
            discounts.push({ raw: match[0], pct, absolute: null });
          }
        }
      }
    }

    // ── Absolute discounts ──────────────────────────────────────────────
    for (const pattern of DISCOUNT_ABS_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
          const value = toNum(match[1]);
          if (isReasonablePrice(value)) {
            discounts.push({ raw: match[0], pct: null, absolute: value });
          }
        }
      }
    }

    // De-duplicate prices by value+currency
    const uniquePrices = this.deduplicatePrices(prices);
    const uniqueDiscounts = this.deduplicateDiscounts(discounts);

    // Determine confidence
    const confidence =
      uniquePrices.length >= 2
        ? 'high'
        : uniquePrices.length === 1 || uniqueDiscounts.length > 0
          ? 'medium'
          : 'low';

    return { prices: uniquePrices, discounts: uniqueDiscounts, confidence };
  }

  // ─── AI fallback for complex / unstructured text ────────────────────────

  async extractWithAI(text: string): Promise<AIPricingResult> {
    if (!this.client) {
      return { roomRates: [], packages: [], discounts: [], priceContext: 'AI disabled' };
    }

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system:
          'You are a pricing data extraction specialist for Thai hotel ads. ' +
          'Extract all prices, discounts, and package offers. Return valid JSON only.',
        messages: [
          {
            role: 'user',
            content: `Extract structured pricing from this hotel ad text. Return ONLY valid JSON.

TEXT:
${truncate(text, 1_500)}

JSON format:
{
  "roomRates": [{"type": "room type", "price": 0, "currency": "THB"}],
  "packages": [{"name": "package name", "price": 0, "currency": "THB", "inclusions": []}],
  "discounts": [{"description": "discount description", "pct": null}],
  "priceContext": "brief note on pricing strategy"
}`,
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        return { roomRates: [], packages: [], discounts: [], priceContext: 'No AI response' };
      }

      let cleaned = textBlock.text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }

      return JSON.parse(cleaned) as AIPricingResult;
    } catch (err) {
      log.warn(`  AI pricing extraction failed: ${toErrorMessage(err)}`);
      return { roomRates: [], packages: [], discounts: [], priceContext: `Error: ${toErrorMessage(err)}` };
    }
  }

  // ─── Extract from all of a competitor's ads ─────────────────────────────

  async extractAll(ads: Ad[]): Promise<PricingAnalysis> {
    const allPrices: ExtractedPricing['prices'] = [];
    const allDiscounts: ExtractedPricing['discounts'] = [];
    let bestConfidence: 'high' | 'medium' | 'low' = 'low';

    for (const ad of ads) {
      // Combine all text fields
      const text = [ad.adCopy, ad.headline]
        .filter(Boolean)
        .join('\n');

      if (!text.trim()) continue;

      const extracted = this.extractFromText(text);
      allPrices.push(...extracted.prices);
      allDiscounts.push(...extracted.discounts);

      if (
        extracted.confidence === 'high' ||
        (extracted.confidence === 'medium' && bestConfidence === 'low')
      ) {
        bestConfidence = extracted.confidence;
      }
    }

    // If regex found nothing and we have AI capability, try AI on promotional ads
    if (allPrices.length === 0 && this.client) {
      const promoAds = ads.filter(
        (a) => a.adCopy && PROMO_KEYWORDS.test(a.adCopy),
      );

      if (promoAds.length > 0) {
        log.debug(`  Regex found no prices — trying AI on ${promoAds.length} promotional ads`);

        // Only call AI on up to 2 ads to control cost
        for (const ad of promoAds.slice(0, 2)) {
          const aiResult = await this.extractWithAI(
            [ad.adCopy, ad.headline].filter(Boolean).join('\n'),
          );

          for (const rate of aiResult.roomRates) {
            const currency = rate.currency?.toUpperCase() === 'USD' ? 'USD' as const : 'THB' as const;
            if (isReasonablePrice(rate.price)) {
              allPrices.push({
                value: rate.price,
                currency,
                context: `AI: ${rate.type}`,
              });
            }
          }

          for (const pkg of aiResult.packages) {
            const currency = pkg.currency?.toUpperCase() === 'USD' ? 'USD' as const : 'THB' as const;
            if (isReasonablePrice(pkg.price)) {
              allPrices.push({
                value: pkg.price,
                currency,
                context: `AI package: ${pkg.name}`,
              });
            }
          }

          for (const disc of aiResult.discounts) {
            allDiscounts.push({
              raw: disc.description,
              pct: disc.pct,
              absolute: null,
            });
          }

          bestConfidence = 'low'; // AI results are lower confidence
          await sleep(500); // Brief pause between AI calls
        }
      }
    }

    // Build PricingData
    const uniquePrices = this.deduplicatePrices(allPrices);
    const uniqueDiscounts = this.deduplicateDiscounts(allDiscounts);
    const now = new Date();

    // Determine dominant currency
    const thbCount = uniquePrices.filter((p) => p.currency === 'THB').length;
    const usdCount = uniquePrices.filter((p) => p.currency === 'USD').length;
    const dominantCurrency: 'THB' | 'USD' = thbCount >= usdCount ? 'THB' : 'USD';

    // Filter to reasonable hotel prices in the dominant currency
    const hotelPrices = uniquePrices.filter(
      (p) =>
        p.currency === dominantCurrency &&
        isReasonableHotelPrice(p.value, dominantCurrency),
    );

    const priceValues = hotelPrices.map((p) => p.value).sort((a, b) => a - b);

    // Build room rates
    const roomRates: RoomRate[] = hotelPrices.map((p) => ({
      roomType: p.context.includes(':') ? p.context.split(':')[1]!.trim() : 'Standard',
      pricePerNight: p.value,
      currency: p.currency,
      source: 'ad_extraction',
      extractedAt: now,
    }));

    // Build discounts
    const discountList: Discount[] = uniqueDiscounts.map((d) => ({
      description: d.raw,
      discountPct: d.pct,
      absoluteDiscount: d.absolute,
      currency: d.absolute != null ? dominantCurrency : null,
      validUntil: null,
    }));

    // Build package prices (prices from AI context that mention "package")
    const packagePrices: PackagePrice[] = uniquePrices
      .filter((p) => p.context.toLowerCase().includes('package'))
      .map((p) => ({
        name: p.context.replace(/^AI\s*package:\s*/i, ''),
        price: p.value,
        currency: p.currency,
        inclusions: [],
      }));

    // Compute aggregates
    const lowestRate = priceValues.length > 0 ? priceValues[0]! : null;
    const highestRate = priceValues.length > 0 ? priceValues[priceValues.length - 1]! : null;
    const averageRate =
      priceValues.length > 0
        ? round(priceValues.reduce((s, v) => s + v, 0) / priceValues.length, 0)
        : null;

    // Determine price position
    const pricePosition = this.determinePricePosition(averageRate, dominantCurrency);

    return {
      pricingData: {
        roomRates,
        discounts: discountList,
        packagePrices,
        currency: dominantCurrency,
        pricePosition,
        lowestRate,
        highestRate,
        averageRate,
      },
      confidence: bestConfidence,
      priceCount: uniquePrices.length,
      discountCount: uniqueDiscounts.length,
    };
  }

  // ─── Currency inference ─────────────────────────────────────────────────

  /**
   * Infer currency from context surrounding a price match.
   * Default to THB (Thai market focus).
   */
  private inferCurrency(text: string, matchIndex: number): 'THB' | 'USD' {
    // Look at ±50 chars around the match
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(text.length, matchIndex + 50);
    const context = text.slice(start, end).toLowerCase();

    if (context.includes('$') || context.includes('usd')) return 'USD';
    return 'THB';
  }

  // ─── Price position determination ───────────────────────────────────────

  /**
   * Map average rate to a position tier based on Hua Hin market benchmarks.
   */
  private determinePricePosition(
    avgRate: number | null,
    currency: 'THB' | 'USD',
  ): PricePosition {
    if (avgRate === null) return PricePosition.Average;

    // Convert USD to THB-equivalent for comparison (approximate)
    const thbRate = currency === 'USD' ? avgRate * 35 : avgRate;

    if (thbRate < 2_000) return PricePosition.Cheapest;
    if (thbRate < 4_000) return PricePosition.BelowAverage;
    if (thbRate < 8_000) return PricePosition.Average;
    if (thbRate < 15_000) return PricePosition.AboveAverage;
    return PricePosition.Premium;
  }

  // ─── De-duplication helpers ─────────────────────────────────────────────

  private deduplicatePrices(
    prices: ExtractedPricing['prices'],
  ): ExtractedPricing['prices'] {
    const seen = new Set<string>();
    return prices.filter((p) => {
      const key = `${p.currency}:${p.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicateDiscounts(
    discounts: ExtractedPricing['discounts'],
  ): ExtractedPricing['discounts'] {
    const seen = new Set<string>();
    return discounts.filter((d) => {
      const key = `${d.pct ?? ''}:${d.absolute ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
