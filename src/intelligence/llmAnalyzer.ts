import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import OpenAI from 'openai';
import { createLogger } from '../utils/logger.js';
import { settings } from '../config/settings.js';

// ===========================================================================
// Configuration
// ===========================================================================

const log = createLogger('llm_analyzer');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const PRIMARY_MODEL = process.env['OPENROUTER_PRIMARY_MODEL'] ?? 'anthropic/claude-sonnet-4-5';
const FALLBACK_MODEL = process.env['OPENROUTER_FALLBACK_MODEL'] ?? 'google/gemini-2.0-flash-001';

const EXTRA_HEADERS = {
    'HTTP-Referer': 'https://pratap.ai',
    'X-Title': 'Hua Hin Competitor Intelligence',
};

const MAX_TOKENS = parseInt(process.env['OPENROUTER_MAX_TOKENS'] ?? '2000', 10);
const MAX_RETRIES = parseInt(process.env['OPENROUTER_MAX_RETRIES'] ?? '2', 10);
const TEMPERATURE = 0.3;

// Cache settings
const CACHE_DIR = path.resolve(process.cwd(), 'cache/llm');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Running cost accumulator
const sessionStats = {
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cacheHits: 0,
    errors: 0,
};

// ===========================================================================
// OpenRouter client
// ===========================================================================

let _client: OpenAI | null = null;

function getClient(): OpenAI {
    if (_client) return _client;

    const apiKey = process.env['OPENROUTER_API_KEY'];
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not set. Get your key at https://openrouter.ai/keys');
    }

    _client = new OpenAI({
        baseURL: OPENROUTER_BASE_URL,
        apiKey,
        defaultHeaders: EXTRA_HEADERS,
    });

    return _client;
}

// ===========================================================================
// Disk-based cache
// ===========================================================================

function getCacheKey(prompt: string, model: string): string {
    const raw = `${model}::${prompt}`;
    return crypto.createHash('md5').update(raw, 'utf8').digest('hex');
}

function getCachePath(key: string): string {
    return path.join(CACHE_DIR, `${key}.json`);
}

async function ensureCacheDir(): Promise<void> {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (err) {
        // Ignore error if directory already exists
    }
}

async function readCache(key: string): Promise<any | null> {
    const cachePath = getCachePath(key);
    try {
        const dataStr = await fs.readFile(cachePath, 'utf-8');
        const data = JSON.parse(dataStr);
        const cachedAt = new Date(data.cached_at).getTime();

        if (Date.now() - cachedAt > CACHE_TTL_MS) {
            await fs.unlink(cachePath).catch(() => { });
            return null;
        }

        sessionStats.cacheHits++;
        log.info(`Cache HIT  key=${key.substring(0, 12)}`);
        return data.response;
    } catch (err) {
        return null; // Don't throw if file doesn't exist or is invalid JSON
    }
}

async function writeCache(key: string, response: any): Promise<void> {
    await ensureCacheDir();
    const cachePath = getCachePath(key);
    const payload = {
        cached_at: new Date().toISOString(),
        response,
    };
    try {
        await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf-8');
        log.info(`Cache WRITE key=${key.substring(0, 12)}`);
    } catch (err) {
        log.error(`Failed to write cache for key=${key}`, { error: String(err) });
    }
}

// ===========================================================================
// Low-level call with retry + fallback
// ===========================================================================

interface CallLlmOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    useCache?: boolean;
}

interface LlmResult {
    content: string;
    model: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    cached: boolean;
}

async function callLlm(
    systemPrompt: string,
    userPrompt: string,
    options: CallLlmOptions = {}
): Promise<LlmResult> {
    const model = options.model ?? PRIMARY_MODEL;
    const maxTokens = options.maxTokens ?? MAX_TOKENS;
    const temperature = options.temperature ?? TEMPERATURE;
    const useCache = options.useCache ?? true;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // ── Check cache ──
    let key = '';
    if (useCache) {
        key = getCacheKey(fullPrompt, model);
        const cached = await readCache(key);
        if (cached !== null) {
            return { ...cached, cached: true };
        }
    }

    // ── API call with retry ──
    const client = getClient();
    const modelsToTry = [model];
    if (model === PRIMARY_MODEL && FALLBACK_MODEL && FALLBACK_MODEL !== model) {
        modelsToTry.push(FALLBACK_MODEL);
    }

    let lastError: Error | null = null;

    for (const attemptModel of modelsToTry) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const t0 = performance.now();
                const resp = await client.chat.completions.create({
                    model: attemptModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    max_tokens: maxTokens,
                    temperature,
                });
                const elapsed = (performance.now() - t0) / 1000;

                const usage = {
                    promptTokens: resp.usage?.prompt_tokens ?? 0,
                    completionTokens: resp.usage?.completion_tokens ?? 0,
                    totalTokens: resp.usage?.total_tokens ?? 0,
                };

                sessionStats.calls++;
                sessionStats.promptTokens += usage.promptTokens;
                sessionStats.completionTokens += usage.completionTokens;
                sessionStats.totalTokens += usage.totalTokens;

                const content = resp.choices[0]?.message?.content ?? '';

                log.info(
                    `LLM OK  model=${attemptModel}  tokens=${usage.totalTokens}  elapsed=${elapsed.toFixed(1)}s`
                );

                const result: LlmResult = {
                    content,
                    model: attemptModel,
                    usage,
                    cached: false,
                };

                if (useCache && key) {
                    await writeCache(key, result);
                }

                return result;
            } catch (exc) {
                lastError = exc instanceof Error ? exc : new Error(String(exc));
                sessionStats.errors++;
                log.warn(
                    `LLM ERROR  model=${attemptModel}  attempt=${attempt}/${MAX_RETRIES}  error=${lastError.message.substring(0, 200)}`
                );
                if (attempt < MAX_RETRIES) {
                    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000)); // Exponential backoff
                }
            }
        }
    }

    throw new Error(`All LLM attempts failed. Last error: ${lastError?.message}`);
}

// ===========================================================================
// JSON extraction helper
// ===========================================================================

function extractJson(text: string): any {
    // Strip markdown fences
    let cleanText = text.replace(/^\s*```(?:json)?\s*/m, '');
    cleanText = cleanText.replace(/\s*```\s*$/m, '');
    cleanText = cleanText.trim();

    // Try to locate JSON boundaries
    const startChars = ['{', '['];
    const endChars = ['}', ']'];

    for (let i = 0; i < startChars.length; i++) {
        const startChar = startChars[i];
        const endChar = endChars[i];

        const start = cleanText.indexOf(startChar!);
        const end = cleanText.lastIndexOf(endChar!);

        if (start !== -1 && end !== -1 && end > start) {
            let candidate = cleanText.substring(start, end + 1);
            // Remove trailing commas before closing braces / brackets
            candidate = candidate.replace(/,\s*([}\]])/g, '$1');
            try {
                return JSON.parse(candidate);
            } catch (err) {
                continue;
            }
        }
    }

    throw new Error(`Could not extract JSON from LLM response: ${text.substring(0, 200)}`);
}

// ===========================================================================
// Prompt 5A — Analyze a single competitor's strategy
// ===========================================================================

const COMPETITOR_SYSTEM_PROMPT = `You are a senior competitive intelligence analyst specializing in the hospitality and hotel industry in Hua Hin, Thailand.

You will receive structured data about a competitor's Facebook posts, Meta ads, and ad categories. Analyze their marketing strategy and return your analysis as a JSON object.

IMPORTANT: Return ONLY valid JSON — no markdown, no commentary, no explanation outside the JSON.`;

const COMPETITOR_USER_TEMPLATE = `Analyze the following competitor data and return a JSON object with these exact keys:

{
  "strategy_summary": "2-3 sentence summary of their overall marketing strategy",
  "primary_strategy": "one of: brand_awareness | direct_response | engagement | promotional | mixed",
  "usp_detected": ["list of unique selling propositions you can identify"],
  "target_segments": ["list of customer segments they appear to target"],
  "cta_patterns": ["list of call-to-action patterns used"],
  "content_themes": ["list of recurring content themes"],
  "ad_spend_indicator": "one of: heavy | moderate | light | minimal",
  "threat_level": "one of: high | medium | low",
  "threat_reasoning": "1-2 sentence explanation of threat assessment",
  "opportunities": ["list of gaps or opportunities you see vs this competitor"],
  "language_split": {
    "thai_pct": 0,
    "english_pct": 0,
    "mixed_pct": 0
  },
  "posting_cadence": "one of: daily | several_per_week | weekly | sporadic | dormant",
  "estimated_monthly_budget_thb": "one of: <50k | 50-200k | 200-500k | 500k-1M | 1M+"
}

=== COMPETITOR DATA ===
Competitor Name: {{competitor_name}}

Recent Posts ({{post_count}} posts, last 7 days):
{{posts_summary}}

Active Ads ({{ad_count}} ads):
{{ads_summary}}

Ad Categories:
{{categories_summary}}

Engagement Metrics:
- Average engagement per post: {{avg_engagement}}
- Top post engagement: {{top_engagement}}
`;

export async function analyzeCompetitorStrategy(competitorData: any): Promise<any> {
    const name = competitorData.competitorName || 'Unknown';
    const posts = competitorData.recentPosts || [];
    const ads = competitorData.activeAds || [];
    const cats = competitorData.adsByCategory || {};
    const summary = competitorData.summary || {};

    // ── Build text summaries for the prompt ──
    const postsLines: string[] = [];
    for (const p of posts.slice(0, 10)) {
        const text = (p.postText || '').substring(0, 200);
        const eng = (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
        postsLines.push(`  - [${p.postDate || '?'}] ${text}  (engagement: ${eng})`);
    }
    const postsSummary = postsLines.length > 0 ? postsLines.join('\n') : '  No recent posts available.';

    const adsLines: string[] = [];
    for (const a of ads.slice(0, 8)) {
        const headline = (a.adHeadline || '').substring(0, 150);
        const adText = (a.adText || '').substring(0, 150);
        const cta = a.callToAction || 'None';
        const platforms = (a.platforms || ['Facebook']).join(', ');
        adsLines.push(`  - [${cta}] ${headline} | ${adText}  (${platforms})`);
    }
    const adsSummary = adsLines.length > 0 ? adsLines.join('\n') : '  No active ads found.';

    const catLines: string[] = [];
    for (const [catName, catAds] of Object.entries(cats)) {
        const count = Array.isArray(catAds) ? catAds.length : 0;
        catLines.push(`  - ${catName}: ${count} ads`);
    }
    const categoriesSummary = catLines.length > 0 ? catLines.join('\n') : '  No category data.';

    const topPostObj = summary.topPerformingPost || {};
    const topEngagement = (topPostObj.likes || 0) + (topPostObj.comments || 0) + (topPostObj.shares || 0);

    const userPrompt = COMPETITOR_USER_TEMPLATE
        .replace('{{competitor_name}}', name)
        .replace('{{post_count}}', String(posts.length))
        .replace('{{posts_summary}}', postsSummary)
        .replace('{{ad_count}}', String(ads.length))
        .replace('{{ads_summary}}', adsSummary)
        .replace('{{categories_summary}}', categoriesSummary)
        .replace('{{avg_engagement}}', String(summary.avgEngagementPerPost || 0))
        .replace('{{top_engagement}}', String(topEngagement));

    log.info(`Analyzing competitor: ${name}`);
    const result = await callLlm(COMPETITOR_SYSTEM_PROMPT, userPrompt);

    let analysis: any;
    try {
        analysis = extractJson(result.content);
    } catch (err) {
        // Retry once if JSON extraction fails
        log.warn(`JSON parse failed for ${name} — retrying with stricter prompt`);
        const retry = await callLlm(
            COMPETITOR_SYSTEM_PROMPT,
            userPrompt + '\n\nREMINDER: Return ONLY the JSON object, nothing else.',
            { useCache: false }
        );
        analysis = extractJson(retry.content);
    }

    if (analysis && typeof analysis === 'object') {
        analysis._meta = {
            model: result.model,
            cached: result.cached || false,
            tokens: result.usage,
            analyzed_at: new Date().toISOString(),
        };
    }

    return analysis;
}

// ===========================================================================
// Prompt 5B — Generate market-wide intelligence
// ===========================================================================

const MARKET_SYSTEM_PROMPT = `You are a senior market intelligence strategist specializing in the Hua Hin, Thailand hospitality sector.

You will receive a summary of all competitors in the market. Produce a comprehensive market intelligence report as a JSON object.

IMPORTANT: Return ONLY valid JSON — no markdown, no commentary.`;

const MARKET_USER_TEMPLATE = `Analyze the following market data and return a JSON object with these exact keys:

{
  "market_overview": "3-4 sentence overview of the competitive landscape",
  "dominant_strategies": [
    {"strategy": "name", "competitors": ["who uses it"], "effectiveness": "high/medium/low"}
  ],
  "market_segments": [
    {"segment": "name", "saturation": "high/medium/low", "competitors_targeting": ["names"]}
  ],
  "content_trends": [
    {"trend": "description", "direction": "rising/stable/declining", "examples": ["competitor examples"]}
  ],
  "playbook": [
    {"action": "specific tactical recommendation", "priority": "high/medium/low", "rationale": "why", "expected_impact": "what it achieves"}
  ],
  "recommended_actions": [
    {"action": "actionable step", "timeframe": "immediate/short_term/medium_term", "effort": "low/medium/high", "impact": "high/medium/low"}
  ],
  "gaps_and_opportunities": [
    {"opportunity": "description", "evidence": "supporting data"}
  ],
  "risk_factors": [
    {"risk": "description", "severity": "high/medium/low", "mitigation": "suggested response"}
  ]
}

=== MARKET DATA ===
Total competitors analyzed: {{total_competitors}}
Report date: {{report_date}}

{{competitors_block}}
`;

export async function generateMarketIntelligence(allCompetitors: any[]): Promise<any> {
    // Build condensed competitor block
    const blocks: string[] = [];
    for (const comp of allCompetitors) {
        const name = comp.competitorName || 'Unknown';
        const s = comp.summary || {};
        const catKeys = Object.keys(comp.adsByCategory || {});
        const topPostText = (s.topPerformingPost?.postText || 'N/A').substring(0, 120);

        blocks.push(
            `## ${name}\n` +
            `  Posts (7d): ${s.totalPostsFound || 0}\n` +
            `  Active ads: ${s.activeAdsCount || 0}\n` +
            `  Avg engagement: ${s.avgEngagementPerPost || 0}\n` +
            `  Ad categories: [${catKeys.join(', ')}]\n` +
            `  Top post: ${topPostText}\n`
        );
    }

    const userPrompt = MARKET_USER_TEMPLATE
        .replace('{{total_competitors}}', String(allCompetitors.length))
        .replace('{{report_date}}', new Date().toISOString().substring(0, 10))
        .replace('{{competitors_block}}', blocks.join('\n'));

    log.info(`Generating market intelligence for ${allCompetitors.length} competitors`);
    const result = await callLlm(MARKET_SYSTEM_PROMPT, userPrompt, { maxTokens: 3000 });

    let intel: any;
    try {
        intel = extractJson(result.content);
    } catch (err) {
        log.warn('JSON parse failed for market intel — retrying');
        const retry = await callLlm(
            MARKET_SYSTEM_PROMPT,
            userPrompt + '\n\nREMINDER: Return ONLY the JSON object.',
            { maxTokens: 3000, useCache: false }
        );
        intel = extractJson(retry.content);
    }

    if (intel && typeof intel === 'object') {
        intel._meta = {
            model: result.model,
            cached: result.cached || false,
            tokens: result.usage,
            generated_at: new Date().toISOString(),
        };
    }

    return intel;
}

// ===========================================================================
// Prompt 5C — Generate executive brief text (pure data transform, no API)
// ===========================================================================

export function generateExecutiveBriefText(marketIntel: any): string {
    const lines: string[] = [];
    const timestamp = marketIntel._meta?.generated_at || new Date().toISOString();

    lines.push('='.repeat(60));
    lines.push('  EXECUTIVE INTELLIGENCE BRIEF');
    lines.push(`  Generated: ${timestamp.substring(0, 10)}`);
    lines.push('='.repeat(60));
    lines.push('');

    // Market overview
    const overview = marketIntel.market_overview || 'No overview available.';
    lines.push('📊 MARKET OVERVIEW');
    lines.push(`   ${overview}`);
    lines.push('');

    // Dominant strategies
    const strategies = marketIntel.dominant_strategies || [];
    if (strategies.length > 0) {
        lines.push('🎯 DOMINANT STRATEGIES');
        for (const s of strategies.slice(0, 5)) {
            const eff = s.effectiveness || '?';
            const comps = (s.competitors || []).slice(0, 3).join(', ');
            lines.push(`   • ${s.strategy || '?'} [${eff}] — ${comps}`);
        }
        lines.push('');
    }

    // Top recommended actions
    const actions = marketIntel.recommended_actions || [];
    if (actions.length > 0) {
        lines.push('✅ RECOMMENDED ACTIONS');
        for (let i = 0; i < Math.min(actions.length, 5); i++) {
            const a = actions[i];
            const tf = a.timeframe || '?';
            lines.push(`   ${i + 1}. [${tf.toUpperCase()}] ${a.action || '?'}`);
        }
        lines.push('');
    }

    // Key opportunities
    const opps = marketIntel.gaps_and_opportunities || [];
    if (opps.length > 0) {
        lines.push('💡 KEY OPPORTUNITIES');
        for (const o of opps.slice(0, 3)) {
            lines.push(`   • ${o.opportunity || '?'}`);
            lines.push(`     Evidence: ${o.evidence || 'N/A'}`);
        }
        lines.push('');
    }

    // Risk factors
    const risks = marketIntel.risk_factors || [];
    if (risks.length > 0) {
        lines.push('⚠️  RISK FACTORS');
        for (const r of risks.slice(0, 3)) {
            const sev = r.severity || '?';
            lines.push(`   • [${sev.toUpperCase()}] ${r.risk || '?'}`);
            lines.push(`     Mitigation: ${r.mitigation || 'N/A'}`);
        }
        lines.push('');
    }

    // Session stats
    lines.push('─'.repeat(60));
    lines.push('  LLM Session Stats');
    lines.push(`  API calls: ${sessionStats.calls}`);
    lines.push(`  Cache hits: ${sessionStats.cacheHits}`);
    lines.push(`  Total tokens: ${sessionStats.totalTokens.toLocaleString()}`);
    lines.push(`  Errors: ${sessionStats.errors}`);
    lines.push('─'.repeat(60));

    return lines.join('\n');
}

// ===========================================================================
// Cost summary (convenience)
// ===========================================================================

export function getSessionCostSummary(): any {
    const stats = { ...sessionStats };
    // Conservative estimate using Claude pricing ($3/M in, $15/M out)
    const inputCost = (stats.promptTokens / 1_000_000) * 3.0;
    const outputCost = (stats.completionTokens / 1_000_000) * 15.0;
    (stats as any).estimated_cost_usd = Number((inputCost + outputCost).toFixed(4));
    return stats;
}
