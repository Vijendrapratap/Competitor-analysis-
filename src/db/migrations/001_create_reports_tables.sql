-- =============================================================================
-- Migration 001: Report tables for the intelligence system
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ───────────────────────────────────────────────────────
-- TABLE: reports
-- One row per generated report. html_content is the full
-- report HTML — converted to PDF on every access.
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id                  SERIAL PRIMARY KEY,
    report_uuid         UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,

    -- Identity
    title               VARCHAR(255) NOT NULL,
    client_name         VARCHAR(255),
    market_location     VARCHAR(100) DEFAULT 'Hua Hin, Thailand',

    -- Period
    report_month        INTEGER NOT NULL CHECK (report_month BETWEEN 1 AND 12),
    report_year         INTEGER NOT NULL,
    report_date         DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Summary counts (for list view without parsing HTML)
    competitors_count   INTEGER NOT NULL DEFAULT 0,
    active_advertisers  INTEGER NOT NULL DEFAULT 0,
    total_active_ads    INTEGER NOT NULL DEFAULT 0,

    -- The full assembled report HTML (source of truth for PDF generation)
    html_content        TEXT NOT NULL,

    -- Intelligence summary stored as JSONB for fast querying
    metadata            JSONB NOT NULL DEFAULT '{}',

    -- Generation info
    generated_by        VARCHAR(100) NOT NULL DEFAULT 'system',
    llm_model_used      VARCHAR(100) NOT NULL DEFAULT 'anthropic/claude-sonnet-4-5',
    generation_time_sec NUMERIC(8,2),

    -- Soft delete state machine: active → archived → deleted
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived', 'deleted')),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    -- Prevent duplicate reports for same client in same month
    CONSTRAINT uq_report_per_client_month
        UNIQUE (client_name, report_month, report_year)
);

CREATE INDEX IF NOT EXISTS idx_reports_client     ON reports(client_name);
CREATE INDEX IF NOT EXISTS idx_reports_date       ON reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status     ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_uuid       ON reports(report_uuid);
CREATE INDEX IF NOT EXISTS idx_reports_period     ON reports(report_year DESC, report_month DESC);
CREATE INDEX IF NOT EXISTS idx_reports_metadata   ON reports USING GIN(metadata);


-- ───────────────────────────────────────────────────────
-- TABLE: report_competitors
-- Per-competitor snapshot for each report.
-- Enables trend queries across months without re-parsing HTML.
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_competitors (
    id                    SERIAL PRIMARY KEY,
    report_id             INTEGER NOT NULL
                          REFERENCES reports(id) ON DELETE CASCADE,

    -- Identity
    competitor_name       VARCHAR(255) NOT NULL,
    facebook_page_id      VARCHAR(50),
    facebook_page_url     VARCHAR(500),

    -- Snapshot metrics
    total_active_ads      INTEGER NOT NULL DEFAULT 0,
    health_score          NUMERIC(5,2),
    budget_tier           VARCHAR(20),
    threat_level          VARCHAR(10),
    is_new_entrant        BOOLEAN NOT NULL DEFAULT FALSE,
    is_market_leader      BOOLEAN NOT NULL DEFAULT FALSE,
    newest_ad_date        DATE,

    -- Strategy snapshot
    ad_types              TEXT[] NOT NULL DEFAULT '{}',
    target_segments       TEXT[] NOT NULL DEFAULT '{}',
    key_usp_en            TEXT,
    marketing_strategy_en TEXT,
    pricing_info          VARCHAR(500),
    language_split        VARCHAR(50),
    estimated_ad_spend    VARCHAR(50),

    -- Individual competitor HTML (for standalone competitor PDF export)
    competitor_html       TEXT,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rc_report_id   ON report_competitors(report_id);
CREATE INDEX IF NOT EXISTS idx_rc_comp_name   ON report_competitors(competitor_name);


-- ───────────────────────────────────────────────────────
-- TABLE: report_access_log
-- Audit trail: who accessed which report, how, when
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_access_log (
    id            SERIAL PRIMARY KEY,
    report_id     INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    report_uuid   UUID NOT NULL,
    accessed_by   VARCHAR(255) NOT NULL DEFAULT 'anonymous',
    access_type   VARCHAR(20) NOT NULL DEFAULT 'pdf_download'
                  CHECK (access_type IN ('pdf_download', 'pdf_view', 'metadata')),
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    accessed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_report  ON report_access_log(report_id);
CREATE INDEX IF NOT EXISTS idx_access_date    ON report_access_log(accessed_at DESC);


-- ───────────────────────────────────────────────────────
-- TRIGGER: auto-update updated_at on reports
-- ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reports_updated_at ON reports;
CREATE TRIGGER trg_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
