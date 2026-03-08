// =============================================================================
// Facebook Page Scraper — Playwright-based
//
// Navigates to each competitor's Facebook page, extracts public metrics
// (followers, likes, rating, review count, last post date), and returns
// `NewFacebookPageMetrics`-shaped objects ready for DB upsert.
// =============================================================================
import { chromium } from 'playwright';
import { createLogger } from '../utils/logger.js';
import { sleep, sleepRandom, toErrorMessage, formatDuration, parseNumber, normaliseWhitespace, } from '../utils/helpers.js';
import { settings } from '../config/settings.js';
const log = createLogger('FacebookPageScraper');
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
/** Selectors — Facebook changes the DOM frequently; centralise here. */
const SEL = {
    /** Page name / header area */
    pageName: 'h1',
    /** Followers / likes section (multiple possible locations) */
    followersText: 'a[href*="/followers"] span, a[href*="/friends"] span',
    likesText: 'a[href*="/likes"] span',
    /** Rating section on the "Reviews" tab or main page */
    ratingSection: '[href*="/reviews"]',
    /** Individual posts on the page timeline */
    postContainer: 'div[data-ad-rendering-role="profile_timeline_story"]',
    /** Alternative post container */
    postContainerAlt: 'div[class*="x1yztbdb"]',
    /** Login prompt overlay */
    loginDialog: 'div[role="dialog"]',
    /** Close button for dialogs */
    dialogClose: 'div[aria-label="Close"], [aria-label="Close"]',
    /** "See more" info section on the About panel */
    aboutSection: 'div[data-pagelet="ProfileTilesFeed_0"]',
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
// Number parsing helpers (follower-specific)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Parse follower/like counts that may use shorthand notation.
 * Handles: "45K followers", "1.2M people like this", "12,345 followers",
 *          "45K คนติดตาม", "1.2 ล้าน likes", "1.2万"
 */
function parseFollowerCount(text) {
    if (!text)
        return null;
    const cleaned = normaliseWhitespace(text);
    // Thai shorthand: ล้าน = million, พัน = thousand, หมื่น = 10k, แสน = 100k
    const thaiMillionMatch = /([\d,.]+)\s*ล้าน/i.exec(cleaned);
    if (thaiMillionMatch?.[1]) {
        return parseFloat(thaiMillionMatch[1].replace(/,/g, '')) * 1_000_000;
    }
    const thaiThousandMatch = /([\d,.]+)\s*พัน/i.exec(cleaned);
    if (thaiThousandMatch?.[1]) {
        return parseFloat(thaiThousandMatch[1].replace(/,/g, '')) * 1_000;
    }
    // Standard K/M/B suffixes: "45K", "1.2M", "3B"
    const suffixMatch = /([\d,.]+)\s*([KkMmBb])\b/.exec(cleaned);
    if (suffixMatch?.[1] && suffixMatch[2]) {
        const num = parseFloat(suffixMatch[1].replace(/,/g, ''));
        const multipliers = {
            k: 1_000,
            m: 1_000_000,
            b: 1_000_000_000,
        };
        const mult = multipliers[suffixMatch[2].toLowerCase()] ?? 1;
        return Math.round(num * mult);
    }
    // Plain numbers with possible comma separators: "12,345", "1234"
    return parseNumber(cleaned);
}
/**
 * Parse a star rating from text like "4.5 out of 5", "4.5", "⭐ 4.5".
 */
function parseRating(text) {
    if (!text)
        return null;
    // "4.5 out of 5" / "4.5/5"
    const outOfMatch = /([\d.]+)\s*(?:out\s*of|\/)\s*5/i.exec(text);
    if (outOfMatch?.[1]) {
        const val = parseFloat(outOfMatch[1]);
        return val >= 0 && val <= 5 ? Math.round(val * 100) / 100 : null;
    }
    // Standalone number: "4.5"
    const numMatch = /([\d.]+)/.exec(text);
    if (numMatch?.[1]) {
        const val = parseFloat(numMatch[1]);
        return val >= 0 && val <= 5 ? Math.round(val * 100) / 100 : null;
    }
    return null;
}
/**
 * Parse a review count: "1,234 reviews", "Based on 56 reviews",
 * "56 รีวิว", "(123)".
 */
function parseReviewCount(text) {
    if (!text)
        return null;
    // "1,234 reviews" / "56 reviews" / "56 รีวิว"
    const match = /([\d,]+)\s*(?:reviews?|รีวิว|ratings?|opinions?)/i.exec(text);
    if (match?.[1]) {
        return parseInt(match[1].replace(/,/g, ''), 10);
    }
    // "Based on 56 reviews"
    const basedOnMatch = /based\s+on\s+([\d,]+)/i.exec(text);
    if (basedOnMatch?.[1]) {
        return parseInt(basedOnMatch[1].replace(/,/g, ''), 10);
    }
    // Parenthesised count: "(123)"
    const parenMatch = /\(([\d,]+)\)/.exec(text);
    if (parenMatch?.[1]) {
        return parseInt(parenMatch[1].replace(/,/g, ''), 10);
    }
    return null;
}
// ─────────────────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────────────────
export class FacebookPageScraper {
    browser = null;
    headless;
    timeoutMs;
    maxRetries;
    requestDelayMs;
    constructor() {
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
    // ─── Scrape all competitors ─────────────────────────────────────────────
    async scrapeAll(competitors) {
        if (!this.browser) {
            throw new Error('Browser not initialised — call init() first');
        }
        // Keep a dummy context open to prevent browser shutdown during idle/delay on Windows/Edge
        const keepAliveContext = await this.browser.newContext();
        await keepAliveContext.newPage();
        try {
            const results = new Map();
            log.info(`Starting page scrape for ${competitors.length} competitors`);
            for (let i = 0; i < competitors.length; i++) {
                const competitor = competitors[i];
                log.info(`[${i + 1}/${competitors.length}] Scraping page: ${competitor.name}...`);
                const result = await this.scrapePageSafe(competitor);
                results.set(competitor.id, result);
                if (result.success) {
                    const d = result.data;
                    log.info(`  \u2714 ${competitor.name}: ${d.followers ?? '?'} followers, ${d.pageLikes ?? '?'} likes, rating ${d.rating ?? 'N/A'} (${formatDuration(result.durationMs)})`);
                }
                else {
                    log.error(`  \u2716 ${competitor.name}: ${result.error} (${formatDuration(result.durationMs)})`);
                }
                // Random delay between competitors (20–45 s) unless it's the last one
                if (i < competitors.length - 1) {
                    const delaySecs = Math.floor(Math.random() * 26) + 20;
                    log.info(`  Waiting ${delaySecs}s before next competitor...`);
                    await sleep(delaySecs * 1_000);
                }
            }
            const successCount = [...results.values()].filter((r) => r.success).length;
            log.info(`Page scrape complete: ${successCount}/${competitors.length} succeeded`);
            return results;
        }
        finally {
            await keepAliveContext.close().catch(() => { });
        }
    }
    // ─── Scrape single page (public) ──────────────────────────────────────────
    async scrapePage(competitor) {
        if (!this.browser) {
            throw new Error('Browser not initialised — call init() first');
        }
        return this.scrapePageImpl(competitor);
    }
    // ─── Safe wrapper (catches + returns ScrapeResult) ────────────────────────
    async scrapePageSafe(competitor) {
        const start = Date.now();
        let retries = 0;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const data = await this.scrapePageImpl(competitor);
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
    async scrapePageImpl(competitor) {
        if (!this.browser)
            throw new Error('Browser not initialised');
        const context = await this.createContext();
        let page = null;
        try {
            page = await context.newPage();
            await this.setupPageStealth(page);
            const url = competitor.facebookPageUrl;
            log.debug(`  Navigating to: ${url}`);
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: this.timeoutMs,
            });
            // Wait for the page to settle
            await sleepRandom(3_000, 6_000);
            // Handle cookie consent / login dialogs
            await this.dismissDialogs(page);
            // Check if the page is accessible (not private / removed / login-walled)
            const isBlocked = await this.isPageBlocked(page);
            if (isBlocked) {
                log.warn(`  ${competitor.name}: page is blocked or requires login`);
                // Return partial data — we can still try to get whatever is visible
            }
            // ── Extract all metrics ──────────────────────────────────────────────
            const now = new Date();
            const followers = await this.extractFollowers(page);
            const pageLikes = await this.extractPageLikes(page);
            const { rating, reviewCount } = await this.extractRatingAndReviews(page);
            const lastPostDate = await this.extractLastPostDate(page);
            const postsLast30d = await this.countRecentPosts(page);
            // Calculate avg engagement rate from visible posts (if we can count them)
            const avgEngagementRate = await this.estimateEngagementRate(page, followers);
            return {
                competitorId: competitor.id,
                pageUrl: url,
                followers,
                pageLikes,
                rating,
                reviewCount,
                postsLast30d,
                avgEngagementRate,
                lastPostDate,
                scrapedAt: now,
            };
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
            javaScriptEnabled: true,
            ignoreHTTPSErrors: true,
        });
    }
    // ─── Stealth patches ──────────────────────────────────────────────────────
    async setupPageStealth(page) {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            window['chrome'] = { runtime: {} };
        });
    }
    // ─── Dialog dismissal ─────────────────────────────────────────────────────
    async dismissDialogs(page) {
        try {
            // Cookie consent
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
            const closeSelectors = [
                'div[role="dialog"] div[aria-label="Close"]',
                'div[role="dialog"] [aria-label="Close"]',
                'div[role="banner"] [aria-label="Close"]',
            ];
            for (const sel of closeSelectors) {
                const closeBtn = page.locator(sel).first();
                if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
                    await closeBtn.click();
                    log.debug('  Dismissed login/banner dialog');
                    await sleep(500);
                    break;
                }
            }
            // "Not Now" or "ไม่ใช่ตอนนี้" buttons that appear on login prompts
            const notNowSelectors = [
                'a:has-text("Not Now")',
                'button:has-text("Not Now")',
                'a:has-text("ไม่ใช่ตอนนี้")',
                'div[role="button"]:has-text("Not now")',
            ];
            for (const sel of notNowSelectors) {
                const btn = page.locator(sel).first();
                if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
                    await btn.click();
                    log.debug('  Dismissed "Not Now" prompt');
                    await sleep(500);
                    break;
                }
            }
        }
        catch {
            // Silently continue — dialogs are optional
        }
    }
    // ─── Login-wall / private page detection ──────────────────────────────────
    async isPageBlocked(page) {
        try {
            const bodyText = await page.locator('body').innerText().catch(() => '');
            const lower = bodyText.toLowerCase();
            // Page not found / removed
            if (lower.includes('page not found') ||
                lower.includes('this page isn\'t available') ||
                lower.includes('this content isn\'t available') ||
                lower.includes('ไม่พบหน้านี้')) {
                return true;
            }
            // Full login wall (entire page is just a login form)
            const hasLoginForm = (await page.locator('form[action*="login"]').count()) > 0;
            const hasTimeline = (await page.locator('[data-pagelet*="ProfileTimeline"]').count()) > 0 ||
                (await page.locator('[role="main"]').count()) > 0;
            // If there's a login form but no visible timeline content, we're blocked
            if (hasLoginForm && !hasTimeline) {
                return true;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    // ─── Metric extractors ────────────────────────────────────────────────────
    async extractFollowers(page) {
        try {
            // Method 1: Look for "X followers" link/text
            const followerPatterns = [
                // English: "45,678 followers", "1.2K followers"
                /([\d,.]+[KkMmBb]?)\s*(?:followers|people follow this)/i,
                // Thai: "45,678 คนติดตาม", "1.2K ผู้ติดตาม"
                /([\d,.]+[KkMmBb]?)\s*(?:คนติดตาม|ผู้ติดตาม)/i,
            ];
            // Try the specific followers link first
            const followerLinks = page.locator('a[href*="/followers"]');
            const linkCount = await followerLinks.count();
            for (let i = 0; i < linkCount; i++) {
                const text = await followerLinks.nth(i).innerText().catch(() => '');
                const count = parseFollowerCount(text);
                if (count !== null && count > 0)
                    return count;
            }
            // Try broader text search in the page header area
            const headerText = await page
                .locator('[data-pagelet="ProfileActions"], [data-pagelet="page_header"]')
                .first()
                .innerText()
                .catch(() => '');
            for (const pattern of followerPatterns) {
                const match = pattern.exec(headerText);
                if (match?.[1]) {
                    const count = parseFollowerCount(match[1]);
                    if (count !== null && count > 0)
                        return count;
                }
            }
            // Fallback: search entire visible page text
            const bodyText = await page
                .locator('[role="main"]')
                .first()
                .innerText()
                .catch(() => '');
            for (const pattern of followerPatterns) {
                const match = pattern.exec(bodyText);
                if (match?.[1]) {
                    const count = parseFollowerCount(match[1]);
                    if (count !== null && count > 0)
                        return count;
                }
            }
            return null;
        }
        catch (err) {
            log.debug(`  Failed to extract followers: ${toErrorMessage(err)}`);
            return null;
        }
    }
    async extractPageLikes(page) {
        try {
            const likePatterns = [
                // English: "45,678 likes", "1.2K people like this"
                /([\d,.]+[KkMmBb]?)\s*(?:likes?|people like this)/i,
                // Thai: "45,678 ถูกใจ", "1.2K คนถูกใจสิ่งนี้"
                /([\d,.]+[KkMmBb]?)\s*(?:ถูกใจ|คนถูกใจ)/i,
            ];
            // Try the specific likes link
            const likeLinks = page.locator('a[href*="/likes"]');
            const linkCount = await likeLinks.count();
            for (let i = 0; i < linkCount; i++) {
                const text = await likeLinks.nth(i).innerText().catch(() => '');
                const count = parseFollowerCount(text);
                if (count !== null && count > 0)
                    return count;
            }
            // Try broader text search
            const mainText = await page
                .locator('[role="main"]')
                .first()
                .innerText()
                .catch(() => '');
            for (const pattern of likePatterns) {
                const match = pattern.exec(mainText);
                if (match?.[1]) {
                    const count = parseFollowerCount(match[1]);
                    if (count !== null && count > 0)
                        return count;
                }
            }
            return null;
        }
        catch (err) {
            log.debug(`  Failed to extract page likes: ${toErrorMessage(err)}`);
            return null;
        }
    }
    async extractRatingAndReviews(page) {
        try {
            // Look for rating/reviews section — common patterns:
            // "4.5 (123 reviews)", "4.5 out of 5 · Based on 123 reviews"
            const reviewLink = page.locator('a[href*="/reviews"]').first();
            const reviewLinkVisible = await reviewLink
                .isVisible({ timeout: 2_000 })
                .catch(() => false);
            if (reviewLinkVisible) {
                const text = await reviewLink.innerText().catch(() => '');
                const rating = parseRating(text);
                const reviewCount = parseReviewCount(text);
                if (rating !== null || reviewCount !== null) {
                    return { rating, reviewCount };
                }
            }
            // Try broader search for rating patterns in the main content
            const mainText = await page
                .locator('[role="main"]')
                .first()
                .innerText()
                .catch(() => '');
            // Pattern: "4.5 out of 5 based on 123 reviews"
            const fullMatch = /([\d.]+)\s*(?:out\s*of\s*5|\/\s*5)?\s*(?:·|based\s*on|from)?\s*([\d,]+)?\s*(?:reviews?|ratings?|รีวิว)?/i.exec(mainText);
            if (fullMatch) {
                const rating = parseRating(fullMatch[0] ?? '');
                const reviewCount = fullMatch[2]
                    ? parseInt(fullMatch[2].replace(/,/g, ''), 10)
                    : null;
                return { rating, reviewCount };
            }
            return { rating: null, reviewCount: null };
        }
        catch (err) {
            log.debug(`  Failed to extract rating/reviews: ${toErrorMessage(err)}`);
            return { rating: null, reviewCount: null };
        }
    }
    async extractLastPostDate(page) {
        try {
            // Look for timestamps on the most recent posts
            // Facebook uses <abbr> or <span> with aria-label for timestamps
            const timestampSelectors = [
                'a[href*="/posts/"] abbr[data-utime]',
                'span[id*="jsc_"] a[role="link"][tabindex="0"]',
                'a[aria-label*="202"]', // Links with year in aria-label
                '[data-ad-rendering-role="profile_timeline_story"] a[href*="/posts/"]',
            ];
            for (const sel of timestampSelectors) {
                const elements = page.locator(sel);
                const count = await elements.count();
                if (count > 0) {
                    // Get the first (most recent) timestamp
                    const el = elements.first();
                    // Try data-utime attribute (Unix timestamp)
                    const utime = await el.getAttribute('data-utime').catch(() => null);
                    if (utime) {
                        const date = new Date(parseInt(utime, 10) * 1_000);
                        if (!isNaN(date.getTime()))
                            return date;
                    }
                    // Try aria-label (human-readable date)
                    const ariaLabel = await el.getAttribute('aria-label').catch(() => null);
                    if (ariaLabel) {
                        const date = this.parseRelativeOrAbsoluteDate(ariaLabel);
                        if (date)
                            return date;
                    }
                    // Try title attribute
                    const title = await el.getAttribute('title').catch(() => null);
                    if (title) {
                        const date = this.parseRelativeOrAbsoluteDate(title);
                        if (date)
                            return date;
                    }
                    // Try inner text
                    const text = await el.innerText().catch(() => '');
                    if (text) {
                        const date = this.parseRelativeOrAbsoluteDate(text);
                        if (date)
                            return date;
                    }
                }
            }
            return null;
        }
        catch (err) {
            log.debug(`  Failed to extract last post date: ${toErrorMessage(err)}`);
            return null;
        }
    }
    /**
     * Count visible posts on the page timeline. This gives an approximate
     * count of posts in the last 30 days (limited by what's loaded).
     */
    async countRecentPosts(page) {
        try {
            // Scroll a couple of times to load more posts
            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => {
                    window.scrollTo({
                        top: document.body.scrollHeight,
                        behavior: 'smooth',
                    });
                });
                await sleepRandom(2_000, 3_000);
            }
            // Count post containers
            const count1 = await page.locator(SEL.postContainer).count();
            const count2 = await page.locator(SEL.postContainerAlt).count();
            const count = Math.max(count1, count2);
            // Return null if we couldn't detect any posts (likely blocked)
            return count > 0 ? count : null;
        }
        catch (err) {
            log.debug(`  Failed to count posts: ${toErrorMessage(err)}`);
            return null;
        }
    }
    /**
     * Estimate average engagement rate from visible posts.
     * engagement rate = (reactions + comments + shares) / followers * 100
     *
     * This is a rough estimate based on the first few visible posts.
     */
    async estimateEngagementRate(page, followers) {
        if (!followers || followers === 0)
            return null;
        try {
            const postContainers = page.locator(SEL.postContainer);
            let count = await postContainers.count();
            if (count === 0) {
                const altContainers = page.locator(SEL.postContainerAlt);
                count = await altContainers.count();
                if (count === 0)
                    return null;
            }
            // Sample up to 5 posts
            const sampleSize = Math.min(count, 5);
            let totalEngagement = 0;
            let validPosts = 0;
            for (let i = 0; i < sampleSize; i++) {
                const post = postContainers.nth(i);
                const text = await post.innerText().catch(() => '');
                // Try to parse engagement numbers from the post
                const engagement = this.parseEngagementFromText(text);
                if (engagement > 0) {
                    totalEngagement += engagement;
                    validPosts++;
                }
            }
            if (validPosts === 0)
                return null;
            const avgEngagement = totalEngagement / validPosts;
            const rate = (avgEngagement / followers) * 100;
            // Return rounded to 4 decimal places
            return Math.round(rate * 10_000) / 10_000;
        }
        catch (err) {
            log.debug(`  Failed to estimate engagement rate: ${toErrorMessage(err)}`);
            return null;
        }
    }
    /**
     * Parse total engagement (reactions + comments + shares) from a post's text.
     */
    parseEngagementFromText(text) {
        let total = 0;
        // Reactions: "123", "1.2K", "45K"
        const reactionPatterns = [
            /([\d,.]+[KkMmBb]?)\s*(?:reactions?|likes?|ถูกใจ)/i,
            /(?:^|\n)([\d,.]+[KkMmBb]?)\s*$/m, // Standalone number at end of line
        ];
        for (const pattern of reactionPatterns) {
            const match = pattern.exec(text);
            if (match?.[1]) {
                const count = parseFollowerCount(match[1]);
                if (count !== null && count > 0) {
                    total += count;
                    break;
                }
            }
        }
        // Comments: "56 comments"
        const commentsMatch = /([\d,.]+[KkMmBb]?)\s*(?:comments?|ความคิดเห็น)/i.exec(text);
        if (commentsMatch?.[1]) {
            const count = parseFollowerCount(commentsMatch[1]);
            if (count !== null)
                total += count;
        }
        // Shares: "12 shares"
        const sharesMatch = /([\d,.]+[KkMmBb]?)\s*(?:shares?|แชร์|การแชร์)/i.exec(text);
        if (sharesMatch?.[1]) {
            const count = parseFollowerCount(sharesMatch[1]);
            if (count !== null)
                total += count;
        }
        return total;
    }
    // ─── Date parsing helpers ─────────────────────────────────────────────────
    /**
     * Parse a date string that could be relative ("2h", "Yesterday") or
     * absolute ("January 15, 2024", "15 Jan 2024").
     */
    parseRelativeOrAbsoluteDate(text) {
        if (!text)
            return null;
        const cleaned = normaliseWhitespace(text).toLowerCase();
        // Relative: "Xm", "Xh", "Xd" (minutes, hours, days ago)
        const relMinutes = /^(\d+)\s*m(?:in(?:ute)?s?)?\s*(?:ago)?$/i.exec(cleaned);
        if (relMinutes?.[1]) {
            const d = new Date();
            d.setMinutes(d.getMinutes() - parseInt(relMinutes[1], 10));
            return d;
        }
        const relHours = /^(\d+)\s*h(?:ours?)?\s*(?:ago)?$/i.exec(cleaned);
        if (relHours?.[1]) {
            const d = new Date();
            d.setHours(d.getHours() - parseInt(relHours[1], 10));
            return d;
        }
        const relDays = /^(\d+)\s*d(?:ays?)?\s*(?:ago)?$/i.exec(cleaned);
        if (relDays?.[1]) {
            const d = new Date();
            d.setDate(d.getDate() - parseInt(relDays[1], 10));
            return d;
        }
        // "yesterday"
        if (cleaned.includes('yesterday') || cleaned.includes('เมื่อวาน')) {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            d.setHours(12, 0, 0, 0);
            return d;
        }
        // "just now" / "เมื่อสักครู่"
        if (cleaned.includes('just now') || cleaned.includes('เมื่อสักครู่')) {
            return new Date();
        }
        // Absolute dates — try native Date parsing
        const d = new Date(text);
        if (!isNaN(d.getTime()))
            return d;
        // "DD MMM YYYY" or "MMM DD, YYYY" patterns
        const dateMatch = /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})/i.exec(text);
        if (dateMatch) {
            const parsed = new Date(`${dateMatch[2]} ${dateMatch[1]}, ${dateMatch[3]}`);
            if (!isNaN(parsed.getTime()))
                return parsed;
        }
        return null;
    }
}
//# sourceMappingURL=facebookPage.js.map