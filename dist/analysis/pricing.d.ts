import type { Ad, PricingData } from '../types/index.js';
/** Raw extraction result from a single text passage. */
export interface ExtractedPricing {
    prices: Array<{
        value: number;
        currency: 'THB' | 'USD';
        context: string;
    }>;
    discounts: Array<{
        raw: string;
        pct: number | null;
        absolute: number | null;
    }>;
    confidence: 'high' | 'medium' | 'low';
}
/** AI-enriched pricing result (only used as fallback). */
export interface AIPricingResult {
    roomRates: Array<{
        type: string;
        price: number;
        currency: string;
    }>;
    packages: Array<{
        name: string;
        price: number;
        currency: string;
        inclusions: string[];
    }>;
    discounts: Array<{
        description: string;
        pct: number | null;
    }>;
    priceContext: string;
}
/** Full pricing analysis across all of a competitor's ads. */
export interface PricingAnalysis {
    pricingData: PricingData;
    confidence: 'high' | 'medium' | 'low';
    priceCount: number;
    discountCount: number;
}
export declare class PricingExtractor {
    private readonly client;
    private readonly model;
    private readonly maxTokens;
    constructor(enableAI?: boolean);
    extractFromText(text: string): ExtractedPricing;
    extractWithAI(text: string): Promise<AIPricingResult>;
    extractAll(ads: Ad[]): Promise<PricingAnalysis>;
    /**
     * Infer currency from context surrounding a price match.
     * Default to THB (Thai market focus).
     */
    private inferCurrency;
    /**
     * Map average rate to a position tier based on Hua Hin market benchmarks.
     */
    private determinePricePosition;
    private deduplicatePrices;
    private deduplicateDiscounts;
}
//# sourceMappingURL=pricing.d.ts.map