// =============================================================================
// Meta Ads Library Scraper — Playwright-based
//
// ⚠️  DEPRECATED (2026-03) — replaced by Apify-based metaAdsScraper.js
// This file is kept for reference only. The ScrapeService no longer imports it.
// See: src/scrapers/metaAdsScraper.js for the current implementation.
//
// Navigates to each competitor's Meta Ad Library URL, scrolls to load all ads,
// extracts structured data from every ad card, takes per-ad screenshots, and
// returns an array of `NewAd`-shaped objects ready for DB upsert.
// =============================================================================
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createLogger } from '../utils/logger.js';
import { sleep, sleepRandom, withRetry, toErrorMessage, slugify, normaliseWhitespace, truncate, formatDuration, } from '../utils/helpers.js';
import { settings } from '../config/settings.js';
import { CreativeType, CtaType, Platform, } from '../types/index.js';
const log = createLogger('MetaAdsScraper');
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ADS_LIBRARY_BASE = 'https://www.facebook.com/ads/library/';
/** Selectors — Meta changes the DOM regularly; centralise them here. */
const SEL = {
    /** Every ad card rendered in the library grid. */
    adCard: 'div[class*="xrvj5dj"]',
    /** The "No ads match" empty-state indicator. */
    noAdsMessage: 'div._99s5',
    /** "See more" / "Show original" expander link inside ad copy. */
    seeMore: 'div[role="button"][tabindex="0"]',
    /** General container that wraps each ad's metadata row. */
    adMeta: 'span._7jyr',
    /** Page-level loading spinner. */
    loadingSpinner: 'div[role="progressbar"]',
};
/** Realistic desktop user-agents (rotated per context). */
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
];
// ─────────────────────────────────────────────────────────────────────────────
// Price extraction regexes
// ─────────────────────────────────────────────────────────────────────────────
const PRICE_PATTERNS = [
    // THB / Baht prices:  ฿3,500   THB 3,500   3,500 Baht
    /(?:฿|THB|Baht)\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:THB|Baht|บาท)/gi,
    // USD prices:  $199   USD 199
    /(?:\$|USD)\s*([\d,]+(?:\.\d{1,2})?)/gi,
    // "Starting from" / "from"
    /(?:starting\s+(?:from|at)|from)\s*(?:฿|THB|\$|USD)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    // "per night"
    /([\d,]+(?:\.\d{1,2})?)\s*(?:\/\s*night|per\s*night)/gi,
];
const DISCOUNT_PATTERNS = [
    // Percentage: 30% off, up to 40% discount, save 25%
    /(\d{1,3})\s*%\s*(?:off|discount|ส่วนลด)/gi,
    /(?:save|up\s*to)\s*(\d{1,3})\s*%/gi,
    // Absolute: save ฿500, discount 1000 Baht
    /(?:save|discount)\s*(?:฿|THB)?\s*([\d,]+)/gi,
];
// ─────────────────────────────────────────────────────────────────────────────
// CTA button text → enum mapping
// ─────────────────────────────────────────────────────────────────────────────
const CTA_MAP = {
    'book now': CtaType.BookNow,
    'จองเลย': CtaType.BookNow,
    'learn more': CtaType.LearnMore,
    'เรียนรู้เพิ่มเติม': CtaType.LearnMore,
    'get offer': CtaType.GetOffer,
    'shop now': CtaType.ShopNow,
    'contact us': CtaType.ContactUs,
    'sign up': CtaType.SignUp,
    'subscribe': CtaType.Subscribe,
    'watch more': CtaType.WatchMore,
    'send message': CtaType.MessagePage,
    'ส่งข้อความ': CtaType.MessagePage,
};
// ─────────────────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────────────────
export class MetaAdsScraper {
    browser = null;
    screenshotsDir;
    maxAdsPerCompetitor;
    headless;
    timeoutMs;
    maxRetries;
    requestDelayMs;
    constructor() {
        this.screenshotsDir = resolve(settings.paths.screenshots);
        this.maxAdsPerCompetitor = settings.meta.maxAdsPerCompetitor;
        this.headless = settings.scraper.headless;
        this.timeoutMs = settings.scraper.timeoutMs;
        this.maxRetries = settings.scraper.maxRetries;
        this.requestDelayMs = settings.scraper.requestDelayMs;
    }
    // ─── Lifecycle ────────────────────────────────────────────────────────────
    async init() {
        log.info('Launching Chromium browser...');
        const launchOpts = {
            headless: this.headless,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
            ],
        };
        if (settings.scraper.chromiumPath) {
            launchOpts.executablePath = settings.scraper.chromiumPath;
        }
        this.browser = await chromium.launch(launchOpts);
        log.info('Browser launched');
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            log.info('Browser closed');
        }
    }
    // ─── Scrape all competitors ───────────────────────────────────────────────
    async scrapeAll(competitors) {
        if (!this.browser) {
            throw new Error('Browser not initialised — call init() first');
        }
        // Keep a dummy context and page open to prevent the browser (especially Edge)
        // from auto-closing or getting suspended when 0 tabs are open during the long delays.
        const keepAliveContext = await this.browser.newContext();
        await keepAliveContext.newPage();
        try {
            const results = new Map();
            log.info(`Starting scrape for ${competitors.length} competitors`);
            for (let i = 0; i < competitors.length; i++) {
                const competitor = competitors[i];
                log.info(`[${i + 1}/${competitors.length}] Scraping ${competitor.name}...`);
                const result = await this.scrapeCompetitorSafe(competitor);
                results.set(competitor.id, result);
                if (result.success) {
                    log.info(`  ✔ ${competitor.name}: ${result.data?.length ?? 0} ads in ${formatDuration(result.durationMs)}`);
                }
                else {
                    log.error(`  ✖ ${competitor.name}: ${result.error} (${formatDuration(result.durationMs)})`);
                }
                // Random delay between competitors (30–60 s) unless it's the last one
                if (i < competitors.length - 1) {
                    const delaySecs = Math.floor(Math.random() * 31) + 30;
                    log.info(`  Waiting ${delaySecs}s before next competitor...`);
                    await sleep(delaySecs * 1_000);
                }
            }
            const successCount = [...results.values()].filter((r) => r.success).length;
            const totalAds = [...results.values()].reduce((sum, r) => sum + (r.data?.length ?? 0), 0);
            log.info(`Scrape complete: ${successCount}/${competitors.length} succeeded, ${totalAds} total ads`);
            return results;
        }
        finally {
            await keepAliveContext.close().catch(() => { });
        }
    }
    // ─── Scrape one competitor (with retry wrapper) ───────────────────────────
    async scrapeCompetitor(competitor) {
        return withRetry(() => this.scrapeCompetitorImpl(competitor), this.maxRetries, 5_000, `scrape:${competitor.name}`);
    }
    // ─── Safe wrapper (catches + returns ScrapeResult) ────────────────────────
    async scrapeCompetitorSafe(competitor) {
        const start = Date.now();
        let retries = 0;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const data = await this.scrapeCompetitorImpl(competitor);
                return {
                    success: true,
                    data,
                    error: null,
                    durationMs: Date.now() - start,
                    retries,
                };
            }
            catch (err) {
                retries++;
                const msg = toErrorMessage(err);
                if (attempt < this.maxRetries) {
                    const backoff = 5_000 * 2 ** attempt;
                    log.warn(`  Attempt ${attempt + 1}/${this.maxRetries + 1} failed for ${competitor.name}: ${msg}. Retrying in ${backoff / 1_000}s`);
                    await sleep(backoff);
                }
                else {
                    return {
                        success: false,
                        data: null,
                        error: msg,
                        durationMs: Date.now() - start,
                        retries,
                    };
                }
            }
        }
        // Should never be reached — included for type-safety
        return {
            success: false,
            data: null,
            error: 'Exhausted retries',
            durationMs: Date.now() - start,
            retries,
        };
    }
    // ─── Core implementation ──────────────────────────────────────────────────
    async scrapeCompetitorImpl(competitor) {
        if (!this.browser)
            throw new Error('Browser not initialised');
        const context = await this.createContext();
        let page = null;
        try {
            page = await context.newPage();
            await this.setupPageStealth(page);
            // Navigate to the competitor's Ads Library URL
            const url = competitor.adsLibraryUrl || this.buildAdsLibraryUrl(competitor);
            log.debug(`  Navigating to: ${url}`);
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: this.timeoutMs,
            });
            // Wait for the page to settle
            await sleepRandom(3_000, 5_000);
            // Handle cookie consent / GDPR dialogs
            await this.dismissDialogs(page);
            // Check for "no ads"
            const isEmpty = await this.checkNoAds(page);
            if (isEmpty) {
                log.info(`  ${competitor.name}: no ads found`);
                return [];
            }
            // Scroll to load all ads (or up to the configured max)
            const totalCards = await this.scrollToLoadAds(page);
            log.info(`  ${competitor.name}: loaded ${totalCards} ad cards`);
            // Ensure competitor screenshot directory exists
            const competitorDir = join(this.screenshotsDir, slugify(competitor.name));
            mkdirSync(competitorDir, { recursive: true });
            // Parse each ad card
            const ads = await this.extractAdsFromPage(page, competitor, competitorDir);
            return ads;
        }
        finally {
            if (page)
                await page.close().catch(() => { });
            await context.close().catch(() => { });
        }
    }
    // ─── Browser context factory ──────────────────────────────────────────────
    async createContext() {
        if (!this.browser)
            throw new Error('Browser not initialised');
        const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        return this.browser.newContext({
            userAgent,
            viewport: {
                width: settings.scraper.viewport.width,
                height: settings.scraper.viewport.height,
            },
            locale: 'en-US',
            timezoneId: 'Asia/Bangkok',
            // Block images, fonts and media to speed up scraping
            // (we take our own screenshots per ad card later)
            javaScriptEnabled: true,
            ignoreHTTPSErrors: true,
        });
    }
    // ─── Stealth patches ─────────────────────────────────────────────────────
    async setupPageStealth(page) {
        // Override navigator.webdriver to prevent detection
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            // Randomise plugin count
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            // Override chrome property
            window['chrome'] = { runtime: {} };
        });
    }
    // ─── Dialog dismissal ────────────────────────────────────────────────────
    async dismissDialogs(page) {
        try {
            // Cookie consent (multiple known selectors)
            const cookieSelectors = [
                'button[data-cookiebanner="accept_button"]',
                'button[title="Allow all cookies"]',
                'button[title="Allow essential and optional cookies"]',
                'button:has-text("Accept All")',
                'button:has-text("Allow all")',
                'button:has-text("Decline optional cookies")',
            ];
            for (const sel of cookieSelectors) {
                const btn = page.locator(sel).first();
                if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
                    // Prefer declining optional cookies for privacy
                    if (sel.includes('Decline')) {
                        await btn.click();
                        log.debug('  Declined optional cookies');
                    }
                    else {
                        await btn.click();
                        log.debug('  Dismissed cookie dialog');
                    }
                    await sleep(1_000);
                    break;
                }
            }
            // Login prompt overlay
            const loginClose = page.locator('div[role="dialog"] div[aria-label="Close"]').first();
            if (await loginClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
                await loginClose.click();
                log.debug('  Dismissed login dialog');
                await sleep(500);
            }
        }
        catch {
            // Silently continue — dialogs are optional
        }
    }
    // ─── "No ads" detection ──────────────────────────────────────────────────
    async checkNoAds(page) {
        try {
            // Look for the well-known empty-state text
            const noAdsText = await page
                .locator('text="No ads match your search"')
                .first()
                .isVisible({ timeout: 3_000 });
            if (noAdsText)
                return true;
            // Alternative: specific class
            const noAdsDiv = await page
                .locator(SEL.noAdsMessage)
                .first()
                .isVisible({ timeout: 1_000 });
            if (noAdsDiv)
                return true;
            // Check if there are 0 ad cards after initial load
            const cardCount = await page.locator(SEL.adCard).count();
            // Also look for generic ad containers
            const genericCards = await page.locator('[class*="x1dr75xp"]').count();
            return cardCount === 0 && genericCards === 0;
        }
        catch {
            return false;
        }
    }
    // ─── Infinite scroll ─────────────────────────────────────────────────────
    async scrollToLoadAds(page) {
        let previousCount = 0;
        let stableRounds = 0;
        const maxStableRounds = 3; // Stop after 3 scrolls with no new content
        for (let round = 0; round < 50; round++) {
            // Count current ads
            const currentCount = await page
                .locator(SEL.adCard)
                .count()
                .catch(() => 0);
            // Also try generic ad container selector
            const altCount = await page
                .locator('[class*="x1dr75xp"]')
                .count()
                .catch(() => 0);
            const bestCount = Math.max(currentCount, altCount);
            // Stop if we hit the per-competitor cap
            if (bestCount >= this.maxAdsPerCompetitor) {
                log.debug(`  Reached ad cap (${this.maxAdsPerCompetitor}), stopping scroll`);
                return bestCount;
            }
            // Check stability
            if (bestCount === previousCount) {
                stableRounds++;
                if (stableRounds >= maxStableRounds) {
                    log.debug(`  No new ads after ${maxStableRounds} scrolls (total: ${bestCount})`);
                    return bestCount;
                }
            }
            else {
                stableRounds = 0;
            }
            previousCount = bestCount;
            // Scroll down
            await page.evaluate(() => {
                window.scrollTo({
                    top: document.body.scrollHeight,
                    behavior: 'smooth',
                });
            });
            // Wait for content to load
            await sleepRandom(2_000, 4_000);
            // Wait for any loading spinners to disappear
            try {
                await page
                    .locator(SEL.loadingSpinner)
                    .first()
                    .waitFor({ state: 'hidden', timeout: 5_000 });
            }
            catch {
                // Spinner not found or already gone
            }
        }
        const finalCount = await page.locator(SEL.adCard).count().catch(() => 0);
        return finalCount;
    }
    // ─── Extract all ads from loaded page ────────────────────────────────────
    async extractAdsFromPage(page, competitor, screenshotDir) {
        const ads = [];
        const now = new Date();
        // Try primary selector, then fallback
        let cardLocator = page.locator(SEL.adCard);
        let cardCount = await cardLocator.count();
        if (cardCount === 0) {
            cardLocator = page.locator('[class*="x1dr75xp"]');
            cardCount = await cardLocator.count();
        }
        const limit = Math.min(cardCount, this.maxAdsPerCompetitor);
        log.debug(`  Extracting data from ${limit} ad cards...`);
        for (let i = 0; i < limit; i++) {
            try {
                const card = cardLocator.nth(i);
                // Small delay between card extractions
                if (i > 0 && i % 5 === 0) {
                    await sleepRandom(1_000, 2_000);
                }
                const ad = await this.extractSingleAd(page, card, competitor, screenshotDir, i, now);
                if (ad) {
                    ads.push(ad);
                }
            }
            catch (err) {
                log.warn(`  Failed to extract ad #${i + 1} for ${competitor.name}: ${toErrorMessage(err)}`);
            }
        }
        return ads;
    }
    // ─── Extract a single ad card ────────────────────────────────────────────
    async extractSingleAd(page, card, competitor, screenshotDir, index, now) {
        const fullText = await card.innerText().catch(() => '');
        if (!fullText.trim())
            return null;
        // ── Library ID ──────────────────────────────────────────────────────────
        const metaAdId = this.extractLibraryId(fullText, index, competitor);
        // ── "Started running on" date ───────────────────────────────────────────
        const startedRunning = this.extractStartedRunning(fullText);
        // ── Platforms ────────────────────────────────────────────────────────────
        const platforms = this.extractPlatforms(fullText);
        // ── Ad variations count ─────────────────────────────────────────────────
        const adVariationsCount = this.extractVariationsCount(fullText);
        // ── Creative type ───────────────────────────────────────────────────────
        const creativeType = await this.detectCreativeType(card);
        // ── Ad copy + headline ──────────────────────────────────────────────────
        const { adCopy, headline } = this.extractAdCopy(fullText);
        // ── CTA button ──────────────────────────────────────────────────────────
        const ctaType = await this.extractCta(card, fullText);
        // ── Landing URL ─────────────────────────────────────────────────────────
        const landingUrl = await this.extractLandingUrl(card);
        // ── Prices & discounts ──────────────────────────────────────────────────
        const combinedText = [adCopy, headline].filter(Boolean).join(' ');
        const extractedPrice = this.extractPrice(combinedText);
        const extractedDiscount = this.extractDiscount(combinedText);
        // ── Language detection (simple heuristic) ───────────────────────────────
        const language = this.detectLanguage(adCopy ?? '');
        // ── Screenshot ──────────────────────────────────────────────────────────
        const screenshotPath = await this.takeAdScreenshot(card, screenshotDir, metaAdId);
        return {
            competitorId: competitor.id,
            metaAdId,
            startedRunning,
            isActive: true,
            platforms,
            creativeType,
            adCopy: adCopy ? truncate(adCopy, 5_000) : null,
            headline: headline ? truncate(headline, 500) : null,
            ctaType,
            landingUrl,
            adVariationsCount,
            extractedPrice,
            extractedDiscount,
            language,
            screenshotPath,
            scrapedAt: now,
        };
    }
    // ─── Field extractors ────────────────────────────────────────────────────
    extractLibraryId(text, index, competitor) {
        // Look for "Library ID: 123456789"
        const idMatch = /Library\s*ID[:\s]+(\d+)/i.exec(text);
        if (idMatch?.[1])
            return idMatch[1];
        // Look for "ID: 123456789" pattern
        const shortMatch = /\bID[:\s]+(\d{8,20})\b/i.exec(text);
        if (shortMatch?.[1])
            return shortMatch[1];
        // Fallback: generate a deterministic pseudo-ID from competitor + index
        return `${competitor.facebookPageId}_${Date.now()}_${index}`;
    }
    extractStartedRunning(text) {
        // "Started running on Jun 12, 2024"
        const match = /Started\s+running\s+on\s+(\w{3,9}\s+\d{1,2},?\s+\d{4})/i.exec(text);
        if (match?.[1]) {
            const d = new Date(match[1]);
            return isNaN(d.getTime()) ? null : d;
        }
        // "Started running on 12 Jun 2024"
        const altMatch = /Started\s+running\s+on\s+(\d{1,2}\s+\w{3,9}\s+\d{4})/i.exec(text);
        if (altMatch?.[1]) {
            const d = new Date(altMatch[1]);
            return isNaN(d.getTime()) ? null : d;
        }
        return null;
    }
    extractPlatforms(text) {
        const platforms = [];
        const lower = text.toLowerCase();
        if (lower.includes('facebook'))
            platforms.push(Platform.Facebook);
        if (lower.includes('instagram'))
            platforms.push(Platform.Instagram);
        if (lower.includes('messenger'))
            platforms.push(Platform.MessengerInbox);
        if (lower.includes('audience network'))
            platforms.push(Platform.AudienceNetwork);
        // If none detected, default to Facebook (it's the Ads Library after all)
        if (platforms.length === 0)
            platforms.push(Platform.Facebook);
        return platforms;
    }
    extractVariationsCount(text) {
        // "3 ads use this creative and text"
        const match = /(\d+)\s*ads?\s*use\s*this/i.exec(text);
        return match?.[1] ? parseInt(match[1], 10) : 1;
    }
    async detectCreativeType(card) {
        try {
            // Check for video elements
            const hasVideo = (await card.locator('video').count()) > 0 ||
                (await card.locator('[aria-label*="video" i]').count()) > 0;
            if (hasVideo)
                return CreativeType.Video;
            // Check for carousel (multiple images or "swipe" indicators)
            const hasCarousel = (await card.locator('[aria-label*="carousel" i]').count()) > 0 ||
                (await card.locator('[class*="carousel"]').count()) > 0 ||
                (await card.locator('[aria-label="Next card"]').count()) > 0;
            if (hasCarousel)
                return CreativeType.Carousel;
            // Check for image
            const hasImage = (await card.locator('img[src*="scontent"]').count()) > 0 ||
                (await card.locator('img[src*="fbcdn"]').count()) > 0;
            if (hasImage)
                return CreativeType.Image;
            return CreativeType.Unknown;
        }
        catch {
            return CreativeType.Unknown;
        }
    }
    extractAdCopy(text) {
        const lines = text
            .split('\n')
            .map((l) => normaliseWhitespace(l))
            .filter((l) => l.length > 0);
        // Filter out metadata lines
        const metaPatterns = [
            /^Library\s*ID/i,
            /^Started\s+running/i,
            /^\d+\s*ads?\s*use\s*this/i,
            /^Active$/i,
            /^Inactive$/i,
            /^Platforms?:/i,
            /^About\s*this\s*ad/i,
            /^See\s*ad\s*details/i,
            /^Ad\s*details?/i,
            /^Disclaimer/i,
        ];
        const contentLines = lines.filter((l) => !metaPatterns.some((p) => p.test(l)));
        if (contentLines.length === 0) {
            return { adCopy: null, headline: null };
        }
        // Heuristic: the first substantive line (>20 chars) is the ad copy,
        // the first short line (≤100 chars) that follows is the headline.
        let adCopy = null;
        let headline = null;
        for (const line of contentLines) {
            if (!adCopy && line.length > 20) {
                adCopy = line;
            }
            else if (adCopy && !headline && line.length > 5 && line.length <= 100) {
                headline = line;
                break;
            }
        }
        // If no long line found, use whatever we have
        if (!adCopy && contentLines.length > 0) {
            adCopy = contentLines[0];
        }
        return { adCopy, headline };
    }
    async extractCta(card, fullText) {
        // Try to find a CTA button element
        try {
            const buttonSelectors = [
                'a[role="link"]',
                'div[role="button"]',
                'a[href*="l.facebook.com"]',
            ];
            for (const sel of buttonSelectors) {
                const buttons = card.locator(sel);
                const count = await buttons.count();
                for (let i = 0; i < count; i++) {
                    const text = await buttons.nth(i).innerText().catch(() => '');
                    const normalised = text.toLowerCase().trim();
                    const match = CTA_MAP[normalised];
                    if (match)
                        return match;
                }
            }
        }
        catch {
            // Fall through to text-based detection
        }
        // Text-based fallback
        const lower = fullText.toLowerCase();
        for (const [key, ctaType] of Object.entries(CTA_MAP)) {
            if (lower.includes(key))
                return ctaType;
        }
        return CtaType.Unknown;
    }
    async extractLandingUrl(card) {
        try {
            // Look for outbound links (Facebook wraps them in l.facebook.com redirects)
            const links = card.locator('a[href]');
            const count = await links.count();
            for (let i = 0; i < count; i++) {
                const href = await links.nth(i).getAttribute('href');
                if (!href)
                    continue;
                // Direct external URL
                if (href.startsWith('http') &&
                    !href.includes('facebook.com') &&
                    !href.includes('fb.com')) {
                    return href;
                }
                // Facebook redirect: https://l.facebook.com/l.php?u=<encoded_url>
                if (href.includes('l.facebook.com/l.php')) {
                    try {
                        const url = new URL(href);
                        const target = url.searchParams.get('u');
                        if (target)
                            return decodeURIComponent(target);
                    }
                    catch {
                        // Malformed URL
                    }
                }
            }
        }
        catch {
            // No links found
        }
        return null;
    }
    extractPrice(text) {
        if (!text)
            return null;
        for (const pattern of PRICE_PATTERNS) {
            // Reset lastIndex for global regexes
            pattern.lastIndex = 0;
            const match = pattern.exec(text);
            if (match?.[1]) {
                const num = parseFloat(match[1].replace(/,/g, ''));
                if (Number.isFinite(num) && num > 0 && num < 1_000_000) {
                    return num;
                }
            }
        }
        return null;
    }
    extractDiscount(text) {
        if (!text)
            return null;
        for (const pattern of DISCOUNT_PATTERNS) {
            pattern.lastIndex = 0;
            const match = pattern.exec(text);
            if (match?.[1]) {
                const num = parseFloat(match[1].replace(/,/g, ''));
                // Only accept percentage discounts in the 1–99 range
                if (Number.isFinite(num) && num > 0 && num < 100) {
                    return num;
                }
            }
        }
        return null;
    }
    detectLanguage(text) {
        if (!text)
            return null;
        // Thai Unicode range: \u0E00–\u0E7F
        const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) ?? []).length;
        const totalChars = text.replace(/\s/g, '').length;
        if (totalChars === 0)
            return null;
        // If >30% Thai characters → Thai, otherwise English
        return thaiChars / totalChars > 0.3 ? 'th' : 'en';
    }
    async takeAdScreenshot(card, dir, adId) {
        try {
            // Sanitise the ad ID for use as a filename
            const safeId = adId.replace(/[^a-zA-Z0-9_-]/g, '_');
            const filename = `${safeId}.png`;
            const filepath = join(dir, filename);
            await card.screenshot({
                path: filepath,
                type: 'png',
                timeout: 10_000,
            });
            return filepath;
        }
        catch (err) {
            log.debug(`  Screenshot failed for ad ${adId}: ${toErrorMessage(err)}`);
            return null;
        }
    }
    // ─── URL builder ─────────────────────────────────────────────────────────
    buildAdsLibraryUrl(competitor) {
        const params = new URLSearchParams({
            active_status: 'active',
            ad_type: 'all',
            country: settings.meta.adsCountry,
            view_all_page_id: competitor.facebookPageId,
            search_type: 'page',
            media_type: 'all',
        });
        return `${ADS_LIBRARY_BASE}?${params.toString()}`;
    }
}
//# sourceMappingURL=metaAds.js.map