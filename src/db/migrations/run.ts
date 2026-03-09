#!/usr/bin/env node
// =============================================================================
// Database Migration Runner
//
// Runnable as:
//   npm run migrate            (production — from dist/)
//   npm run dev:migrate        (development — via tsx)
//   node --import tsx/esm src/db/migrations/run.ts   (direct)
//
// What it does (in order):
//   1. Connects to the PostgreSQL server (to the default "postgres" database)
//   2. Ensures the target application database exists (creates it if missing)
//   3. Connects to the application database
//   4. Runs Drizzle ORM push to sync schema → tables + indexes + constraints
//   5. Seeds initial competitor data if the competitors table is empty
//   6. Reports summary and exits
// =============================================================================

import pg from 'pg';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { count, sql } from 'drizzle-orm';
import { createLogger } from '../../utils/logger.js';
import * as schema from '../schema.js';
import { competitors } from '../schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../.env') });

const log = createLogger('migrate');

// ─────────────────────────────────────────────────────────────────────────────
// Config from environment
// ─────────────────────────────────────────────────────────────────────────────

const DB_HOST = process.env['DB_HOST'] ?? 'localhost';
const DB_PORT = parseInt(process.env['DB_PORT'] ?? '5432', 10);
const DB_USER = process.env['DB_USER'] ?? 'competitor_user';
const DB_PASSWORD = process.env['DB_PASSWORD'] ?? '';
const DB_NAME = process.env['DB_NAME'] ?? 'competitor_intel';
const DB_SSL = process.env['DB_SSL'] === 'true';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Ensure database exists
// ─────────────────────────────────────────────────────────────────────────────

async function ensureDatabaseExists(): Promise<void> {
  log.info(`Checking if database "${DB_NAME}" exists on ${DB_HOST}:${DB_PORT}...`);

  // Connect to the default "postgres" database to run admin queries
  const adminClient = new pg.Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: 'postgres',
    ssl: DB_SSL ? { rejectUnauthorized: false } : false,
  });

  try {
    await adminClient.connect();
    log.info('Connected to PostgreSQL server (postgres database)');

    // Check existence
    const result = await adminClient.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists`,
      [DB_NAME],
    );

    if (result.rows[0]?.exists) {
      log.info(`Database "${DB_NAME}" already exists — skipping creation`);
    } else {
      log.info(`Database "${DB_NAME}" does not exist — creating...`);

      // CREATE DATABASE cannot run inside a transaction in PostgreSQL
      // Identifier quoting is safe here since DB_NAME comes from our own env
      await adminClient.query(
        `CREATE DATABASE "${DB_NAME}" ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' TEMPLATE template0`,
      ).catch(async (err: Error) => {
        // If locale isn't available, fall back to default template
        if (err.message.includes('LC_COLLATE') || err.message.includes('locale')) {
          log.warn('Locale en_US.UTF-8 not available, falling back to default template');
          await adminClient.query(`CREATE DATABASE "${DB_NAME}" ENCODING 'UTF8'`);
        } else {
          throw err;
        }
      });

      log.info(`Database "${DB_NAME}" created successfully`);
    }
  } finally {
    await adminClient.end();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Connect to app database and create Drizzle instance
// ─────────────────────────────────────────────────────────────────────────────

function createAppPool(): pg.Pool {
  return new pg.Pool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: DB_SSL ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Run schema push (create / alter tables to match schema.ts)
// ─────────────────────────────────────────────────────────────────────────────

async function runSchemaPush(pool: pg.Pool): Promise<void> {
  log.info('Pushing schema to database (creating tables, indexes, constraints)...');

  const db = drizzle(pool, { schema });

  // Use raw SQL to create each table via the Drizzle schema definitions.
  // We read the CREATE TABLE statements from the schema programmatically by
  // using Drizzle's push approach — `CREATE TABLE IF NOT EXISTS`.
  //
  // For a production system, drizzle-kit generate + migrate is preferred.
  // Here we use a pragmatic approach: raw DDL that matches our schema exactly.

  await db.execute(sql`
    -- ═══════════════════════════════════════════════════════════════════════════
    -- COMPETITORS
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS competitors (
      id              SERIAL PRIMARY KEY,
      name            VARCHAR(255) NOT NULL,
      facebook_page_id VARCHAR(255) NOT NULL,
      facebook_page_url TEXT NOT NULL,
      ads_library_url  TEXT NOT NULL,
      category        VARCHAR(100) NOT NULL DEFAULT 'hotel',
      price_tier      VARCHAR(50) NOT NULL DEFAULT 'mid-range',
      is_customer     BOOLEAN NOT NULL DEFAULT FALSE,
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS competitors_facebook_page_id_idx ON competitors (facebook_page_id);
    CREATE INDEX IF NOT EXISTS competitors_is_active_idx ON competitors (is_active);
    CREATE INDEX IF NOT EXISTS competitors_category_idx ON competitors (category);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- ADS
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS ads (
      id                  SERIAL PRIMARY KEY,
      competitor_id       INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      meta_ad_id          VARCHAR(100) NOT NULL,
      started_running     DATE,
      is_active           BOOLEAN NOT NULL DEFAULT TRUE,
      platforms           JSONB NOT NULL DEFAULT '[]'::jsonb,
      creative_type       VARCHAR(50) NOT NULL DEFAULT 'unknown',
      ad_copy             TEXT,
      headline            VARCHAR(500),
      cta_type            VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
      landing_url         TEXT,
      ad_variations_count INTEGER NOT NULL DEFAULT 1,
      extracted_price     NUMERIC(12,2),
      extracted_discount  NUMERIC(5,2),
      language            VARCHAR(10),
      screenshot_path     TEXT,
      scraped_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ads_meta_ad_id_idx ON ads (meta_ad_id);
    CREATE INDEX IF NOT EXISTS ads_competitor_id_idx ON ads (competitor_id);
    CREATE INDEX IF NOT EXISTS ads_competitor_active_idx ON ads (competitor_id, is_active);
    CREATE INDEX IF NOT EXISTS ads_scraped_at_idx ON ads (scraped_at);
    CREATE INDEX IF NOT EXISTS ads_started_running_idx ON ads (started_running);
    CREATE INDEX IF NOT EXISTS ads_creative_type_idx ON ads (creative_type);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- FACEBOOK PAGES (metrics snapshots)
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS facebook_pages (
      id                  SERIAL PRIMARY KEY,
      competitor_id       INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      page_url            TEXT NOT NULL,
      followers           INTEGER,
      page_likes          INTEGER,
      rating              NUMERIC(3,2),
      review_count        INTEGER,
      posts_last_30d      INTEGER,
      avg_engagement_rate NUMERIC(8,4),
      last_post_date      TIMESTAMPTZ,
      scraped_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS facebook_pages_competitor_id_idx ON facebook_pages (competitor_id);
    CREATE INDEX IF NOT EXISTS facebook_pages_scraped_at_idx ON facebook_pages (scraped_at);
    CREATE INDEX IF NOT EXISTS facebook_pages_competitor_scraped_idx ON facebook_pages (competitor_id, scraped_at);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- FACEBOOK POSTS
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS facebook_posts (
      id                SERIAL PRIMARY KEY,
      competitor_id     INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      post_id           VARCHAR(255) NOT NULL,
      post_url          TEXT NOT NULL,
      post_type         VARCHAR(50) NOT NULL DEFAULT 'unknown',
      post_text         TEXT,
      posted_at         TIMESTAMPTZ,
      reactions         INTEGER NOT NULL DEFAULT 0,
      comments          INTEGER NOT NULL DEFAULT 0,
      shares            INTEGER NOT NULL DEFAULT 0,
      video_views       INTEGER,
      content_category  VARCHAR(50) NOT NULL DEFAULT 'unknown',
      language          VARCHAR(10),
      is_top_performer  BOOLEAN NOT NULL DEFAULT FALSE,
      scraped_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS facebook_posts_post_id_idx ON facebook_posts (post_id);
    CREATE INDEX IF NOT EXISTS facebook_posts_competitor_id_idx ON facebook_posts (competitor_id);
    CREATE INDEX IF NOT EXISTS facebook_posts_posted_at_idx ON facebook_posts (posted_at);
    CREATE INDEX IF NOT EXISTS facebook_posts_competitor_posted_idx ON facebook_posts (competitor_id, posted_at);
    CREATE INDEX IF NOT EXISTS facebook_posts_is_top_performer_idx ON facebook_posts (is_top_performer);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- ANALYSES
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS analyses (
      id                    SERIAL PRIMARY KEY,
      competitor_id         INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      analysis_date         DATE NOT NULL,
      total_active_ads      INTEGER NOT NULL DEFAULT 0,
      newest_ad_date        DATE,
      ad_types              JSONB NOT NULL DEFAULT '[]'::jsonb,
      target_segments       JSONB NOT NULL DEFAULT '[]'::jsonb,
      pricing_data          JSONB,
      marketing_strategy_en TEXT,
      marketing_strategy_th TEXT,
      key_usp_en            TEXT,
      key_usp_th            TEXT,
      health_score          NUMERIC(5,2) NOT NULL DEFAULT 0,
      paid_score            NUMERIC(5,2) NOT NULL DEFAULT 0,
      organic_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
      threat_level          VARCHAR(20) NOT NULL DEFAULT 'low',
      trend                 VARCHAR(20) NOT NULL DEFAULT 'stable',
      share_of_voice        NUMERIC(5,2),
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS analyses_competitor_date_idx ON analyses (competitor_id, analysis_date);
    CREATE INDEX IF NOT EXISTS analyses_competitor_id_idx ON analyses (competitor_id);
    CREATE INDEX IF NOT EXISTS analyses_analysis_date_idx ON analyses (analysis_date);
    CREATE INDEX IF NOT EXISTS analyses_threat_level_idx ON analyses (threat_level);
    CREATE INDEX IF NOT EXISTS analyses_health_score_idx ON analyses (health_score);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- TRENDS
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS trends (
      id          SERIAL PRIMARY KEY,
      trend_date  DATE NOT NULL,
      source      VARCHAR(50) NOT NULL,
      keyword     VARCHAR(255) NOT NULL,
      value       NUMERIC(12,4) NOT NULL DEFAULT 0,
      change_pct  NUMERIC(8,4),
      metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS trends_trend_date_idx ON trends (trend_date);
    CREATE INDEX IF NOT EXISTS trends_source_idx ON trends (source);
    CREATE INDEX IF NOT EXISTS trends_keyword_idx ON trends (keyword);
    CREATE UNIQUE INDEX IF NOT EXISTS trends_date_source_keyword_idx ON trends (trend_date, source, keyword);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- ALERTS
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS alerts (
      id              SERIAL PRIMARY KEY,
      alert_date      DATE NOT NULL,
      alert_type      VARCHAR(50) NOT NULL,
      severity        VARCHAR(20) NOT NULL DEFAULT 'info',
      competitor_id   INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      title           VARCHAR(500) NOT NULL,
      description     TEXT NOT NULL,
      action_required TEXT,
      is_sent         BOOLEAN NOT NULL DEFAULT FALSE,
      sent_at         TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS alerts_alert_date_idx ON alerts (alert_date);
    CREATE INDEX IF NOT EXISTS alerts_competitor_id_idx ON alerts (competitor_id);
    CREATE INDEX IF NOT EXISTS alerts_severity_idx ON alerts (severity);
    CREATE INDEX IF NOT EXISTS alerts_is_sent_idx ON alerts (is_sent);
    CREATE INDEX IF NOT EXISTS alerts_type_date_idx ON alerts (alert_type, alert_date);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- REPORTS
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS reports (
      id                SERIAL PRIMARY KEY,
      report_date       DATE NOT NULL,
      report_title      VARCHAR(500) NOT NULL,
      period_start      DATE NOT NULL,
      period_end        DATE NOT NULL,
      pdf_path          TEXT,
      total_competitors INTEGER NOT NULL DEFAULT 0,
      total_ads         INTEGER NOT NULL DEFAULT 0,
      total_alerts      INTEGER NOT NULL DEFAULT 0,
      is_delivered      BOOLEAN NOT NULL DEFAULT FALSE,
      delivered_at      TIMESTAMPTZ,
      delivered_to      JSONB DEFAULT '[]'::jsonb,
      metadata          JSONB DEFAULT '{}'::jsonb,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS reports_report_date_idx ON reports (report_date);
    CREATE INDEX IF NOT EXISTS reports_is_delivered_idx ON reports (is_delivered);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- FOLLOWER HISTORY
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS follower_history (
      id                 SERIAL PRIMARY KEY,
      competitor_id      INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      recorded_date      DATE NOT NULL,
      followers          INTEGER NOT NULL,
      previous_followers INTEGER,
      change_absolute    INTEGER,
      change_pct         NUMERIC(8,4),
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS follower_history_competitor_date_idx ON follower_history (competitor_id, recorded_date);
    CREATE INDEX IF NOT EXISTS follower_history_competitor_id_idx ON follower_history (competitor_id);
    CREATE INDEX IF NOT EXISTS follower_history_recorded_date_idx ON follower_history (recorded_date);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- PIPELINE RUNS
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id           TEXT PRIMARY KEY,
      status       VARCHAR(20) NOT NULL DEFAULT 'running',
      stage        VARCHAR(50) NOT NULL DEFAULT 'idle',
      started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      results      JSONB NOT NULL DEFAULT '{}'::jsonb,
      error        TEXT,
      dry_run      BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS pipeline_runs_started_at_idx ON pipeline_runs (started_at);
    CREATE INDEX IF NOT EXISTS pipeline_runs_status_idx ON pipeline_runs (status);
  `);

  // ───────────────────────────────────────────────────────────────────────────────
  // 002 — Schema Enhancements: add new columns and tables
  // ───────────────────────────────────────────────────────────────────────────────

  await db.execute(sql`
    -- ═══════════════════════════════════════════════════════════════════════════
    -- COMPETITORS: add 6 cached/computed columns
    -- ═══════════════════════════════════════════════════════════════════════════
    ALTER TABLE IF EXISTS competitors ADD COLUMN IF NOT EXISTS cached_health_score NUMERIC(5,2);
    ALTER TABLE IF EXISTS competitors ADD COLUMN IF NOT EXISTS cached_share_of_voice NUMERIC(5,2);
    ALTER TABLE IF EXISTS competitors ADD COLUMN IF NOT EXISTS cached_threat_level VARCHAR(20);
    ALTER TABLE IF EXISTS competitors ADD COLUMN IF NOT EXISTS positioning_similarity VARCHAR(20);
    ALTER TABLE IF EXISTS competitors ADD COLUMN IF NOT EXISTS estimated_daily_spend VARCHAR(100);
    ALTER TABLE IF EXISTS competitors ADD COLUMN IF NOT EXISTS spend_tier VARCHAR(20);
    CREATE INDEX IF NOT EXISTS competitors_spend_tier_idx ON competitors (spend_tier);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- ADS: add 20 new fields from Apify scraper and derived fields
    -- ═══════════════════════════════════════════════════════════════════════════
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS ad_archive_id VARCHAR(100);
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS ad_text TEXT;
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS ad_creative_bodies JSONB;
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS publisher_platforms JSONB;
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS ad_status VARCHAR(50);
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS ad_creation_time TIMESTAMPTZ;
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS estimated_audience_size VARCHAR(100);
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS cta_domain VARCHAR(255);
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS cta_headline VARCHAR(500);
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS cta_description TEXT;
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS ad_snapshot_url TEXT;
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS ad_library_url TEXT;
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS creative_type_enum VARCHAR(50);
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS category_tag VARCHAR(50);
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS extracted_price_str VARCHAR(100);
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS discount_depth VARCHAR(50);
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS is_high_focus BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE IF EXISTS ads ADD COLUMN IF NOT EXISTS roi_confidence VARCHAR(20);
    CREATE INDEX IF NOT EXISTS ads_category_tag_idx ON ads (category_tag);
    CREATE INDEX IF NOT EXISTS ads_is_high_focus_idx ON ads (is_high_focus);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- FACEBOOK_POSTS: add granular reaction breakdown + engagement score
    -- ═══════════════════════════════════════════════════════════════════════════
    ALTER TABLE IF EXISTS facebook_posts ADD COLUMN IF NOT EXISTS likes INTEGER;
    ALTER TABLE IF EXISTS facebook_posts ADD COLUMN IF NOT EXISTS views_count INTEGER;
    ALTER TABLE IF EXISTS facebook_posts ADD COLUMN IF NOT EXISTS reaction_like_count INTEGER;
    ALTER TABLE IF EXISTS facebook_posts ADD COLUMN IF NOT EXISTS reaction_love_count INTEGER;
    ALTER TABLE IF EXISTS facebook_posts ADD COLUMN IF NOT EXISTS reaction_wow_count INTEGER;
    ALTER TABLE IF EXISTS facebook_posts ADD COLUMN IF NOT EXISTS reaction_haha_count INTEGER;
    ALTER TABLE IF EXISTS facebook_posts ADD COLUMN IF NOT EXISTS reaction_care_count INTEGER;
    ALTER TABLE IF EXISTS facebook_posts ADD COLUMN IF NOT EXISTS media_type VARCHAR(50);
    ALTER TABLE IF EXISTS facebook_posts ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
    ALTER TABLE IF EXISTS facebook_posts ADD COLUMN IF NOT EXISTS engagement_score NUMERIC(10,4);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- NEW TABLE: market_snapshots — daily market aggregates
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS market_snapshots (
      id                  SERIAL PRIMARY KEY,
      snapshot_date       DATE NOT NULL,
      total_active_ads    INTEGER NOT NULL DEFAULT 0,
      active_advertisers  INTEGER NOT NULL DEFAULT 0,
      total_competitors   INTEGER NOT NULL DEFAULT 0,
      market_leader_id    INTEGER REFERENCES competitors(id) ON DELETE SET NULL,
      client_ad_count     INTEGER NOT NULL DEFAULT 0,
      client_sov          NUMERIC(5,2),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS market_snapshots_snapshot_date_idx ON market_snapshots (snapshot_date);
    CREATE INDEX IF NOT EXISTS market_snapshots_market_leader_idx ON market_snapshots (market_leader_id);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- NEW TABLE: competitor_segments — explicit segment targeting
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS competitor_segments (
      id              SERIAL PRIMARY KEY,
      competitor_id   INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      segment_name    VARCHAR(50) NOT NULL,
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS competitor_segments_comp_seg_idx ON competitor_segments (competitor_id, segment_name);
    CREATE INDEX IF NOT EXISTS competitor_segments_competitor_id_idx ON competitor_segments (competitor_id);
    CREATE INDEX IF NOT EXISTS competitor_segments_segment_name_idx ON competitor_segments (segment_name);

    -- ═══════════════════════════════════════════════════════════════════════════
    -- NEW TABLE: report_alerts — report-level alert dashboard
    -- ═══════════════════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS report_alerts (
      id              SERIAL PRIMARY KEY,
      alert_date      DATE NOT NULL,
      severity        VARCHAR(20) NOT NULL DEFAULT 'info',
      competitor_id   INTEGER REFERENCES competitors(id) ON DELETE SET NULL,
      alert_type      VARCHAR(50) NOT NULL,
      message         TEXT NOT NULL,
      message_thai    TEXT,
      is_actionable   BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS report_alerts_alert_date_idx ON report_alerts (alert_date);
    CREATE INDEX IF NOT EXISTS report_alerts_competitor_id_idx ON report_alerts (competitor_id);
    CREATE INDEX IF NOT EXISTS report_alerts_severity_idx ON report_alerts (severity);
    CREATE INDEX IF NOT EXISTS report_alerts_is_actionable_idx ON report_alerts (is_actionable);
  `);

  log.info('Schema push complete — all 14 tables and indexes are up to date');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Seed initial competitor data
// ─────────────────────────────────────────────────────────────────────────────

interface SeedCompetitor {
  name: string;
  facebookPageId: string;
  facebookPageUrl: string;
  adsLibraryUrl: string;
  category: string;
  priceTier: string;
  isCustomer: boolean;
}

/**
 * Seed competitors list.
 * The first entry (isCustomer: true) is "our" hotel — W Koh Samui.
 * All others are competitors.  Update this array with your real data.
 */
const SEED_COMPETITORS: SeedCompetitor[] = [
  // ── OUR HOTEL (the customer) ───────────────────────────────────────────────
  {
    name: 'W Koh Samui',
    facebookPageId: 'WKohSamui',
    facebookPageUrl: 'https://www.facebook.com/WKohSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=137992026237498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'luxury',
    isCustomer: true,
  },
  // ── COMPETITORS ────────────────────────────────────────────────────────────
  {
    name: 'Four Seasons Koh Samui',
    facebookPageId: 'FourSeasonsKohSamui',
    facebookPageUrl: 'https://www.facebook.com/FourSeasonsKohSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=128152827222498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'luxury',
    isCustomer: false,
  },
  {
    name: 'Banyan Tree Samui',
    facebookPageId: 'BanyanTreeSamui',
    facebookPageUrl: 'https://www.facebook.com/BanyanTreeSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=179250498766498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'luxury',
    isCustomer: false,
  },
  {
    name: 'Conrad Koh Samui',
    facebookPageId: 'ConradKohSamui',
    facebookPageUrl: 'https://www.facebook.com/ConradKohSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=181249831906498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'luxury',
    isCustomer: false,
  },
  {
    name: 'InterContinental Koh Samui',
    facebookPageId: 'InterContinentalSamui',
    facebookPageUrl: 'https://www.facebook.com/InterContinentalSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=217440654937498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'luxury',
    isCustomer: false,
  },
  {
    name: 'Vana Belle Koh Samui',
    facebookPageId: 'VanaBelleKohSamui',
    facebookPageUrl: 'https://www.facebook.com/VanaBelleKohSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=142754122417498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'luxury',
    isCustomer: false,
  },
  {
    name: 'SALA Samui Chaweng Beach',
    facebookPageId: 'salahospitality',
    facebookPageUrl: 'https://www.facebook.com/salahospitality',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=157131467642498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'premium',
    isCustomer: false,
  },
  {
    name: 'Silavadee Pool Spa Resort',
    facebookPageId: 'SilavadeePoolSpa',
    facebookPageUrl: 'https://www.facebook.com/SilavadeePoolSpa',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=195438577134498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'premium',
    isCustomer: false,
  },
  {
    name: 'Meliá Koh Samui',
    facebookPageId: 'MeliaKohSamui',
    facebookPageUrl: 'https://www.facebook.com/MeliaKohSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=103854421279498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'premium',
    isCustomer: false,
  },
  {
    name: 'Centara Grand Beach Resort Samui',
    facebookPageId: 'CentaraGrandSamui',
    facebookPageUrl: 'https://www.facebook.com/CentaraGrandSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=208773439149498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'premium',
    isCustomer: false,
  },
  {
    name: 'Anantara Bophut Koh Samui',
    facebookPageId: 'AnantaraBoputSamui',
    facebookPageUrl: 'https://www.facebook.com/AnantaraBoputSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=174831702528498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'premium',
    isCustomer: false,
  },
  {
    name: 'Anantara Lawana Koh Samui',
    facebookPageId: 'AnantaraLawanaSamui',
    facebookPageUrl: 'https://www.facebook.com/AnantaraLawanaSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=150284271661498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'luxury',
    isCustomer: false,
  },
  {
    name: 'The Ritz-Carlton Koh Samui',
    facebookPageId: 'RitzCarltonKohSamui',
    facebookPageUrl: 'https://www.facebook.com/RitzCarltonKohSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=213549475329498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'luxury',
    isCustomer: false,
  },
  {
    name: 'Six Senses Samui',
    facebookPageId: 'SixSensesSamui',
    facebookPageUrl: 'https://www.facebook.com/SixSensesSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=189327124419498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'luxury',
    isCustomer: false,
  },
  {
    name: 'Nikki Beach Resort Koh Samui',
    facebookPageId: 'NikkiBeachKohSamui',
    facebookPageUrl: 'https://www.facebook.com/NikkiBeachKohSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=267230599963498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'luxury',
    isCustomer: false,
  },
  {
    name: 'Sheraton Samui Resort',
    facebookPageId: 'SheratonSamui',
    facebookPageUrl: 'https://www.facebook.com/SheratonSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=172508682780498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'premium',
    isCustomer: false,
  },
  {
    name: 'Hyatt Regency Koh Samui',
    facebookPageId: 'HyattRegencyKohSamui',
    facebookPageUrl: 'https://www.facebook.com/HyattRegencyKohSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=107743237687498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'premium',
    isCustomer: false,
  },
  {
    name: 'Renaissance Koh Samui',
    facebookPageId: 'RenaissanceKohSamui',
    facebookPageUrl: 'https://www.facebook.com/RenaissanceKohSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=296842520329498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'premium',
    isCustomer: false,
  },
  {
    name: 'OZO Chaweng Samui',
    facebookPageId: 'OZOSamui',
    facebookPageUrl: 'https://www.facebook.com/OZOSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=117604938261498&search_type=page',
    category: 'mid_range_hotel',
    priceTier: 'mid-range',
    isCustomer: false,
  },
  {
    name: 'Buri Rasa Village Samui',
    facebookPageId: 'BuriRasaVillage',
    facebookPageUrl: 'https://www.facebook.com/BuriRasaVillage',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=171506529536498&search_type=page',
    category: 'mid_range_hotel',
    priceTier: 'mid-range',
    isCustomer: false,
  },
  {
    name: 'Peace Resort Samui',
    facebookPageId: 'PeaceResortSamui',
    facebookPageUrl: 'https://www.facebook.com/PeaceResortSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=244523895561498&search_type=page',
    category: 'mid_range_hotel',
    priceTier: 'mid-range',
    isCustomer: false,
  },
  {
    name: 'Nora Buri Resort & Spa',
    facebookPageId: 'NoraBuriResort',
    facebookPageUrl: 'https://www.facebook.com/NoraBuriResort',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=153239528024498&search_type=page',
    category: 'mid_range_hotel',
    priceTier: 'mid-range',
    isCustomer: false,
  },
  {
    name: 'Samui Palm Beach Resort',
    facebookPageId: 'SamuiPalmBeach',
    facebookPageUrl: 'https://www.facebook.com/SamuiPalmBeach',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=268447173191498&search_type=page',
    category: 'mid_range_hotel',
    priceTier: 'mid-range',
    isCustomer: false,
  },
  {
    name: 'Bandara Resort & Spa Samui',
    facebookPageId: 'BandaraSamui',
    facebookPageUrl: 'https://www.facebook.com/BandaraSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=234158679935498&search_type=page',
    category: 'mid_range_hotel',
    priceTier: 'mid-range',
    isCustomer: false,
  },
  {
    name: 'Bo Phut Resort & Spa',
    facebookPageId: 'BoPhutResort',
    facebookPageUrl: 'https://www.facebook.com/BoPhutResort',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=188451557832498&search_type=page',
    category: 'mid_range_hotel',
    priceTier: 'mid-range',
    isCustomer: false,
  },
  {
    name: 'Chaba Samui Resort',
    facebookPageId: 'ChabaSamui',
    facebookPageUrl: 'https://www.facebook.com/ChabaSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=156428981041498&search_type=page',
    category: 'mid_range_hotel',
    priceTier: 'mid-range',
    isCustomer: false,
  },
  {
    name: 'KC Resort & Over Water Villas',
    facebookPageId: 'KCSamui',
    facebookPageUrl: 'https://www.facebook.com/KCSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=203814162969498&search_type=page',
    category: 'mid_range_hotel',
    priceTier: 'mid-range',
    isCustomer: false,
  },
  {
    name: 'The Library Koh Samui',
    facebookPageId: 'TheLibraryKohSamui',
    facebookPageUrl: 'https://www.facebook.com/TheLibraryKohSamui',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=119478651397498&search_type=page',
    category: 'boutique_hotel',
    priceTier: 'premium',
    isCustomer: false,
  },
  {
    name: 'COMO Point Yamu Samui',
    facebookPageId: 'COMOPointYamu',
    facebookPageUrl: 'https://www.facebook.com/COMOPointYamu',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=287413484609498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'luxury',
    isCustomer: false,
  },
  {
    name: 'Cape Fahn Hotel Samui',
    facebookPageId: 'CapeFahnHotel',
    facebookPageUrl: 'https://www.facebook.com/CapeFahnHotel',
    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=320124558011498&search_type=page',
    category: 'luxury_hotel',
    priceTier: 'luxury',
    isCustomer: false,
  },
];

async function seedCompetitors(pool: pg.Pool): Promise<void> {
  const db = drizzle(pool, { schema });

  // Check if table already has data
  const [existing] = await db.select({ total: count() }).from(competitors);
  if ((existing?.total ?? 0) > 0) {
    log.info(`Competitors table already has ${existing!.total} rows — skipping seed`);
    return;
  }

  log.info(`Seeding ${SEED_COMPETITORS.length} competitors...`);

  // Insert in one batch
  await db.insert(competitors).values(
    SEED_COMPETITORS.map((c) => ({
      name: c.name,
      facebookPageId: c.facebookPageId,
      facebookPageUrl: c.facebookPageUrl,
      adsLibraryUrl: c.adsLibraryUrl,
      category: c.category,
      priceTier: c.priceTier,
      isCustomer: c.isCustomer,
      isActive: true,
    })),
  );

  // Verify
  const [verify] = await db.select({ total: count() }).from(competitors);
  log.info(`Seeded ${verify!.total} competitors (1 customer + ${verify!.total - 1} competitors)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Main orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  const startTime = Date.now();
  let appPool: pg.Pool | undefined;

  try {
    // Step 1 — Ensure database exists
    log.info('═'.repeat(60));
    log.info('  MIGRATION RUNNER — Starting');
    log.info('═'.repeat(60));
    log.info(`Target: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);

    await ensureDatabaseExists();

    // Step 2 — Connect to the app database
    log.info('Connecting to application database...');
    appPool = createAppPool();
    const client = await appPool.connect();
    const { rows } = await client.query<{ now: Date }>('SELECT NOW() AS now');
    log.info(`Connected — server time: ${String(rows[0]?.now)}`);
    client.release();

    // Step 3 — Push schema (create tables + indexes)
    await runSchemaPush(appPool);

    // Step 4 — Seed data
    await seedCompetitors(appPool);

    // Done
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info('─'.repeat(60));
    log.info(`  MIGRATION COMPLETE — ${elapsed}s`);
    log.info('─'.repeat(60));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log.error(`Migration failed: ${message}`, { stack });
    throw err;
  } finally {
    if (appPool) {
      await appPool.end();
      log.debug('Migration pool closed');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct execution entry point
// ─────────────────────────────────────────────────────────────────────────────

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].includes('migrations/run') ||
    process.argv[1].includes('migrations\\run'));

if (isDirectRun) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}
