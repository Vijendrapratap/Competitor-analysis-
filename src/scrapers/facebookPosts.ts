// =============================================================================
// Facebook Posts Scraper — Playwright-based
//
// ⚠️  DEPRECATED (2026-03) — replaced by Apify-based facebookPostsScraper.ts
// This file is kept for reference only. The ScrapeService no longer imports it.
// See: src/scrapers/facebookPostsScraper.ts for the current implementation.
//
// Navigates to each competitor's Facebook page, scrolls to load posts from the
// last ~30 days, extracts engagement metrics, categorises content, detects
// language, and flags top performers. Returns `NewFacebookPost[]` for DB upsert.
// =============================================================================

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

import { createLogger } from '../utils/logger.js';
import {
  sleep,
  sleepRandom,
  toErrorMessage,
  formatDuration,
  normaliseWhitespace,
  truncate,
} from '../utils/helpers.js';
import { settings } from '../config/settings.js';
import {
  PostType,
  ContentCategory,
} from '../types/index.js';
import type {
  Competitor,
  NewFacebookPost,
  ScrapeResult,
} from '../types/index.js';

const log = createLogger('FacebookPostsScraper');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Selectors — Facebook changes the DOM frequently; centralise here. */
const SEL = {
  /** Individual post wrapper in the timeline */
  postWrapper: 'div[data-ad-rendering-role="profile_timeline_story"]',
  /** Alternative post container (fallback) */
  postWrapperAlt: 'div[class*="x1yztbdb"][class*="x1n2onr6"]',
  /** Post text content area */
  postText: 'div[data-ad-comet-preview="message"]',
  /** Post text alt (different layout) */
  postTextAlt: 'div[dir="auto"][style*="text-align"]',
  /** Timestamp links */
  timestampLink: 'a[href*="/posts/"], a[href*="/photos/"], a[href*="/videos/"], a[href*="/reel/"]',
  /** Reactions count */
  reactionsCount: 'span[aria-label*="reaction"], span[aria-label*="like"]',
  /** Video view count */
  videoViews: 'span:has-text("views"), span:has-text("การดู")',
  /** Loading spinner */
  loadingSpinner: 'div[role="progressbar"]',
} as const;

/** Realistic desktop user-agents (rotated per context). */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
];

// ─────────────────────────────────────────────────────────────────────────────
// Content categorisation — keyword lists for hotel-related categories
// ─────────────────────────────────────────────────────────────────────────────

/** English + Thai keyword sets for each content category. */
const CATEGORY_KEYWORDS: Array<{
  category: ContentCategory;
  keywords: RegExp;
}> = [
    {
      // Room / Accommodation
      category: ContentCategory.Product,
      keywords:
        /\b(?:room|suite|villa|pool\s*villa|bungalow|penthouse|accommodation|bedroom|bed\s*type|sea\s*view|ocean\s*view|balcony|ห้อง|ห้องพัก|วิลล่า|สวีท|พูลวิลล่า)\b/i,
    },
    {
      // F&B / Dining
      category: ContentCategory.Brand,
      keywords:
        /\b(?:restaurant|dining|breakfast|brunch|dinner|lunch|menu|chef|cuisine|cocktail|bar|wine|buffet|food|gastronomy|อาหาร|ร้านอาหาร|บุฟเฟ่ต์|ค็อกเทล|เมนู|อาหารเช้า)\b/i,
    },
    {
      // Wedding
      category: ContentCategory.Event,
      keywords:
        /\b(?:wedding|bride|groom|ceremony|reception|honeymoon|nuptials|married|engagement|งานแต่ง|แต่งงาน|เจ้าสาว|ฮันนีมูน|พิธี)\b/i,
    },
    {
      // Family
      category: ContentCategory.Educational,
      keywords:
        /\b(?:family|kids|children|child|playground|kid-friendly|family-friendly|ครอบครัว|เด็ก|สนามเด็กเล่น|กิจกรรมครอบครัว)\b/i,
    },
    {
      // Wellness / Spa
      category: ContentCategory.Testimonial,
      keywords:
        /\b(?:spa|wellness|massage|yoga|meditation|retreat|relaxation|therapy|healing|detox|สปา|นวด|โยคะ|สุขภาพ|ผ่อนคลาย|รีทรีท)\b/i,
    },
    {
      // Events / MICE
      category: ContentCategory.Event,
      keywords:
        /\b(?:conference|meeting|event|seminar|workshop|corporate|team\s*building|incentive|banquet|convention|ประชุม|สัมมนา|อีเวนท์)\b/i,
    },
    {
      // Behind the Scenes
      category: ContentCategory.UserGenerated,
      keywords:
        /\b(?:behind\s*the\s*scenes|bts|team|staff|our\s*people|meet\s*our|เบื้องหลัง|ทีมงาน|พนักงาน)\b/i,
    },
    {
      // Promotion / Offer
      category: ContentCategory.Promotion,
      keywords:
        /\b(?:promo(?:tion)?|offer|deal|discount|sale|save|free|complimentary|package|special\s*rate|early\s*bird|flash\s*sale|โปรโมชั่น|ส่วนลด|ราคาพิเศษ|ฟรี|แพ็คเกจ|ลดราคา)\b/i,
    },
    {
      // Seasonal / Holiday
      category: ContentCategory.Seasonal,
      keywords:
        /\b(?:christmas|new\s*year|songkran|loy\s*krathong|chinese\s*new\s*year|valentine|halloween|easter|summer|winter|festive|holiday|season|คริสต์มาส|ปีใหม่|สงกรานต์|ลอยกระทง|ตรุษจีน|วาเลนไทน์)\b/i,
    },
  ];

// ─────────────────────────────────────────────────────────────────────────────
// Follower-count parser (reused for reaction/share/comment counts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse engagement numbers that may use shorthand: "1.2K", "45", "1,234".
 */
function parseEngagementNumber(text: string): number {
  if (!text) return 0;

  const cleaned = normaliseWhitespace(text);

  // K/M/B suffixes
  const suffixMatch = /([\d,.]+)\s*([KkMmBb])\b/.exec(cleaned);
  if (suffixMatch?.[1] && suffixMatch[2]) {
    const num = parseFloat(suffixMatch[1].replace(/,/g, ''));
    const multipliers: Record<string, number> = {
      k: 1_000,
      m: 1_000_000,
      b: 1_000_000_000,
    };
    return Math.round(
      num * (multipliers[suffixMatch[2].toLowerCase()] ?? 1),
    );
  }

  // Thai shorthand
  const thaiMillionMatch = /([\d,.]+)\s*ล้าน/i.exec(cleaned);
  if (thaiMillionMatch?.[1]) {
    return Math.round(parseFloat(thaiMillionMatch[1].replace(/,/g, '')) * 1_000_000);
  }

  const thaiThousandMatch = /([\d,.]+)\s*พัน/i.exec(cleaned);
  if (thaiThousandMatch?.[1]) {
    return Math.round(parseFloat(thaiThousandMatch[1].replace(/,/g, '')) * 1_000);
  }

  // Plain number
  const numMatch = /([\d,]+)/.exec(cleaned);
  if (numMatch?.[1]) {
    const parsed = parseInt(numMatch[1].replace(/,/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────────────────

export class FacebookPostsScraper {
  private browser: Browser | null = null;
  private readonly headless: boolean;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly requestDelayMs: number;

  constructor() {
    this.headless = settings.scraper.headless;
    this.timeoutMs = settings.scraper.timeoutMs;
    this.maxRetries = settings.scraper.maxRetries;
    this.requestDelayMs = settings.scraper.requestDelayMs;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    log.info('Launching Chromium browser...');

    const launchOpts: Parameters<typeof chromium.launch>[0] = {
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

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      log.info('Browser closed');
    }
  }

  // ─── Scrape all competitors ─────────────────────────────────────────────

  async scrapeAll(
    competitors: Competitor[],
    days = 30,
  ): Promise<Map<number, ScrapeResult<NewFacebookPost[]>>> {
    if (!this.browser) {
      throw new Error('Browser not initialised — call init() first');
    }

    const results = new Map<number, ScrapeResult<NewFacebookPost[]>>();
    log.info(
      `Starting posts scrape for ${competitors.length} competitors (last ${days} days)`,
    );

    for (let i = 0; i < competitors.length; i++) {
      const competitor = competitors[i]!;
      log.info(
        `[${i + 1}/${competitors.length}] Scraping posts: ${competitor.name}...`,
      );

      const result = await this.scrapePostsSafe(competitor, days);
      results.set(competitor.id, result);

      if (result.success) {
        const posts = result.data!;
        const topCount = posts.filter((p) => p.isTopPerformer).length;
        log.info(
          `  \u2714 ${competitor.name}: ${posts.length} posts (${topCount} top performers) in ${formatDuration(result.durationMs)}`,
        );
      } else {
        log.error(
          `  \u2716 ${competitor.name}: ${result.error} (${formatDuration(result.durationMs)})`,
        );
      }

      // Random delay between competitors (25–50 s) unless it's the last one
      if (i < competitors.length - 1) {
        const delaySecs = Math.floor(Math.random() * 26) + 25;
        log.info(`  Waiting ${delaySecs}s before next competitor...`);
        await sleep(delaySecs * 1_000);
      }
    }

    const successCount = [...results.values()].filter((r) => r.success).length;
    const totalPosts = [...results.values()].reduce(
      (sum, r) => sum + (r.data?.length ?? 0),
      0,
    );
    log.info(
      `Posts scrape complete: ${successCount}/${competitors.length} succeeded, ${totalPosts} total posts`,
    );

    return results;
  }

  // ─── Scrape single competitor posts (public) ──────────────────────────────

  async scrapePosts(
    competitor: Competitor,
    days = 30,
  ): Promise<NewFacebookPost[]> {
    if (!this.browser) {
      throw new Error('Browser not initialised — call init() first');
    }
    return this.scrapePostsImpl(competitor, days);
  }

  // ─── Safe wrapper (catches + returns ScrapeResult) ────────────────────────

  private async scrapePostsSafe(
    competitor: Competitor,
    days: number,
  ): Promise<ScrapeResult<NewFacebookPost[]>> {
    const start = Date.now();
    let retries = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const data = await this.scrapePostsImpl(competitor, days);
        return {
          success: true,
          data,
          error: null,
          durationMs: Date.now() - start,
          retries,
        };
      } catch (err) {
        retries++;
        const msg = toErrorMessage(err);

        if (attempt < this.maxRetries) {
          const backoff = 5_000 * 2 ** attempt;
          log.warn(
            `  Attempt ${attempt + 1}/${this.maxRetries + 1} failed for ${competitor.name}: ${msg}. Retrying in ${backoff / 1_000}s`,
          );
          await sleep(backoff);
        } else {
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

  private async scrapePostsImpl(
    competitor: Competitor,
    days: number,
  ): Promise<NewFacebookPost[]> {
    if (!this.browser) throw new Error('Browser not initialised');

    const context = await this.createContext();
    let page: Page | null = null;

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

      // Check if the page is accessible
      const isBlocked = await this.isPageBlocked(page);
      if (isBlocked) {
        log.warn(`  ${competitor.name}: page is blocked or requires login`);
        return [];
      }

      // Scroll to load posts from the last N days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      await this.scrollToLoadPosts(page, cutoffDate);

      // Extract all visible posts
      const rawPosts = await this.extractAllPosts(page, competitor, cutoffDate);

      // Calculate engagement scores and flag top performers
      const scoredPosts = this.scoreAndFlagTopPerformers(rawPosts);

      return scoredPosts;
    } finally {
      if (page) await page.close().catch(() => { });
      await context.close().catch(() => { });
    }
  }

  // ─── Browser context factory ──────────────────────────────────────────────

  private async createContext(): Promise<BrowserContext> {
    if (!this.browser) throw new Error('Browser not initialised');

    const userAgent =
      USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;

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

  private async setupPageStealth(page: Page): Promise<void> {
    await page.addInitScript(() => {
      Object.defineProperty(navigator as any, 'webdriver', {
        get: () => undefined,
      });

      Object.defineProperty(navigator as any, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      (window as any)['chrome'] = { runtime: {} };
    });
  }

  // ─── Dialog dismissal ─────────────────────────────────────────────────────

  private async dismissDialogs(page: Page): Promise<void> {
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
          } else {
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

      // "Not Now" buttons
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
    } catch {
      // Silently continue — dialogs are optional
    }
  }

  // ─── Login-wall / private page detection ──────────────────────────────────

  private async isPageBlocked(page: Page): Promise<boolean> {
    try {
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const lower = bodyText.toLowerCase();

      if (
        lower.includes('page not found') ||
        lower.includes('this page isn\'t available') ||
        lower.includes('this content isn\'t available') ||
        lower.includes('ไม่พบหน้านี้')
      ) {
        return true;
      }

      const hasLoginForm =
        (await page.locator('form[action*="login"]').count()) > 0;
      const hasTimeline =
        (await page.locator('[data-pagelet*="ProfileTimeline"]').count()) > 0 ||
        (await page.locator('[role="main"]').count()) > 0;

      if (hasLoginForm && !hasTimeline) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // ─── Scroll to load posts within date range ───────────────────────────────

  private async scrollToLoadPosts(
    page: Page,
    cutoffDate: Date,
  ): Promise<void> {
    let stableRounds = 0;
    let previousCount = 0;
    const maxStableRounds = 4;
    const maxScrollRounds = 40; // Safety limit

    for (let round = 0; round < maxScrollRounds; round++) {
      // Count current posts
      const count1 = await page.locator(SEL.postWrapper).count().catch(() => 0);
      const count2 = await page
        .locator(SEL.postWrapperAlt)
        .count()
        .catch(() => 0);
      const currentCount = Math.max(count1, count2);

      // Check stability
      if (currentCount === previousCount && currentCount > 0) {
        stableRounds++;
        if (stableRounds >= maxStableRounds) {
          log.debug(
            `  No new posts after ${maxStableRounds} scrolls (total: ${currentCount})`,
          );
          break;
        }
      } else {
        stableRounds = 0;
      }
      previousCount = currentCount;

      // Check if the oldest visible post is already beyond our cutoff
      if (currentCount > 0) {
        const reachedCutoff = await this.hasReachedDateCutoff(page, cutoffDate);
        if (reachedCutoff) {
          log.debug(
            `  Reached date cutoff (${cutoffDate.toISOString().slice(0, 10)}) after ${currentCount} posts`,
          );
          break;
        }
      }

      // Scroll down
      await page.evaluate(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth',
        });
      });

      // Wait for content to load
      await sleepRandom(2_500, 4_500);

      // Dismiss any dialogs that may pop up during scrolling
      if (round % 5 === 4) {
        await this.dismissDialogs(page);
      }

      // Wait for loading spinners to disappear
      try {
        await page
          .locator(SEL.loadingSpinner)
          .first()
          .waitFor({ state: 'hidden', timeout: 5_000 });
      } catch {
        // Spinner not found or already gone
      }
    }
  }

  /**
   * Check if the last visible post's date is older than the cutoff.
   */
  private async hasReachedDateCutoff(
    page: Page,
    cutoffDate: Date,
  ): Promise<boolean> {
    try {
      // Get all timestamp links
      const timestamps = page.locator(SEL.timestampLink);
      const count = await timestamps.count();
      if (count === 0) return false;

      // Check the last timestamp
      const lastTimestamp = timestamps.nth(count - 1);
      const ariaLabel =
        (await lastTimestamp.getAttribute('aria-label').catch(() => null)) ?? '';
      const title =
        (await lastTimestamp.getAttribute('title').catch(() => null)) ?? '';
      const text = await lastTimestamp.innerText().catch(() => '');

      const dateStr = ariaLabel || title || text;
      const postDate = this.parseRelativeOrAbsoluteDate(dateStr);

      if (postDate && postDate < cutoffDate) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // ─── Extract all posts from loaded page ───────────────────────────────────

  private async extractAllPosts(
    page: Page,
    competitor: Competitor,
    cutoffDate: Date,
  ): Promise<NewFacebookPost[]> {
    const posts: NewFacebookPost[] = [];
    const now = new Date();
    const seenPostIds = new Set<string>();

    // Try primary selector, then fallback
    let postLocator = page.locator(SEL.postWrapper);
    let postCount = await postLocator.count();

    if (postCount === 0) {
      postLocator = page.locator(SEL.postWrapperAlt);
      postCount = await postLocator.count();
    }

    log.debug(`  Extracting data from ${postCount} posts...`);

    for (let i = 0; i < postCount; i++) {
      try {
        const postEl = postLocator.nth(i);

        // Small delay between post extractions
        if (i > 0 && i % 10 === 0) {
          await sleepRandom(500, 1_500);
        }

        const post = await this.extractSinglePost(
          page,
          postEl,
          competitor,
          i,
          now,
        );

        if (!post) continue;

        // Skip if post is older than cutoff
        if (post.postedAt && post.postedAt < cutoffDate) {
          log.debug(
            `  Skipping post from ${post.postedAt.toISOString().slice(0, 10)} (before cutoff)`,
          );
          continue;
        }

        // De-duplicate by postId
        if (seenPostIds.has(post.postId)) continue;
        seenPostIds.add(post.postId);

        posts.push(post);
      } catch (err) {
        log.warn(
          `  Failed to extract post #${i + 1} for ${competitor.name}: ${toErrorMessage(err)}`,
        );
      }
    }

    return posts;
  }

  // ─── Extract a single post ────────────────────────────────────────────────

  private async extractSinglePost(
    _page: Page,
    postEl: ReturnType<Page['locator']>,
    competitor: Competitor,
    index: number,
    now: Date,
  ): Promise<NewFacebookPost | null> {
    const fullText = await postEl.innerText().catch(() => '');
    if (!fullText.trim()) return null;

    // ── Post ID & URL ───────────────────────────────────────────────────────
    const { postId, postUrl } = await this.extractPostIdAndUrl(
      postEl,
      competitor,
      index,
    );

    // ── Timestamp ────────────────────────────────────────────────────────────
    const postedAt = await this.extractPostDate(postEl);

    // ── Post type ────────────────────────────────────────────────────────────
    const postType = await this.detectPostType(postEl, postUrl);

    // ── Post text ────────────────────────────────────────────────────────────
    const postText = await this.extractPostText(postEl);

    // ── Reactions ─────────────────────────────────────────────────────────────
    const reactions = await this.extractReactions(postEl, fullText);

    // ── Comments count ───────────────────────────────────────────────────────
    const comments = this.extractComments(fullText);

    // ── Shares count ─────────────────────────────────────────────────────────
    const shares = this.extractShares(fullText);

    // ── Video views (only for video/reel/live posts) ─────────────────────────
    const videoViews = await this.extractVideoViews(postEl, fullText, postType);

    // ── Content category ─────────────────────────────────────────────────────
    const combinedText = [postText, fullText].filter(Boolean).join(' ');
    const contentCategory = this.categoriseContent(combinedText);

    // ── Language detection ────────────────────────────────────────────────────
    const language = this.detectLanguage(postText ?? fullText);

    return {
      competitorId: competitor.id,
      postId,
      postUrl,
      postType,
      postText: postText ? truncate(postText, 5_000) : null,
      postedAt,
      reactions,
      comments,
      shares,
      videoViews,
      contentCategory,
      language,
      isTopPerformer: false, // Will be set by scoreAndFlagTopPerformers()
      scrapedAt: now,
      // ── NEW FIELDS (002_schema_enhancements) ────────────────────────────
      likes: null,
      viewsCount: null,
      reactionLikeCount: null,
      reactionLoveCount: null,
      reactionWowCount: null,
      reactionHahaCount: null,
      reactionCareCount: null,
      mediaType: null,
      thumbnailUrl: null,
      engagementScore: null,
    };
  }

  // ─── Field extractors ─────────────────────────────────────────────────────

  private async extractPostIdAndUrl(
    postEl: ReturnType<Page['locator']>,
    competitor: Competitor,
    index: number,
  ): Promise<{ postId: string; postUrl: string }> {
    try {
      // Look for links that contain post/photo/video/reel IDs
      const links = postEl.locator(
        'a[href*="/posts/"], a[href*="/photos/"], a[href*="/videos/"], a[href*="/reel/"], a[href*="story_fbid"]',
      );
      const linkCount = await links.count();

      for (let i = 0; i < linkCount; i++) {
        const href = await links.nth(i).getAttribute('href').catch(() => null);
        if (!href) continue;

        // Extract post ID from URL patterns
        const postIdMatch =
          /\/posts\/(\w+)|\/photos\/[^/]+\/(\d+)|\/videos\/(\d+)|\/reel\/(\d+)|story_fbid=(\d+)/i.exec(
            href,
          );

        if (postIdMatch) {
          const id =
            postIdMatch[1] ??
            postIdMatch[2] ??
            postIdMatch[3] ??
            postIdMatch[4] ??
            postIdMatch[5]!;

          // Build a clean URL
          const cleanUrl = href.startsWith('http')
            ? href.split('?')[0]!
            : `https://www.facebook.com${href.split('?')[0]}`;

          return { postId: id, postUrl: cleanUrl };
        }
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback: generate a deterministic pseudo-ID
    const fallbackId = `${competitor.facebookPageId}_post_${Date.now()}_${index}`;
    return {
      postId: fallbackId,
      postUrl: competitor.facebookPageUrl,
    };
  }

  private async extractPostDate(
    postEl: ReturnType<Page['locator']>,
  ): Promise<Date | null> {
    try {
      // Look for timestamp elements within the post
      const timestampSelectors = [
        'a[href*="/posts/"]',
        'a[href*="/photos/"]',
        'a[href*="/videos/"]',
        'a[href*="/reel/"]',
        'abbr[data-utime]',
        'span[id*="jsc_"]',
      ];

      for (const sel of timestampSelectors) {
        const elements = postEl.locator(sel);
        const count = await elements.count();

        for (let i = 0; i < count; i++) {
          const el = elements.nth(i);

          // data-utime (Unix timestamp)
          const utime = await el.getAttribute('data-utime').catch(() => null);
          if (utime) {
            const date = new Date(parseInt(utime, 10) * 1_000);
            if (!isNaN(date.getTime())) return date;
          }

          // aria-label
          const ariaLabel = await el
            .getAttribute('aria-label')
            .catch(() => null);
          if (ariaLabel) {
            const date = this.parseRelativeOrAbsoluteDate(ariaLabel);
            if (date) return date;
          }

          // title attribute (Facebook sometimes puts dates here)
          const title = await el.getAttribute('title').catch(() => null);
          if (title) {
            const date = this.parseRelativeOrAbsoluteDate(title);
            if (date) return date;
          }
        }
      }

      // Last resort: look for date-like text in the post
      const fullText = await postEl.innerText().catch(() => '');
      const datePatterns = [
        /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*(?:\s+\d{4})?)/i,
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:,?\s+\d{4})?)/i,
        /(\d{1,2}h|just now|yesterday|\d+\s*min)/i,
      ];

      for (const pattern of datePatterns) {
        const match = pattern.exec(fullText);
        if (match?.[1]) {
          const date = this.parseRelativeOrAbsoluteDate(match[1]);
          if (date) return date;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private async detectPostType(
    postEl: ReturnType<Page['locator']>,
    postUrl: string,
  ): Promise<PostType> {
    try {
      // Check URL first
      if (postUrl.includes('/reel/')) return PostType.Reel;
      if (postUrl.includes('/videos/')) return PostType.Video;
      if (postUrl.includes('/photos/')) return PostType.Photo;
      if (postUrl.includes('/events/')) return PostType.Event;

      // Check for video elements
      const hasVideo =
        (await postEl.locator('video').count()) > 0 ||
        (await postEl.locator('[aria-label*="video" i]').count()) > 0;
      if (hasVideo) return PostType.Video;

      // Check for "Live" indicator
      const fullText = await postEl.innerText().catch(() => '');
      if (/\bwas\s+live\b/i.test(fullText) || /\bLIVE\b/.test(fullText)) {
        return PostType.LiveVideo;
      }

      // Check for linked content
      const hasExternalLink =
        (await postEl.locator('a[href*="l.facebook.com"]').count()) > 0;
      if (hasExternalLink) return PostType.Link;

      // Check for images
      const hasImage =
        (await postEl.locator('img[src*="scontent"]').count()) > 0 ||
        (await postEl.locator('img[src*="fbcdn"]').count()) > 0;
      if (hasImage) return PostType.Photo;

      // Text-only post
      const postText = await postEl
        .locator(SEL.postText)
        .first()
        .innerText()
        .catch(() => '');
      if (postText.trim().length > 0) return PostType.Text;

      return PostType.Unknown;
    } catch {
      return PostType.Unknown;
    }
  }

  private async extractPostText(
    postEl: ReturnType<Page['locator']>,
  ): Promise<string | null> {
    try {
      // Try primary selector
      const textEl = postEl.locator(SEL.postText).first();
      if (await textEl.isVisible({ timeout: 500 }).catch(() => false)) {
        const text = await textEl.innerText();
        return normaliseWhitespace(text) || null;
      }

      // Try alternate selector
      const altEl = postEl.locator(SEL.postTextAlt).first();
      if (await altEl.isVisible({ timeout: 500 }).catch(() => false)) {
        const text = await altEl.innerText();
        return normaliseWhitespace(text) || null;
      }

      // Try any div with dir="auto" (common text container)
      const autoDir = postEl.locator('div[dir="auto"]');
      const count = await autoDir.count();

      for (let i = 0; i < Math.min(count, 3); i++) {
        const text = await autoDir.nth(i).innerText().catch(() => '');
        const cleaned = normaliseWhitespace(text);
        // Skip very short text (likely UI elements) and very long text (likely full post dump)
        if (cleaned.length > 20 && cleaned.length < 5_000) {
          return cleaned;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private async extractReactions(
    postEl: ReturnType<Page['locator']>,
    fullText: string,
  ): Promise<number> {
    try {
      // Method 1: aria-label on reactions count
      // e.g., "123 people reacted to this" or "1.2K"
      const reactionEl = postEl.locator(SEL.reactionsCount).first();
      if (await reactionEl.isVisible({ timeout: 500 }).catch(() => false)) {
        const ariaLabel =
          (await reactionEl.getAttribute('aria-label').catch(() => null)) ?? '';
        const text = await reactionEl.innerText().catch(() => '');
        const count = parseEngagementNumber(ariaLabel || text);
        if (count > 0) return count;
      }

      // Method 2: Look for reaction count patterns in text
      const patterns = [
        /([\d,.]+[KkMmBb]?)\s*(?:reactions?|people\s+reacted)/i,
        /([\d,.]+[KkMmBb]?)\s*(?:ถูกใจ|คนแสดงความรู้สึก)/i,
      ];

      for (const pattern of patterns) {
        const match = pattern.exec(fullText);
        if (match?.[1]) {
          return parseEngagementNumber(match[1]);
        }
      }

      // Method 3: Just a standalone number near reaction icons
      // This is very imprecise but better than nothing
      const countMatch = /^([\d,.]+[KkMmBb]?)$/m.exec(fullText);
      if (countMatch?.[1]) {
        return parseEngagementNumber(countMatch[1]);
      }

      return 0;
    } catch {
      return 0;
    }
  }

  private extractComments(fullText: string): number {
    // "56 comments", "1.2K comments", "56 ความคิดเห็น"
    const patterns = [
      /([\d,.]+[KkMmBb]?)\s*(?:comments?|ความคิดเห็น)/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(fullText);
      if (match?.[1]) {
        return parseEngagementNumber(match[1]);
      }
    }

    return 0;
  }

  private extractShares(fullText: string): number {
    // "12 shares", "1.2K shares", "12 แชร์", "12 การแชร์"
    const patterns = [
      /([\d,.]+[KkMmBb]?)\s*(?:shares?|แชร์|การแชร์)/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(fullText);
      if (match?.[1]) {
        return parseEngagementNumber(match[1]);
      }
    }

    return 0;
  }

  private async extractVideoViews(
    postEl: ReturnType<Page['locator']>,
    fullText: string,
    postType: PostType,
  ): Promise<number | null> {
    // Only applicable for video-type posts
    if (
      postType !== PostType.Video &&
      postType !== PostType.Reel &&
      postType !== PostType.LiveVideo
    ) {
      return null;
    }

    try {
      // "1.2K views", "45,678 views", "การดู 1.2K ครั้ง"
      const patterns = [
        /([\d,.]+[KkMmBb]?)\s*(?:views?|การดู|ครั้ง)/i,
        /(?:views?|การดู)\s*([\d,.]+[KkMmBb]?)/i,
      ];

      for (const pattern of patterns) {
        const match = pattern.exec(fullText);
        if (match?.[1]) {
          const views = parseEngagementNumber(match[1]);
          if (views > 0) return views;
        }
      }

      // Try looking for a views element
      const viewEl = postEl.locator(SEL.videoViews).first();
      if (await viewEl.isVisible({ timeout: 500 }).catch(() => false)) {
        const text = await viewEl.innerText().catch(() => '');
        const views = parseEngagementNumber(text);
        if (views > 0) return views;
      }

      return null;
    } catch {
      return null;
    }
  }

  // ─── Content categorisation ───────────────────────────────────────────────

  /**
   * Categorise post content based on keyword matching.
   * Uses a priority-ordered list; first match wins.
   */
  private categoriseContent(text: string): ContentCategory {
    if (!text || text.trim().length === 0) return ContentCategory.Unknown;

    for (const { category, keywords } of CATEGORY_KEYWORDS) {
      if (keywords.test(text)) {
        return category;
      }
    }

    return ContentCategory.Unknown;
  }

  // ─── Language detection ───────────────────────────────────────────────────

  /**
   * Detect language: 'en', 'th', or 'bilingual'.
   * Uses Thai Unicode character ratio as a heuristic.
   */
  private detectLanguage(text: string): string | null {
    if (!text) return null;

    const cleanText = text.replace(/\s/g, '');
    if (cleanText.length === 0) return null;

    // Count Thai characters (Unicode range \u0E00–\u0E7F)
    const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) ?? []).length;
    const totalChars = cleanText.length;
    const thaiRatio = thaiChars / totalChars;

    if (thaiRatio > 0.6) return 'th';
    if (thaiRatio < 0.1) return 'en';
    return 'bilingual';
  }

  // ─── Scoring & top performer flagging ─────────────────────────────────────

  /**
   * Calculate engagement score for each post and flag the top 10%
   * as `isTopPerformer`.
   *
   * engagementScore = reactions + (comments * 2) + (shares * 3)
   */
  private scoreAndFlagTopPerformers(
    posts: NewFacebookPost[],
  ): NewFacebookPost[] {
    if (posts.length === 0) return posts;

    // Calculate engagement scores
    const scored = posts.map((post) => ({
      post,
      score:
        post.reactions +
        post.comments * 2 +
        post.shares * 3,
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Flag top 10% (minimum 1 post)
    const topCount = Math.max(1, Math.ceil(scored.length * 0.1));

    return scored.map(({ post, score }, index) => ({
      ...post,
      isTopPerformer: index < topCount && score > 0,
    }));
  }

  // ─── Date parsing helpers ─────────────────────────────────────────────────

  /**
   * Parse a date string that could be relative ("2h", "Yesterday") or
   * absolute ("January 15, 2024", "15 Jan 2024").
   */
  private parseRelativeOrAbsoluteDate(text: string): Date | null {
    if (!text) return null;
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

    // "X weeks ago"
    const relWeeks = /^(\d+)\s*w(?:eeks?)?\s*(?:ago)?$/i.exec(cleaned);
    if (relWeeks?.[1]) {
      const d = new Date();
      d.setDate(d.getDate() - parseInt(relWeeks[1], 10) * 7);
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
    if (!isNaN(d.getTime())) return d;

    // "DD MMM YYYY" or "MMM DD, YYYY" patterns
    const dateMatch =
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})/i.exec(
        text,
      );
    if (dateMatch) {
      const parsed = new Date(`${dateMatch[2]} ${dateMatch[1]}, ${dateMatch[3]}`);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    // Month-first: "January 15" (current year implied)
    const monthFirst =
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})/i.exec(
        text,
      );
    if (monthFirst) {
      const year = new Date().getFullYear();
      const parsed = new Date(`${monthFirst[1]} ${monthFirst[2]}, ${year}`);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    return null;
  }
}
