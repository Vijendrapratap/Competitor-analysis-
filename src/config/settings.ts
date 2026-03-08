// =============================================================================
// Settings — loads and validates environment variables with Zod
// =============================================================================

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from project root (two levels up from src/config/)
const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../.env') });

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const envSchema = z.object({
  // ── Runtime ────────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('production'),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .default('info'),

  // ── PostgreSQL ─────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default('competitor_intel'),
  DB_USER: z.string().default('competitor_user'),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),

  // ── Email ──────────────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1).default('Competitor Intel <intel@example.com>'),
  EMAIL_RECIPIENTS: z
    .string()
    .transform((v) => v.split(',').map((e) => e.trim()).filter(Boolean)),
  EMAIL_TEST_RECIPIENT: z.string().email().optional(),

  // ── Apify ──────────────────────────────────────────────────────────────────
  APIFY_API_TOKEN: z.string().optional(),

  // ── Scraping (legacy — Playwright, kept for FB Page metrics) ───────────────
  CHROMIUM_EXECUTABLE_PATH: z.string().optional(),
  PLAYWRIGHT_BROWSERS_PATH: z.string().optional(),
  SCRAPER_VIEWPORT_WIDTH: z.coerce.number().int().positive().default(1440),
  SCRAPER_VIEWPORT_HEIGHT: z.coerce.number().int().positive().default(900),
  SCRAPER_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  SCRAPER_REQUEST_DELAY_MS: z.coerce.number().int().nonnegative().default(2_000),
  SCRAPER_MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
  SCRAPER_HEADLESS: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),

  // ── PDF / Puppeteer ────────────────────────────────────────────────────────
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  PDF_FORMAT: z.enum(['A4', 'A3', 'Letter', 'Legal']).default('A4'),
  PDF_OUTPUT_DIR: z.string().default('./data/exports'),

  // ── File Paths ─────────────────────────────────────────────────────────────
  SCREENSHOTS_DIR: z.string().default('./data/screenshots'),
  TEMPLATES_DIR: z.string().default('./src/templates'),
  REPORTS_DIR: z.string().default('./data/exports'),

  // ── Meta Ads Library ───────────────────────────────────────────────────────
  META_ADS_COUNTRY: z.string().length(2).default('TH'),
  META_ADS_MAX_PER_COMPETITOR: z.coerce.number().int().positive().default(50),

  // ── OpenRouter ───────────────────────────────────────────────────────────
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().default('anthropic/claude-3.5-haiku'),
  OPENROUTER_MAX_TOKENS: z.coerce.number().int().positive().default(1_000),
  OPENROUTER_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),

  // ── Google Trends ─────────────────────────────────────────────────────────
  GOOGLE_TRENDS_GEO: z.string().length(2).default('TH'),
  GOOGLE_TRENDS_TIMEFRAME_DAYS: z.coerce.number().int().positive().default(90),
  GOOGLE_TRENDS_REQUEST_DELAY_MS: z.coerce.number().int().nonnegative().default(2_000),
  GOOGLE_TRENDS_MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
  /** Comma-separated list of keywords to track (overrides defaults) */
  GOOGLE_TRENDS_KEYWORDS: z
    .string()
    .optional()
    .transform((v) => v?.split(',').map((k) => k.trim()).filter(Boolean)),

  // ── Analysis Thresholds ────────────────────────────────────────────────────
  HEALTH_SCORE_PAID_WEIGHT: z.coerce.number().int().min(0).max(100).default(50),
  HEALTH_SCORE_ORGANIC_WEIGHT: z.coerce.number().int().min(0).max(100).default(50),
  THREAT_HIGH_THRESHOLD: z.coerce.number().int().min(0).max(100).default(75),
  THREAT_MEDIUM_THRESHOLD: z.coerce.number().int().min(0).max(100).default(40),
});

// ─────────────────────────────────────────────────────────────────────────────
// Parse & validate
// ─────────────────────────────────────────────────────────────────────────────

function parseEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // Use console.error here — logger isn't initialised yet
    console.error(`[config] Invalid environment variables:\n${issues}`);
    process.exit(1);
  }

  return result.data;
}

const env = parseEnv();

// ─────────────────────────────────────────────────────────────────────────────
// Derived / structured settings (single source of truth for the whole app)
// ─────────────────────────────────────────────────────────────────────────────

export const settings = {
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',

  log: {
    level: env.LOG_LEVEL,
  },

  db: {
    url:
      env.DATABASE_URL ??
      `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`,
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL,
    poolMax: env.DB_POOL_MAX,
  },

  email: {
    resendApiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    recipients: env.EMAIL_RECIPIENTS,
    testRecipient: env.EMAIL_TEST_RECIPIENT,
  },

  apify: {
    token: env.APIFY_API_TOKEN,
  },

  scraper: {
    chromiumPath: env.CHROMIUM_EXECUTABLE_PATH,
    playwrightBrowsersPath: env.PLAYWRIGHT_BROWSERS_PATH,
    viewport: {
      width: env.SCRAPER_VIEWPORT_WIDTH,
      height: env.SCRAPER_VIEWPORT_HEIGHT,
    },
    timeoutMs: env.SCRAPER_TIMEOUT_MS,
    requestDelayMs: env.SCRAPER_REQUEST_DELAY_MS,
    maxRetries: env.SCRAPER_MAX_RETRIES,
    headless: env.SCRAPER_HEADLESS,
  },

  pdf: {
    puppeteerPath: env.PUPPETEER_EXECUTABLE_PATH,
    format: env.PDF_FORMAT,
    outputDir: env.PDF_OUTPUT_DIR,
  },

  paths: {
    screenshots: env.SCREENSHOTS_DIR,
    templates: env.TEMPLATES_DIR,
    reports: env.REPORTS_DIR,
  },

  meta: {
    adsCountry: env.META_ADS_COUNTRY,
    maxAdsPerCompetitor: env.META_ADS_MAX_PER_COMPETITOR,
  },

  openrouter: {
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL,
    maxTokens: env.OPENROUTER_MAX_TOKENS,
    maxRetries: env.OPENROUTER_MAX_RETRIES,
  },

  googleTrends: {
    geo: env.GOOGLE_TRENDS_GEO,
    timeframeDays: env.GOOGLE_TRENDS_TIMEFRAME_DAYS,
    requestDelayMs: env.GOOGLE_TRENDS_REQUEST_DELAY_MS,
    maxRetries: env.GOOGLE_TRENDS_MAX_RETRIES,
    keywords: env.GOOGLE_TRENDS_KEYWORDS ?? [
      'hua hin hotel',
      'hua hin resort',
      'hua hin pool villa',
      'hua hin beachfront',
      'hua hin wedding venue',
      'pet friendly hotel hua hin',
      'hua hin family resort',
      'hua hin wellness retreat',
      'hua hin songkran',
      'hua hin workation',
    ],
  },

  analysis: {
    paidWeight: env.HEALTH_SCORE_PAID_WEIGHT,
    organicWeight: env.HEALTH_SCORE_ORGANIC_WEIGHT,
    threatHighThreshold: env.THREAT_HIGH_THRESHOLD,
    threatMediumThreshold: env.THREAT_MEDIUM_THRESHOLD,
  },
} as const;

export type Settings = typeof settings;
