# 📋 COMPETITOR INTELLIGENCE SYSTEM — PRODUCT REQUIREMENTS DOCUMENT

**Version**: 1.0.0
**Last Updated**: March 2026
**Status**: Production
**Document Owner**: System Architecture

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Core Features](#core-features)
5. [API Specification](#api-specification)
6. [Database Schema](#database-schema)
7. [Data Flow & Pipeline](#data-flow--pipeline)
8. [LLM Integration](#llm-integration)
9. [Frontend Features](#frontend-features)
10. [Configuration & Deployment](#configuration--deployment)
11. [Monitoring & Maintenance](#monitoring--maintenance)

---

## EXECUTIVE SUMMARY

### Overview
The **Competitor Intelligence System** is an automated data pipeline that scrapes competitor marketing data, performs AI-driven analysis, generates insights, and delivers weekly intelligence reports. Designed for the Hua Hin hospitality market, it tracks competitor behavior across Meta Ads Library, Facebook pages, and market trends.

### Key Capabilities
- **Real-time Web Scraping**: Meta Ads Library, Facebook pages, Google Trends
- **AI-Powered Analysis**: Health scores, threat assessment, marketing strategy extraction
- **Automated Reporting**: PDF generation with charts, insights, and recommendations
- **Email Delivery**: Scheduled report distribution to stakeholders
- **Web Dashboard**: Real-time market overview, competitor rankings, alert management

### Primary Users
- Hotel management executives
- Marketing teams
- Competitive intelligence analysts
- Business development managers

### Success Metrics
- Report delivery accuracy: >98%
- Pipeline uptime: >99.5%
- Ad capture rate: 95%+ of active ads
- Analysis latency: <5 minutes per competitor

---

## SYSTEM ARCHITECTURE

### 1. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPETITOR INTELLIGENCE SYSTEM                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  DATA SOURCES       │  │   SCRAPE LAYER   │  │  PROCESS LAYER       │  │
│  ├─────────────────────┤  ├──────────────────┤  ├──────────────────────┤  │
│  │                     │  │                  │  │                      │  │
│  │ • Facebook Pages    │→ │ • Apify Actors   │→ │ • Scrape Service    │  │
│  │ • Meta Ads Library  │  │ • Playwright     │  │ • Analysis Service  │  │
│  │ • Google Trends     │  │ • Puppeteer      │  │ • Report Service    │  │
│  │                     │  │                  │  │ • Delivery Service  │  │
│  └─────────────────────┘  └──────────────────┘  └──────────────────────┘  │
│           │                         │                      │               │
│           └─────────────────────────┼──────────────────────┘               │
│                                     ↓                                       │
│                          ┌──────────────────────┐                          │
│                          │  DATA STORAGE        │                          │
│                          │  PostgreSQL + Drizzle│                          │
│                          │  (14 Tables)         │                          │
│                          └──────────────────────┘                          │
│                                     ↑                                       │
│           ┌─────────────────────────┼─────────────────────────┐            │
│           │                         │                         │            │
│  ┌────────▼──────┐        ┌────────▼──────┐        ┌────────▼──────┐     │
│  │  REST API     │        │   SCHEDULER   │        │  PDF DELIVERY │     │
│  │  (Express)    │        │   (Node Cron) │        │   (Resend)    │     │
│  │  Port 3001    │        │               │        │               │     │
│  └────────┬──────┘        └───────────────┘        └───────────────┘     │
│           │                                                                │
│  ┌────────▼──────┐                                                        │
│  │   DASHBOARD   │                                                        │
│  │   (Next.js)   │                                                        │
│  │   Port 3000   │                                                        │
│  └───────────────┘                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Component Breakdown

#### **Tier 1: Data Collection (Kitchen)**
- **Scrape Service**: Orchestrates all scrapers
  - Meta Ads via Apify (`metaAdsScraper.ts`)
  - Facebook Posts via Apify (`facebookPostsScraper.ts`)
  - Facebook Page Metrics via Playwright (`facebookPage.ts`)
  - Google Trends data (`googleTrends.ts`)

#### **Tier 2: Data Analysis (Processing)**
- **Health Score Calculator**: 5 dimensions (ad volume, freshness, creativity, strategy diversity, engagement)
- **Strategy Classifier**: Extracts marketing strategies via LLM
- **Pricing Extractor**: Parses room rates and discounts from ads
- **Alert Detector**: Identifies significant competitor movements
- **Recommendation Engine**: Generates actionable insights

#### **Tier 3: Report Generation**
- **Intelligence Generator**: Creates narrative summaries with LLM
- **PDF Generator**: Renders HTML → PDF with charts
- **Chart Engine**: Generates visualization PNGs
- **Email Service**: Distributes via Resend

#### **Tier 4: API & Dashboard**
- **Express REST API**: 5 router modules (competitors, pipeline, reports, alerts, health)
- **Next.js Dashboard**: 5 pages (home, competitors, pipeline, reports, alerts)
- **Real-time Status**: WebSocket-ready architecture

---

## TECHNOLOGY STACK

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Language** | TypeScript (ESM) | 5.7+ | Type safety, NodeNext imports |
| **CLI Tool** | Commander.js | 12.1.0 | CLI interface |
| **Backend Framework** | Express.js | 5.2.1 | REST API server |
| **Frontend Framework** | Next.js | Latest | Server-side & client-side rendering |
| **Database** | PostgreSQL | 13+ | Relational storage |
| **ORM** | Drizzle ORM | 0.39.1 | Type-safe database queries |
| **API Gateway** | Apify | API v2 | Web scraping (Meta Ads, FB Posts) |
| **Browser Automation** | Playwright | 1.58.2 | Facebook page metrics scraping |
| **PDF Rendering** | Puppeteer | 24.1.1 | HTML → PDF conversion |
| **Chart Generation** | Skia Canvas | 1.0.2 | Server-side chart rendering |
| **AI/LLM** | Anthropic Claude (OpenRouter) | sonnet-4-5 | Analysis & content generation |
| **Email Service** | Resend | 4.1.2 | Email delivery |
| **Logging** | Winston | 3.17.0 | Structured logging with rotation |
| **Task Scheduling** | node-cron | 3.0.3 | Recurring pipeline execution |

---

## CORE FEATURES

### Feature 1: Competitor Scraping
**Purpose**: Collect real-time marketing data from competitors

**Data Sources**:
- **Meta Ads Library**: 50+ ads per competitor
- **Facebook Pages**: Follower count, engagement metrics, recent posts
- **Google Trends**: Market demand keywords over 90 days

**Scraped Data Types**:
- Ad copy, creative type, CTA, landing URL
- Post text, reactions, comments, shares, media
- Audience estimates, platform distribution
- Ad variant counts, run dates

**Execution**:
- CLI: `npm run dev:scrape -- -c 1,2,3`
- API: `POST /api/pipeline/scrape`
- Scheduler: Daily at 02:00 UTC

### Feature 2: Competitor Analysis
**Purpose**: Generate health scores and strategic insights

**Analysis Engines** (5 modules):

1. **Health Score Calculator**
   - Metric: 0–100 composite score
   - Dimensions: Ad Volume (20%), Freshness (20%), Creativity (20%), Strategy Diversity (20%), Engagement (20%)
   - Inputs: Ad count, newest ad date, creative variations, organic posts, page followers
   - Stores: `analyses.health_score`, `competitors.cached_health_score`

2. **Strategy Classifier (LLM)**
   - Input: Ad copy, page content, targeting signals
   - Output: Marketing strategy narrative (EN + TH)
   - Model: Anthropic Claude (OpenRouter)
   - Stores: `analyses.marketing_strategy_en/th`, `analyses.key_usp_en/th`

3. **Pricing Extractor**
   - Input: Ad copy and landing page data
   - Output: Extracted room rates, discounts, packages
   - Stores: `analyses.pricing_data` (JSONB)

4. **Alert Detector**
   - Triggers: New campaign, price change, ad volume spike, viral content, competitor entry
   - Severity: Info, Warning, Critical
   - Stores: `alerts`, `report_alerts`

5. **Recommendation Engine**
   - Input: Competitor data, customer profile, market trends
   - Output: Actionable recommendations with priority
   - Stores: In report metadata

**Execution**:
- CLI: `npm run dev:analyze`
- API: `POST /api/pipeline/analyze`
- Scheduler: Daily at 04:00 UTC

### Feature 3: Report Generation
**Purpose**: Create executive-ready intelligence PDF

**Report Contents**:
- Market overview (total ads, active competitors, avg health score)
- Competitor rankings (health score, paid score, organic score)
- Per-competitor deep dive (ads, strategy, pricing, alerts)
- Market insights and trends
- Critical alerts and recommendations
- Visualizations (6+ charts)

**Execution**:
- CLI: `npm run dev:generate`
- API: `POST /api/pipeline/generate`
- Scheduler: Weekly on Monday 06:00 UTC

**Output**: PDF file + database record in `reports` table

### Feature 4: Automated Email Delivery
**Purpose**: Distribute intelligence to stakeholders

**Features**:
- HTML email with embedded summary
- PDF attachment with full report
- Scheduled or on-demand delivery
- Recipient management via config
- Delivery tracking in `report_access_log`

**Execution**:
- CLI: `npm run dev:deliver`
- API: `POST /api/pipeline/deliver`
- Scheduler: Weekly on Monday 07:00 UTC

### Feature 5: Dashboard & Real-Time Monitoring
**Purpose**: Visualize market intelligence and manage system

**Pages**:
1. **Home (Overview)**
   - Market metrics cards (total competitors, ads, avg health score)
   - Top 5 competitors by health score
   - Share of Voice (SOV) breakdown
   - Recent alerts and trends

2. **Competitors**
   - List all competitors with health scores
   - Add/edit/delete competitors
   - Toggle active status
   - View per-competitor details (ads, posts, metrics)

3. **Pipeline**
   - Trigger manual scrape/analyze/generate/deliver
   - View pipeline run history
   - Monitor progress in real-time
   - Download reports

4. **Reports**
   - List all generated reports
   - Filter by date, client, status
   - View/download PDF
   - Access report metadata

5. **Alerts**
   - Filter by type, severity, competitor
   - Acknowledge or dismiss alerts
   - View alert history and trends

---

## API SPECIFICATION

### Base Configuration
- **Base URL**: `http://localhost:3001/api`
- **Authentication**: None (internal only)
- **Content-Type**: `application/json`
- **Timeout**: 30 seconds

### Route 1: Competitors Management

#### GET /api/competitors
List all competitors with health scores
```json
Query Parameters:
  - active: boolean (filter by active status)
  - category: string (filter by category)

Response:
{
  "success": true,
  "count": 12,
  "data": [
    {
      "id": 1,
      "name": "Centara Grand",
      "facebookPageId": "samui.w.samui",
      "facebookPageUrl": "https://facebook.com/...",
      "adsLibraryUrl": "https://facebook.com/ads/library/...",
      "category": "hotel",
      "priceTier": "premium",
      "isCustomer": false,
      "isActive": true,
      "cachedHealthScore": 78.5,
      "cachedShareOfVoice": 12.3,
      "cachedThreatLevel": "medium",
      "positioningSimilarity": "high",
      "estimatedDailySpend": "$100-150",
      "spendTier": "moderate",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2026-03-11T12:00:00Z"
    }
  ]
}
```

#### GET /api/competitors/:id
Get detailed competitor profile
```json
Response:
{
  "success": true,
  "data": {
    "competitor": { /* competitor object */ },
    "latestAnalysis": {
      "healthScore": 78.5,
      "paidScore": 82,
      "organicScore": 75,
      "threatLevel": "medium",
      "trend": "rising",
      "shareOfVoice": 12.3,
      "marketingStrategyEn": "Focus on family packages and wellness retreats...",
      "keyUspEn": "Beachfront location with premium amenities",
      "analysisDate": "2026-03-11"
    },
    "topAds": [ /* 5 most recent ads */ ],
    "topPosts": [ /* 5 top-performing posts */ ],
    "pageMetrics": {
      "followers": 15000,
      "pageLikes": 14500,
      "rating": 4.7,
      "reviewCount": 2300,
      "postsLast30d": 24,
      "avgEngagementRate": 3.2
    },
    "recentAlerts": [ /* last 5 alerts */ ]
  }
}
```

#### POST /api/competitors
Create new competitor
```json
Body:
{
  "name": "New Resort",
  "facebookPageId": "new.resort.hua.hin",
  "facebookPageUrl": "https://facebook.com/new.resort.hua.hin",
  "adsLibraryUrl": "https://facebook.com/ads/library/...",
  "category": "hotel",
  "priceTier": "mid-range",
  "isCustomer": false
}

Response:
{
  "success": true,
  "data": { "id": 13, ...newCompetitor }
}
```

#### PUT /api/competitors/:id
Update competitor details
```json
Body: { /* partial competitor object */ }
Response: { "success": true, "data": { ...updatedCompetitor } }
```

#### DELETE /api/competitors/:id
Delete competitor (soft delete via status)
```json
Response: { "success": true, "message": "Competitor deleted" }
```

#### PATCH /api/competitors/:id/toggle
Toggle competitor active status
```json
Response: { "success": true, "data": { "isActive": true } }
```

### Route 2: Pipeline Control

#### POST /api/pipeline/run
Execute full pipeline (scrape → analyze → generate → deliver)
```json
Body:
{
  "competitors": [1, 2, 3],  // optional: limit to specific IDs
  "dryRun": false             // optional: preview only
}

Response:
{
  "success": true,
  "data": {
    "runId": "run_20260311_120000",
    "status": "running",
    "startedAt": "2026-03-11T12:00:00Z",
    "stage": "scrape"
  }
}
```

#### POST /api/pipeline/scrape
Trigger scrape stage only
```json
Body: { "competitors": [1, 2] }
Response: { "success": true, "data": { "scrapedAds": 145, "scrapedPosts": 89 } }
```

#### POST /api/pipeline/analyze
Trigger analysis stage only
```json
Body: { "competitors": [1, 2] }
Response: { "success": true, "data": { "healthScoresCalculated": 2 } }
```

#### POST /api/pipeline/generate
Generate new report
```json
Body: {}
Response: { "success": true, "data": { "reportId": 5, "pdfPath": "/data/exports/..." } }
```

#### POST /api/pipeline/deliver
Send latest report via email
```json
Body: { "recipients": ["user@example.com"] }  // optional override
Response: { "success": true, "data": { "sentTo": 1 } }
```

#### GET /api/pipeline/status/:runId
Get pipeline run status
```json
Response:
{
  "success": true,
  "data": {
    "id": "run_20260311_120000",
    "status": "completed",
    "stage": "deliver",
    "startedAt": "2026-03-11T12:00:00Z",
    "completedAt": "2026-03-11T12:35:00Z",
    "results": {
      "scrape": { "adsScraped": 145 },
      "analyze": { "healthScoresCalculated": 2 },
      "generate": { "reportId": 5 },
      "deliver": { "sentTo": 1 }
    }
  }
}
```

#### GET /api/pipeline/runs
List recent pipeline runs
```json
Query Parameters:
  - limit: number (default: 20)
  - offset: number (default: 0)

Response:
{
  "success": true,
  "count": 5,
  "data": [ /* array of pipeline runs */ ]
}
```

### Route 3: Reports Management

#### GET /api/reports
List all reports
```json
Query Parameters:
  - clientName: string (filter)
  - status: string (active|archived|deleted)
  - year: number (2026)
  - month: number (1-12)
  - limit: number (default: 50)
  - offset: number (default: 0)

Response:
{
  "success": true,
  "count": 12,
  "data": [
    {
      "id": 1,
      "reportUuid": "uuid-1234",
      "title": "Market Intelligence - March 2026",
      "clientName": "Internal",
      "marketLocation": "Hua Hin, Thailand",
      "reportMonth": 3,
      "reportYear": 2026,
      "reportDate": "2026-03-11T00:00:00Z",
      "competitorsCount": 12,
      "activeAdvertisers": 11,
      "totalActiveAds": 145,
      "status": "active",
      "metadata": {
        "marketStatus": "hot",
        "biggestOpportunity": "Wedding segment growing 23%",
        "biggestThreat": "Price wars in budget segment",
        "top3Insights": [ "...", "...", "..." ]
      },
      "createdAt": "2026-03-11T06:00:00Z"
    }
  ]
}
```

#### GET /api/reports/:uuid
Get report metadata (no HTML)
```json
Response:
{
  "success": true,
  "data": {
    "id": 1,
    "reportUuid": "uuid-1234",
    ...reportData (htmlContent omitted)
  }
}
```

#### GET /api/reports/:uuid/pdf
Download report as PDF file
```
Response: Binary PDF file (application/pdf)
```

#### GET /api/reports/:uuid/view
View report in browser (HTML)
```
Response: HTML page render
```

#### GET /api/reports/trends/:name
Get competitor performance trend across months
```json
Query Parameters:
  - months: number (default: 6)

Response:
{
  "success": true,
  "count": 6,
  "data": [
    {
      "month": 10,
      "year": 2025,
      "healthScore": 72,
      "totalActiveAds": 34,
      "trend": "stable"
    },
    ...
  ]
}
```

### Route 4: Alerts Management

#### GET /api/alerts
List alerts with filtering
```json
Query Parameters:
  - type: string (new_campaign|price_change|viral_content|threat_escalation)
  - severity: string (info|warning|critical)
  - competitorId: number
  - isSent: boolean
  - limit: number (default: 50)

Response:
{
  "success": true,
  "total": 23,
  "data": [
    {
      "id": 1,
      "alertDate": "2026-03-11",
      "alertType": "new_campaign",
      "severity": "warning",
      "competitorId": 3,
      "competitorName": "Beach Resort",
      "title": "New Wedding Campaign Launched",
      "description": "5 new ads focused on wedding packages detected",
      "actionRequired": "Review pricing strategy for wedding segment",
      "isSent": false,
      "createdAt": "2026-03-11T10:00:00Z"
    }
  ]
}
```

#### POST /api/alerts/:id/acknowledge
Mark alert as sent/acknowledged
```json
Response: { "success": true, "data": { "isSent": true, "sentAt": "2026-03-11T10:05:00Z" } }
```

### Route 5: Health & Monitoring

#### GET /api/health
System health status
```json
Response:
{
  "status": "healthy",
  "uptime": 3600000,
  "database": {
    "status": "connected",
    "responseTime": "2ms"
  },
  "timestamp": "2026-03-11T12:00:00Z"
}
```

#### GET /api/health/market
Market overview aggregates
```json
Response:
{
  "success": true,
  "data": {
    "totalCompetitors": 12,
    "activeCompetitors": 11,
    "totalActiveAds": 145,
    "avgHealthScore": 74.2,
    "avgShareOfVoice": 8.33,
    "threatDistribution": {
      "low": 4,
      "medium": 5,
      "high": 2,
      "critical": 0
    },
    "trendDistribution": {
      "rising": 3,
      "stable": 7,
      "declining": 2
    }
  }
}
```

#### GET /api/health/leaderboard
Top competitors by health score
```json
Response:
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "competitorId": 2,
      "competitorName": "Centara Grand",
      "totalScore": 85.3,
      "paidScore": 88,
      "organicScore": 82,
      "threatLevel": "high",
      "trend": "rising",
      "totalActiveAds": 34
    }
  ]
}
```

#### GET /api/health/sov
Share of Voice breakdown
```json
Response:
{
  "success": true,
  "data": [
    {
      "competitorId": 1,
      "competitorName": "Hotel A",
      "totalActiveAds": 45,
      "shareOfVoice": 31.0,
      "trend": "rising"
    }
  ]
}
```

---

## DATABASE SCHEMA

### Complete Schema Overview

```sql
-- Total: 14 tables across 4 functional domains

-- DOMAIN 1: COMPETITOR MASTER DATA (2 tables)
-- Stores competitor information and their market segments

1. competitors (primary)
   - id (PK)
   - name, facebook_page_id, facebook_page_url, ads_library_url
   - category (hotel, resort, villa, etc.)
   - price_tier (budget, mid-range, premium, luxury)
   - is_customer, is_active
   - cached_health_score, cached_share_of_voice, cached_threat_level
   - positioning_similarity, estimated_daily_spend, spend_tier
   - created_at, updated_at

2. competitor_segments (transactional)
   - id (PK)
   - competitor_id (FK → competitors, cascade)
   - segment_name (family, couples, weddings, mice, wellness, pets, international, solo, thai_residents)
   - is_active
   - created_at


-- DOMAIN 2: MARKETING INTELLIGENCE (5 tables)
-- Stores ad data, page metrics, posts, and trends

3. ads (transactional)
   - id (PK)
   - competitor_id (FK → competitors, cascade)
   - meta_ad_id (unique), ad_archive_id
   - started_running, start_date, end_date, ad_creation_time
   - is_active, ad_status
   - platforms (JSONB: ['facebook', 'instagram'])
   - creative_type, creative_type_enum (image, video, carousel, collection)
   - ad_copy, ad_text, ad_creative_bodies (JSONB array)
   - headline, cta_type, cta_headline, cta_description, cta_domain
   - landing_url, ad_snapshot_url, ad_library_url
   - extracted_price, extracted_price_str, extracted_discount, discount_depth
   - category_tag, ad_variations_count, is_high_focus
   - estimated_audience_size
   - publisher_platforms (JSONB)
   - roi_confidence, language
   - scraped_at, created_at, updated_at

4. facebook_pages (metrics snapshot)
   - id (PK)
   - competitor_id (FK → competitors, cascade)
   - page_url
   - followers, page_likes, rating, review_count
   - posts_last_30d, avg_engagement_rate
   - last_post_date
   - scraped_at, created_at

5. facebook_posts (transactional)
   - id (PK)
   - competitor_id (FK → competitors, cascade)
   - post_id (unique), post_url
   - post_type (photo, video, reel, story, link, text, event, live_video, unknown)
   - post_text, posted_at
   - reactions, comments, shares, video_views
   - likes, views_count
   - reaction_like_count, reaction_love_count, reaction_wow_count, reaction_haha_count, reaction_care_count
   - content_category, language, is_top_performer
   - media_type, thumbnail_url
   - engagement_score
   - scraped_at, created_at, updated_at

6. trends (time-series)
   - id (PK)
   - trend_date, source (google_trends, facebook_insights, meta_ads_library, manual)
   - keyword
   - value (numeric), change_pct
   - metadata (JSONB)
   - created_at


-- DOMAIN 3: ANALYSIS & INTELLIGENCE (3 tables)
-- Stores computed scores, strategies, and alerts

7. analyses (computed snapshot)
   - id (PK)
   - competitor_id (FK → competitors, cascade)
   - analysis_date (unique per competitor)
   - total_active_ads, newest_ad_date
   - ad_types (JSONB array), target_segments (JSONB array)
   - pricing_data (JSONB with room_rates, discounts, packages)
   - marketing_strategy_en, marketing_strategy_th
   - key_usp_en, key_usp_th
   - health_score, paid_score, organic_score
   - threat_level, trend (rising, stable, declining, new)
   - share_of_voice
   - created_at, updated_at

8. alerts (transaction log)
   - id (PK)
   - alert_date, alert_type, severity
   - competitor_id (FK → competitors, cascade)
   - title, description, action_required
   - is_sent, sent_at
   - created_at

9. report_alerts (report-level alerts)
   - id (PK)
   - alert_date, severity, alert_type, message, message_thai
   - competitor_id (FK → competitors, set null)
   - is_actionable
   - created_at


-- DOMAIN 4: REPORTING & HISTORY (4 tables)
-- Stores report generation and access tracking

10. reports (main report record)
    - id (PK)
    - report_uuid (unique)
    - title, client_name, market_location
    - report_month, report_year, report_date
    - competitors_count, active_advertisers, total_active_ads
    - html_content (large text)
    - metadata (JSONB: market_status, insights, threats, opportunities)
    - generated_by, llm_model_used, generation_time_sec
    - status (active, archived, deleted)
    - created_at, updated_at, deleted_at

11. report_competitors (per-report competitor snapshot)
    - id (PK)
    - report_id (FK → reports, cascade)
    - competitor_name, facebook_page_id, facebook_page_url
    - total_active_ads, health_score, budget_tier, threat_level
    - is_new_entrant, is_market_leader
    - newest_ad_date
    - ad_types, target_segments (JSONB)
    - key_usp_en, marketing_strategy_en, pricing_info
    - language_split, estimated_ad_spend, competitor_html
    - created_at

12. report_access_log (audit trail)
    - id (PK)
    - report_id (FK → reports, cascade)
    - report_uuid
    - accessed_by, access_type (metadata, pdf_download, view, email)
    - ip_address
    - accessed_at


-- DOMAIN 5: HISTORICAL TRACKING (2 tables)

13. follower_history (time-series tracking)
    - id (PK)
    - competitor_id (FK → competitors, cascade)
    - recorded_date (unique per competitor)
    - followers, previous_followers
    - change_absolute, change_pct
    - created_at

14. market_snapshots (daily market state)
    - id (PK)
    - snapshot_date (unique)
    - total_active_ads, active_advertisers, total_competitors
    - market_leader_id (FK → competitors, set null)
    - client_ad_count, client_sov
    - created_at

15. pipeline_runs (execution audit trail)
    - id (PK) - uuid
    - status (running, completed, failed)
    - stage (scrape, analyze, generate, deliver, idle)
    - started_at, completed_at
    - results (JSONB with per-stage results)
    - error (nullable)
    - dry_run
```

### Key Indexes
- Competitors: `facebook_page_id` (unique), `is_active`, `category`, `spend_tier`
- Ads: `meta_ad_id` (unique), `competitor_id`, `is_active`, `scraped_at`, `creative_type`, `category_tag`
- Facebook Posts: `post_id` (unique), `competitor_id`, `posted_at`, `is_top_performer`
- Analyses: `competitor_id + analysis_date` (unique), `threat_level`, `health_score`
- Alerts: `alert_date`, `competitor_id`, `severity`, `alert_type + alert_date`
- Reports: `report_uuid` (unique), `status`, `report_date`
- Market Snapshots: `snapshot_date` (unique)
- Competitor Segments: `competitor_id + segment_name` (unique)

---

## DATA FLOW & PIPELINE

### Complete Data Journey

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          COMPETITOR INTELLIGENCE PIPELINE                    │
└──────────────────────────────────────────────────────────────────────────────┘

STAGE 1: SCRAPE (Runs Daily @ 02:00 UTC)
──────────────────────────────────────────────────────────────────────────────

Input Sources:
  ├─ Meta Ads Library API
  │  └─ Apify Actor: metaAdsScraper.ts
  │     ├─ Fetches 50 latest ads per competitor
  │     ├─ Extracts: meta_ad_id, ad_copy, creative_type, cta, platforms
  │     ├─ Maps to: ads table
  │     └─ Deduplicates by meta_ad_id (updates if exists)
  │
  ├─ Facebook Page Posts
  │  └─ Apify Actor: facebookPostsScraper.ts
  │     ├─ Fetches recent 30 posts
  │     ├─ Extracts: post_id, post_text, reactions, comments, shares
  │     ├─ Maps to: facebook_posts table
  │     └─ Calculates engagement metrics
  │
  ├─ Facebook Page Metrics
  │  └─ Playwright: facebookPage.ts
  │     ├─ Opens Facebook page in browser
  │     ├─ Extracts: followers, likes, rating, engagement_rate
  │     ├─ Maps to: facebook_pages table
  │     └─ Snapshot per scrape
  │
  └─ Google Trends
     └─ googleTrends.ts
        ├─ Queries: 10 configurable keywords
        ├─ Extracts: trend_date, keyword, value, change_pct
        ├─ Maps to: trends table
        └─ 24-hour cache per keyword

Process Flow:
  1. ScrapeService.run() loops through competitors
  2. For each competitor:
     a. Call scrapeCompetitorMetaAds() → Array<RawAd>
     b. Call scrapeCompetitorFacebookPosts() → Array<RawPost>
     c. Call FacebookPageScraper.scrape() → PageMetrics
     d. Call GoogleTrendsFetcher.fetch() → Array<TrendData>
  3. Map raw data to database types via mappers
  4. Insert/update via insertAds(), insertPost(), insertPageMetrics(), insertTrend()
  5. Mark old ads as inactive: markAdsInactive()
  6. Log results: { adsScraped, postsScraped, pagesScraped, trendsScraped }

Database Changes:
  ├─ ads table: 145 rows inserted/updated
  ├─ facebook_posts table: 89 rows inserted
  ├─ facebook_pages table: 12 rows inserted (snapshots)
  ├─ trends table: 10 rows inserted
  └─ followers_history table: 12 rows inserted (daily snapshots)

Output:
  └─ ScrapeResult: { adsScraped, pagesScraped, postsScraped, trendsScraped, errors }


STAGE 2: ANALYZE (Runs Daily @ 04:00 UTC)
──────────────────────────────────────────────────────────────────────────────

Input Data:
  ├─ Latest ads for each competitor
  ├─ Latest page metrics
  ├─ Recent posts (30 days)
  ├─ Customer data (if internal competitor)
  ├─ Market data (trends, SOV)
  └─ Previous analysis records

Analysis Engines (5 Modules):

  1. HEALTH SCORE CALCULATOR
     ├─ Input: Ad count, newest ad date, max variations, strategy count, engagement
     ├─ Formula: 5 dimensions × 20 points each
     │   ├─ Ad Volume: Math.min(adCount / marketLeader, 1) × 20
     │   ├─ Freshness: Decays from 20 (fresh) to 0 (>90 days old)
     │   ├─ Creativity: Math.min(maxVariations / 8, 1) × 20
     │   ├─ Strategy Diversity: Math.min(strategiesCount / 7, 1) × 20
     │   └─ Engagement: Math.min(engagementRate / 5%, 1) × 20
     ├─ Output: totalScore (0–100), paidScore, organicScore
     └─ Stores: analyses.health_score, competitors.cached_health_score

  2. STRATEGY CLASSIFIER (LLM-powered)
     ├─ Input: Top 5 ads (copy, creative type), last 10 posts, page bio
     ├─ LLM Model: Anthropic Claude (OpenRouter)
     ├─ Prompt Template: (see LLM Integration section)
     ├─ Output:
     │   ├─ marketingStrategyEn (5-10 sentences)
     │   ├─ marketingStrategyTh (Thai translation)
     │   ├─ keyUspEn (1-2 sentences)
     │   └─ keyUspTh (Thai translation)
     └─ Stores: analyses.marketing_strategy_en/th, analyses.key_usp_en/th

  3. PRICING EXTRACTOR
     ├─ Input: Ad copy text, extracted headlines
     ├─ Logic: Regex patterns for prices (numbers + currency)
     ├─ Output:
     │   ├─ roomRates: Array<{ roomType, pricePerNight, currency }>
     │   ├─ discounts: Array<{ description, discountPct, validUntil }>
     │   ├─ packagePrices: Array<{ name, price, inclusions }>
     │   └─ pricePosition: (cheapest, below_average, average, above_average, premium)
     └─ Stores: analyses.pricing_data (JSONB)

  4. ALERT DETECTOR
     ├─ Comparison: Current vs. last analysis snapshot
     ├─ Alert Types:
     │   ├─ NewCampaign: Ads increased >20% in 7 days
     │   ├─ PriceChange: Room rates changed >5%
     │   ├─ HighAdVolume: Ads >90th percentile
     │   ├─ ViralContent: Post reactions >5000
     │   ├─ NewCompetitor: New competitor entry detected
     │   ├─ ThreatEscalation: Health score increased to "high"
     │   ├─ EngagementSpike: Engagement rate >10% increase
     │   └─ PageMilestone: Followers >10k, 50k, 100k
     ├─ Severity Mapping: info, warning, critical
     └─ Stores: alerts, report_alerts tables

  5. RECOMMENDATION ENGINE
     ├─ Input: Competitor data, customer profile, market analysis
     ├─ Logic:
     │   ├─ Compare customer vs. market (health score, SOV, pricing)
     │   ├─ Identify gaps (features, channels, pricing)
     │   ├─ Generate 3-5 actionable recommendations
     │   └─ Assign priority: low, medium, high, urgent
     └─ Returns: Array<Recommendation> (used in report)

Process Flow:
  1. AnalysisService.run() loads target competitors
  2. For each competitor:
     a. Load latest ad set from ads table
     b. Load latest page metrics from facebook_pages table
     c. Load recent posts from facebook_posts table
     d. Calculate health score via HealthScoreCalculator
     e. Classify strategy via LLM (StrategyClassifier)
     f. Extract pricing via PricingExtractor
     g. Detect alerts via AlertDetector
     h. Generate recommendations via RecommendationEngine
  3. Insert analysis record: insertAnalysis()
  4. Update competitor cache: UPDATE competitors SET cached_health_score = X
  5. Insert alerts: insertAlert() for each detected alert
  6. Log results: { healthScoresCalculated, strategiesClassified, alertsGenerated }

Database Changes:
  ├─ analyses table: 12 rows inserted (one per competitor)
  ├─ competitors table: 12 cached fields updated
  ├─ alerts table: 5-10 new rows (varies)
  └─ report_alerts table: 5-10 new rows

Output:
  └─ AnalysisResult: { competitorsAnalyzed, healthScoresCalculated, alertsGenerated }


STAGE 3: GENERATE (Runs Weekly @ Monday 06:00 UTC)
──────────────────────────────────────────────────────────────────────────────

Input Data:
  ├─ All latest analyses
  ├─ Market overview (SOV, avg health score)
  ├─ Recent alerts
  ├─ Competitor rankings
  ├─ Chart data (6+ visualizations)
  └─ Report metadata (market status, opportunities, threats)

Process Flow:
  1. ReportService.run() queries aggregated data
  2. Generate 6+ charts via Chart.js/Skia Canvas:
     ├─ Health Score Comparison (bar chart)
     ├─ Share of Voice (pie chart)
     ├─ Ad Volume Timeline (line chart)
     ├─ Engagement Rates (radar chart)
     ├─ Threat Levels (horizontal bar)
     └─ Trend Distribution (doughnut)
  3. Render HTML via Nunjucks template:
     ├─ Executive Summary
     ├─ Market Overview section
     ├─ Per-competitor deep dives
     ├─ Alert summary
     ├─ Recommendations
     └─ Embedded chart images (PNG)
  4. Convert HTML → PDF via Puppeteer
  5. Insert report record: insertReport()
  6. Insert report_competitors records: 12 per-competitor snapshots
  7. Return: { reportId, pdfPath }

Template Variables:
  {
    "reportTitle": "Hua Hin Market Intelligence - March 2026",
    "reportDate": "2026-03-11",
    "periodStart": "2026-03-01",
    "periodEnd": "2026-03-11",
    "marketOverview": {
      "totalCompetitors": 12,
      "activeCompetitors": 11,
      "totalActiveAds": 145,
      "avgHealthScore": 74.2,
      "avgShareOfVoice": 8.33,
      "threatDistribution": { "low": 4, "medium": 5, "high": 2, "critical": 0 },
      "trendDistribution": { "rising": 3, "stable": 7, "declining": 2 }
    },
    "competitors": [ /* per-competitor data */ ],
    "healthScoreRankings": [ /* top-to-bottom */ ],
    "criticalAlerts": [ /* highest severity */ ],
    "recommendations": [ /* actionable items */ ],
    "charts": {
      "healthScoreComparison": "/tmp/health_score.png",
      "shareOfVoice": "/tmp/sov.png",
      ...
    }
  }

Database Changes:
  ├─ reports table: 1 new row
  ├─ report_competitors table: 12 new rows
  └─ market_snapshots table: 1 new row (daily)

Output:
  └─ ReportData: { reportDate, title, generatedAt, marketOverview, competitors, charts }


STAGE 4: DELIVER (Runs Weekly @ Monday 07:00 UTC)
──────────────────────────────────────────────────────────────────────────────

Input:
  ├─ Latest report PDF
  ├─ Configured recipients from settings.email.recipients
  └─ Report metadata

Process Flow:
  1. DeliveryService.run() loads latest report
  2. Generate HTML email summary (Handlebars template)
  3. Embed executive summary in email body
  4. Attach PDF file
  5. Send via Resend API
  6. Update report status: status = 'delivered'
  7. Insert access log: reportAccessLog row
  8. Return: { sentTo: emailCount, deliveryId }

Email Structure:
  ├─ Subject: "Market Intelligence Report - March 2026"
  ├─ From: EMAIL_FROM setting
  ├─ To: EMAIL_RECIPIENTS setting
  ├─ HTML Body:
  │  ├─ Header with logo
  │  ├─ Executive summary (top insights)
  │  ├─ Market status (hot/heating/stable/cooling)
  │  ├─ Top 3 opportunities
  │  ├─ Top 3 threats
  │  └─ Link to dashboard
  └─ Attachment: PDF file (Hua_Hin_Intelligence_2026-03.pdf)

Database Changes:
  ├─ reports table: status updated to 'delivered'
  └─ report_access_log table: 1 row per recipient (email access)

Output:
  └─ DeliveryResult: { sentTo: number, deliveryErrors: string[] }
```

---

## LLM INTEGRATION

### LLM Provider Configuration

**Primary Provider**: OpenRouter (Claude via anthropic-ai/claude-sonnet-4-5)
**Fallback Provider**: Google Gemini 2.0 Flash
**Base URL**: `https://openrouter.ai/api/v1`
**API Key**: `OPENROUTER_API_KEY` environment variable

### LLM Client Initialization

```typescript
// src/intelligence/llmAnalyzer.ts

const client = new OpenAI({
  baseURL: OPENROUTER_BASE_URL,
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://pratap.ai',
    'X-Title': 'Hua Hin Competitor Intelligence',
  },
});
```

### LLM Prompt Templates

#### 1. Strategy Classification Prompt

**Purpose**: Extract marketing strategies from competitor ad data and content

**Input Data**:
```json
{
  "competitorName": "Centara Grand",
  "topAds": [
    {
      "adCopy": "Luxury beachfront resort with world-class amenities",
      "headline": "Dream Wedding Destination",
      "creativeType": "video",
      "ctaType": "BOOK_NOW"
    }
    // ... 5 ads total
  ],
  "recentPosts": [
    {
      "text": "Join us for romantic sunset dinners by the beach",
      "reactions": 450,
      "contentCategory": "promotion"
    }
    // ... 10 posts total
  ],
  "pageMetrics": {
    "followers": 15000,
    "avgEngagementRate": 3.2,
    "postsLast30d": 24
  }
}
```

**System Prompt**:
```
You are a hospitality market intelligence expert analyzing competitor marketing strategies.
Analyze the provided ads, social posts, and page metrics to identify:
1. Primary target segments (families, couples, weddings, wellness, pets, business travelers, etc.)
2. Key marketing themes and messaging strategies
3. Unique selling propositions (USPs)
4. Seasonal or promotional focus areas
5. Digital presence strength assessment

Provide insights in both English and Thai language translations.
```

**User Prompt**:
```
Analyze this hotel competitor's marketing data:

Competitor: {competitorName}
Followers: {followers}
Average Engagement Rate: {avgEngagementRate}%
Posts (Last 30d): {postsLast30d}

TOP 5 ADS:
{topAds map (ad) => `- ${ad.headline}: ${ad.adCopy} [${ad.creativeType}]`}

RECENT POSTS (Top 10 by engagement):
{recentPosts map (post) => `- "${post.text}" (${post.reactions} reactions, ${post.contentCategory})`}

TASK:
1. Summarize their marketing strategy in 5-10 sentences (EN and TH)
2. Identify their key unique selling proposition (1-2 sentences)
3. List 3-5 primary target segments with confidence levels
4. Rate their overall digital marketing maturity (1-10)

Format response as JSON:
{
  "marketingStrategyEn": "...",
  "marketingStrategyTh": "...",
  "keyUspEn": "...",
  "keyUspTh": "...",
  "targetSegments": [
    {"segment": "...", "confidence": "high|medium|low"}
  ],
  "digitalMaturityScore": 7
}
```

**Model Parameters**:
- Model: `anthropic/claude-sonnet-4-5`
- Temperature: 0.3 (deterministic)
- Max Tokens: 1500
- Timeout: 30 seconds
- Retries: 2

**Output Handling**:
```typescript
interface StrategyAnalysisResult {
  marketingStrategyEn: string;
  marketingStrategyTh: string;
  keyUspEn: string;
  keyUspTh: string;
  targetSegments: Array<{
    segment: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  digitalMaturityScore: number;
}

// Stores in: analyses.marketing_strategy_en/th, analyses.key_usp_en/th
```

#### 2. Recommendation Generation Prompt

**Purpose**: Generate actionable strategic recommendations based on competitive gap analysis

**Input Data**:
```json
{
  "customerProfile": {
    "name": "Our Hotel",
    "healthScore": 65,
    "shareOfVoice": 8.5,
    "priceTier": "premium",
    "activeAds": 12
  },
  "marketData": {
    "avgHealthScore": 74.2,
    "medianAdCount": 28,
    "topCompetitorHealthScore": 88,
    "dominantSegments": ["families", "couples", "weddings"],
    "growingTrends": ["wellness", "eco-tourism"]
  },
  "competitorsAnalysis": [
    {
      "name": "Competitor A",
      "healthScore": 82,
      "strength": "High ad volume + frequent updates",
      "weakness": null
    }
  ]
}
```

**System Prompt**:
```
You are a strategic business consultant for the hospitality industry.
Based on competitive analysis and market data, provide 5 strategic recommendations.
Each recommendation should be:
- Specific and actionable
- Prioritized by impact
- Focused on addressing competitive gaps
- Realistic given current capabilities
- Aligned with market trends and opportunities
```

**User Prompt**:
```
Generate strategic recommendations for this hotel:

CUSTOMER PROFILE:
- Name: {customerProfile.name}
- Health Score: {customerProfile.healthScore}/100
- Share of Voice: {customerProfile.shareOfVoice}%
- Price Tier: {customerProfile.priceTier}
- Active Ads: {customerProfile.activeAds}

MARKET CONTEXT:
- Market Avg Health Score: {marketData.avgHealthScore}
- Market Median Ad Count: {marketData.medianAdCount}
- Top Competitor Score: {marketData.topCompetitorHealthScore}
- Dominant Segments: {marketData.dominantSegments.join(', ')}
- Growing Trends: {marketData.growingTrends.join(', ')}

TOP COMPETITORS:
{competitorsAnalysis.slice(0,3).map(c => `- ${c.name}: Score ${c.score}, Strength: ${c.strength}`)}

TASK:
Generate 5 strategic recommendations in priority order:
1. Format: { priority: "urgent|high|medium|low", title: "...", description: "..." }
2. Focus on: Ad strategy, pricing strategy, segment targeting, content direction
3. Include estimated impact and effort level

Format response as JSON array of recommendations.
```

**Output Handling**:
```typescript
interface Recommendation {
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedImpact: string;
  actionItems: string[];
  relatedCompetitors: Array<{ id: number; name: string }>;
}

// Stores in: report metadata.recommendedUrgentActions[]
```

### Cache Strategy

**Mechanism**: Disk-based MD5 hash caching

```typescript
// Cache key: MD5(model + prompt)
// Cache path: ./cache/llm/{key}.json
// TTL: 24 hours

function getCacheKey(prompt: string, model: string): string {
  const raw = `${model}::${prompt}`;
  return crypto.createHash('md5').update(raw, 'utf8').digest('hex');
}

// On cache hit: increment sessionStats.cacheHits
// On cache miss: make LLM call, save result with timestamp
```

### Cost Tracking

**Session Stats** (in-memory):
```typescript
{
  calls: number;              // Total LLM calls made
  promptTokens: number;       // Input tokens (cheaper)
  completionTokens: number;   // Output tokens (more expensive)
  totalTokens: number;        // promptTokens + completionTokens
  cacheHits: number;          // Requests served from cache
  errors: number;             // Failed API calls
}
```

**Rate Limits**:
- Max Tokens: 2000 per call
- Max Retries: 2
- Concurrent Requests: 5

**Error Handling**:
```typescript
async function callLLM(prompt: string): Promise<string> {
  let retries = 0;
  const maxRetries = MAX_RETRIES;

  while (retries <= maxRetries) {
    try {
      const response = await client.messages.create({
        model: PRIMARY_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        messages: [{ role: 'user', content: prompt }],
      });

      sessionStats.calls++;
      sessionStats.promptTokens += response.usage.input_tokens;
      sessionStats.completionTokens += response.usage.output_tokens;

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err) {
      retries++;
      if (retries >= maxRetries) {
        sessionStats.errors++;
        throw err;
      }
      await sleep(Math.pow(2, retries) * 1000); // Exponential backoff
    }
  }
}
```

### Monitored Metrics

- **Cost per Report**: Sum of tokens × (input_rate + output_rate)
- **Cache Hit Rate**: cacheHits / (calls + cacheHits)
- **Error Rate**: errors / calls
- **Average Latency**: (sum of response times) / calls

---

## FRONTEND FEATURES

### Dashboard Architecture

**Framework**: Next.js (App Router, Server Components)
**Styling**: TailwindCSS
**State Management**: React Query (data fetching)
**Charts**: Chart.js with React wrapper
**Deployment**: Vercel (recommended) or self-hosted

### Page 1: Home (Market Overview)

**Route**: `/`
**Components**:
- **Top Metrics Cards** (4-column grid)
  - Total Competitors: numeric display
  - Active Ads (market-wide): numeric display
  - Avg Health Score: gauge visual
  - Critical Alerts: badge count

- **Health Score Leaderboard** (Top 5 competitors)
  - Columns: Rank, Name, Total Score, Paid Score, Organic Score, Threat Level, Trend
  - Sortable by score
  - Color-coded threat levels (green/yellow/red)

- **Share of Voice Breakdown** (Pie chart)
  - Per-competitor percentage
  - Click to drill-down to competitor page

- **Recent Alerts Timeline** (Scrollable list)
  - Alert type, severity, competitor, timestamp
  - Filter by type/severity
  - "Acknowledge" action

- **Market Trends** (Line chart, 30-day)
  - Trend lines for top 5 keywords
  - Comparison vs. previous period

**Data Sources** (API calls):
- `GET /api/health/market` → Market overview
- `GET /api/health/leaderboard` → Rankings
- `GET /api/health/sov` → Share of Voice
- `GET /api/alerts` → Recent alerts
- `GET /api/health/trends` → Google Trends data

### Page 2: Competitors

**Route**: `/competitors`
**Sections**:

**A. Competitors List**
- Table with columns:
  - Name (with link to detail)
  - Facebook Followers
  - Health Score (color-coded)
  - Active Ads
  - Threat Level
  - Status (active/inactive toggle)
  - Actions (edit, delete, view detail)

- Filters:
  - Active/Inactive toggle
  - Category dropdown
  - Health Score range slider
  - Search by name

- Bulk Actions:
  - Toggle active status for multiple
  - Delete selected

**B. Add Competitor Modal**
- Form fields:
  - Name (required)
  - Facebook Page ID (required)
  - Category (dropdown)
  - Price Tier (dropdown)
  - Is Customer (checkbox)

- Validation:
  - Unique Facebook Page ID
  - Required fields highlighted
  - Facebook URL autocomplete

**C. Competitor Detail Page** (`/competitors/:id`)
- Overview cards:
  - Health Score, Paid Score, Organic Score
  - Threat Level, Trend direction
  - Follower count, Engagement rate
  - Share of Voice percentage

- Tabs:
  1. **Analysis Tab**
     - Latest health score components breakdown (radar chart)
     - Marketing strategy summary (text)
     - Key USP (text)
     - Pricing data (table: room types, rates, discounts)
     - Target segments (tags)

  2. **Ads Tab**
     - Table: Meta Ad ID, Copy, Creative Type, CTA, Status, Scraped Date
     - Filters: Active/Inactive, Creative Type, Date Range
     - View count: "12 active, 34 total"
     - Click ad row to expand details (full copy, platforms, audience estimate)

  3. **Posts Tab**
     - Card grid (recent 20 posts)
     - Per card: Post type, engagement (reactions/comments/shares)
     - Click to expand full post text
     - Filter: Date range, post type
     - Sort: Latest, Top Engagement

  4. **Metrics Tab**
     - Time-series charts:
       - Followers growth (line chart, 90-day)
       - Monthly ad count (bar chart, 6-month)
       - Engagement trend (line chart, 30-day)
     - Current snapshot: followers, likes, rating, avg engagement

  5. **Alerts Tab**
     - Timeline of alerts for this competitor
     - Alert type, severity, date, description
     - Filter: Type, Severity, Date

**Data Sources**:
- `GET /api/competitors` → List
- `GET /api/competitors/:id` → Detail
- `POST /api/competitors` → Create
- `PUT /api/competitors/:id` → Update
- `DELETE /api/competitors/:id` → Delete

### Page 3: Pipeline

**Route**: `/pipeline`
**Sections**:

**A. Quick Actions** (Button grid)
- Run Full Pipeline (scrape → analyze → generate → deliver)
- Scrape Only
- Analyze Only
- Generate Report
- Send Report Email
- (Each button opens modal with options)

**Modal Options**:
- Competitor selection (multi-select, default: all active)
- Dry Run (checkbox)
- Custom recipient (email input)
- Schedule (date/time picker, optional)

**B. Run History** (Timeline/Table)
- Columns: Run ID, Status (badge), Stage, Started, Duration, Results
- Color coding: green=completed, yellow=running, red=failed
- Click row to expand full details

**C. Real-time Status** (During execution)
- Animated stage progress:
  - Scrape Stage
    - ✓ Meta Ads: 145 ads
    - ✓ Facebook Posts: 89 posts
    - ✓ Page Metrics: 12 pages
    - ⏳ Google Trends: In progress...

  - Analyze Stage
    - Health scores calculated: 12
    - Strategies classified: 12
    - Alerts generated: 5

  - Generate Stage
    - Charts rendered: 6/6
    - PDF generated: 10 MB

  - Deliver Stage
    - Email sent to: 3 recipients
    - Delivery ID: dlv_xxxxx

**D. Logs Viewer**
- Real-time log stream (tail-like)
- Filterby level (info, warn, error)
- Searchable by keyword
- Auto-scroll toggle

**Data Sources**:
- `POST /api/pipeline/run` → Trigger pipeline
- `POST /api/pipeline/scrape` → Trigger scrape
- `POST /api/pipeline/analyze` → Trigger analyze
- `POST /api/pipeline/generate` → Trigger generate
- `POST /api/pipeline/deliver` → Trigger deliver
- `GET /api/pipeline/status/:runId` → Status polling
- `GET /api/pipeline/runs` → History

**WebSocket** (Optional, for real-time updates):
- Server sends pipeline status updates
- Client displays without polling

### Page 4: Reports

**Route**: `/reports`
**Sections**:

**A. Reports List**
- Table with columns:
  - Title (link to view)
  - Generated Date
  - Report Month/Year
  - Competitors Count
  - Status (badge)
  - Market Status (hot/heating/stable/cooling)
  - Actions (view, download PDF, delete)

- Filters:
  - Date range picker
  - Status (active, archived, deleted)
  - Client name (dropdown, or all)
  - Competitors count range

- Display:
  - 20 per page, pagination
  - Sort by date (desc), title, status

**B. Report Detail Page** (`/reports/:uuid`)
- Header:
  - Title, generation date, report period
  - Download PDF button
  - Share/Archive/Delete actions
  - Metadata: Market Status, Generated By, LLM Model Used

- Sections:
  1. **Executive Summary**
     - Market status narrative (hot/stable/cooling)
     - Top 3 insights (list)
     - Biggest opportunity (text)
     - Biggest threat (text)

  2. **Market Overview** (Cards + Chart)
     - Total competitors, active ads, avg health score
     - Threat distribution pie chart
     - Trend distribution bar chart

  3. **Competitor Rankings** (Table)
     - Rank, Name, Total Score, Paid Score, Organic Score, Threat, Trend
     - Sortable columns
     - Color-coded rows by health score

  4. **Top Insights** (Cards, 6-8 cards)
     - Pricing opportunity
     - Ad volume spike
     - New entrant alert
     - Engagement trend
     - Segment shift
     - Technology trend
     - Recommendation
     - Risk assessment

  5. **Recommendations** (Prioritized list)
     - By priority (urgent, high, medium, low)
     - Title, description, impact, action items
     - Related competitors

**C. Report Comparison** (Optional feature)
- Select 2 reports to compare
- Side-by-side comparison of:
  - Health score changes
  - Ad volume changes
  - Competitor movements (new, exited, tier changed)
  - Market trend changes

**Data Sources**:
- `GET /api/reports` → List
- `GET /api/reports/:uuid` → Detail
- `GET /api/reports/:uuid/pdf` → Download PDF
- `GET /api/reports/trends/:name` → Competitor trend over reports

### Page 5: Alerts

**Route**: `/alerts`
**Sections**:

**A. Alerts List** (Smart inbox)
- Filter panels:
  - Type (multi-select)
  - Severity (multi-select)
  - Competitor (multi-select)
  - Sent status (sent/unsent)
  - Date range

- Display:
  - Card view (default) or list view
  - Per card: Type badge, Severity color, Title, Description, Competitor, Date
  - Actions: Mark as sent, Delete, View Details

**B. Alert Details Modal**
- Full alert information:
  - Type, Severity, Competitor, Generated Date
  - Title and full description
  - Action Required (if any)
  - Sent/Unsent status + timestamp
  - Historical alerts of same type

**C. Alert Trends** (Tabs)
- By Type (bar chart, count per type)
- By Severity (pie chart)
- By Competitor (timeline of alerts per competitor)
- Frequency (alerts per day/week)

**D. Settings** (Alert Configuration)
- Alert type toggles (enable/disable type)
- Severity thresholds (adjust alert triggers)
- Recipient list (email addresses to notify)
- Schedule (batching: immediate, daily, weekly)

**Data Sources**:
- `GET /api/alerts` → List with filters
- `POST /api/alerts/:id/acknowledge` → Mark as sent
- `DELETE /api/alerts/:id` → Delete
- `GET /api/alerts/trends` → Trend data

### Common Features

**Navigation**:
- Sidebar with logo, main nav links, collapsible
- Top bar with: Page title, search, user profile, help
- Breadcrumbs on detail pages

**Responsive Design**:
- Mobile: Single-column layout, hamburger menu
- Tablet: 2-column layout, collapsed sidebar
- Desktop: 3-4 column layout, full sidebar

**Performance**:
- Code splitting per page
- Image lazy loading
- API response caching (React Query)
- Debounced search/filter inputs
- Virtualized lists for large tables

**Error Handling**:
- Error boundaries per page
- Toast notifications (success/error/info)
- Network error recovery (retry buttons)
- Loading skeletons while fetching

**Analytics** (Optional):
- Track page views
- Track key actions (generate report, trigger pipeline)
- Session duration
- Error rates

---

## CONFIGURATION & DEPLOYMENT

### Environment Variables

```bash
# ── Runtime ────────────────────────────────────────────────────────
NODE_ENV=production                      # development|test|production
LOG_LEVEL=info                           # error|warn|info|http|debug

# ── Database ────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host:5432/competitor_intel
# OR individual settings:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=competitor_intel
DB_USER=competitor_user
DB_PASSWORD=secure_password_here
DB_SSL=false
DB_POOL_MAX=10

# ── Email ────────────────────────────────────────────────────────────
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Competitor Intel <intel@example.com>
EMAIL_RECIPIENTS=user1@example.com,user2@example.com
EMAIL_TEST_RECIPIENT=test@example.com

# ── Apify (Web Scraping) ────────────────────────────────────────────
APIFY_API_TOKEN=apify_api_token_here

# ── Scraping Configuration ──────────────────────────────────────────
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright
SCRAPER_VIEWPORT_WIDTH=1440
SCRAPER_VIEWPORT_HEIGHT=900
SCRAPER_TIMEOUT_MS=30000
SCRAPER_REQUEST_DELAY_MS=2000
SCRAPER_MAX_RETRIES=3
SCRAPER_HEADLESS=true

# ── PDF / Puppeteer ─────────────────────────────────────────────────
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
PDF_FORMAT=A4
PDF_OUTPUT_DIR=./data/exports

# ── File Paths ──────────────────────────────────────────────────────
SCREENSHOTS_DIR=./data/screenshots
TEMPLATES_DIR=./src/templates
REPORTS_DIR=./data/exports

# ── Meta Ads Library ────────────────────────────────────────────────
META_ADS_COUNTRY=TH
META_ADS_MAX_PER_COMPETITOR=50

# ── OpenRouter (LLM Provider) ───────────────────────────────────────
OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxxxxxx
OPENROUTER_PRIMARY_MODEL=anthropic/claude-sonnet-4-5
OPENROUTER_FALLBACK_MODEL=google/gemini-2.0-flash-001
OPENROUTER_MAX_TOKENS=2000
OPENROUTER_MAX_RETRIES=2

# ── Google Trends ───────────────────────────────────────────────────
GOOGLE_TRENDS_GEO=TH
GOOGLE_TRENDS_TIMEFRAME_DAYS=90
GOOGLE_TRENDS_REQUEST_DELAY_MS=2000
GOOGLE_TRENDS_MAX_RETRIES=3
GOOGLE_TRENDS_KEYWORDS=hua hin hotel,hua hin resort,hua hin pool villa

# ── Analysis Thresholds ─────────────────────────────────────────────
HEALTH_SCORE_PAID_WEIGHT=50
HEALTH_SCORE_ORGANIC_WEIGHT=50
THREAT_HIGH_THRESHOLD=75
THREAT_MEDIUM_THRESHOLD=40

# ── API Port ────────────────────────────────────────────────────────
API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Database Setup

```bash
# Create PostgreSQL database and user
psql -U postgres

CREATE USER competitor_user WITH PASSWORD 'secure_password';
CREATE DATABASE competitor_intel OWNER competitor_user;
GRANT ALL PRIVILEGES ON DATABASE competitor_intel TO competitor_user;

# Run migrations
npm run migrate

# Verify schema
psql -U competitor_user -d competitor_intel -c "\dt"
# Should show 14 tables
```

### Docker Deployment

```dockerfile
# Dockerfile (simplified)
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: competitor_intel
      POSTGRES_USER: competitor_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U competitor_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://competitor_user:secure_password@postgres:5432/competitor_intel
      NODE_ENV: production
      RESEND_API_KEY: ${RESEND_API_KEY}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      APIFY_API_TOKEN: ${APIFY_API_TOKEN}
      # ... other env vars
    ports:
      - "3000:3000"
      - "3001:3001"
    volumes:
      - ./data:/app/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Scheduler Setup (PM2)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'scraper',
      script: 'dist/index.js',
      args: 'scrape',
      cron_restart: '0 2 * * *',  // Daily @ 02:00 UTC
      instances: 1,
      exec_mode: 'fork',
    },
    {
      name: 'analyzer',
      script: 'dist/index.js',
      args: 'analyze',
      cron_restart: '0 4 * * *',  // Daily @ 04:00 UTC
      instances: 1,
      exec_mode: 'fork',
    },
    {
      name: 'reporter',
      script: 'dist/index.js',
      args: 'generate',
      cron_restart: '0 6 * * 1',  // Weekly Monday @ 06:00 UTC
      instances: 1,
      exec_mode: 'fork',
    },
    {
      name: 'deliverer',
      script: 'dist/index.js',
      args: 'deliver',
      cron_restart: '0 7 * * 1',  // Weekly Monday @ 07:00 UTC
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};

// Start: pm2 start ecosystem.config.js
// Logs: pm2 logs
// Status: pm2 status
```

---

## MONITORING & MAINTENANCE

### Logging Strategy

**Tool**: Winston with daily rotation
**Log Levels**: error, warn, info, http, debug
**Output**:
- Console (development)
- File: `./logs/app-YYYY-MM-DD.log` (production)
- JSON format for structured parsing

**Sample Log Entry**:
```json
{
  "timestamp": "2026-03-11T12:00:00Z",
  "level": "info",
  "service": "ScrapeService",
  "message": "Scraped ads for competitor",
  "competitorId": 1,
  "competitorName": "Centara Grand",
  "adsCount": 34,
  "durationMs": 1250
}
```

### Metrics to Monitor

**Performance**:
- Pipeline stage duration (scrape, analyze, generate, deliver)
- Database query response times
- API endpoint latency
- Report generation time
- Email delivery rate

**Data Quality**:
- Ad scrape success rate (target: >95%)
- Post scrape success rate (target: >95%)
- Page metrics capture rate
- Duplicate ad detection rate
- Health score anomalies

**System Health**:
- Database connection pool utilization
- Memory usage (Node process)
- CPU usage during peak hours
- Disk usage (logs, exports, cache)
- API error rate (target: <1%)

**Business Metrics**:
- Reports generated per week
- Email delivery success rate (target: >99%)
- Active competitors count
- Total ads tracked
- Market analysis freshness (max 24h old)

### Alerting Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Pipeline failure | Any | Page on-call engineer |
| Database unavailable | >5 min | Restart DB, check logs |
| API error rate | >2% | Check API logs, rollback if recent deploy |
| Scrape success rate | <90% | Review scraper logs, check target sites |
| Email delivery | <95% | Check Resend status, review logs |
| Disk usage | >80% | Clean old logs/reports |
| Memory usage | >85% | Restart service, investigate leaks |

### Backup Strategy

**Database**:
- Daily automated PostgreSQL backups
- Keep 30-day rolling window
- Store in S3-compatible storage
- Test restore quarterly

**Code & Configuration**:
- Git repository (GitHub)
- Tag releases
- Secrets in Vault, not in code

**Reports & Data**:
- Archive old reports to S3
- Keep 12 months of reports
- Daily snapshots of key metrics

### Maintenance Windows

**Regular Maintenance** (Weekly, Sunday 23:00-23:30 UTC):
- Database optimization (VACUUM, ANALYZE)
- Log rotation and cleanup
- Cache cleanup

**Monthly** (First Sunday, 02:00 UTC):
- Full database backup verification
- Dependency security updates
- Performance analysis and optimization

**Quarterly**:
- Security audit
- DR/backup recovery test
- Capacity planning review

### Troubleshooting Guide

**Pipeline Stuck**:
1. Check `pipeline_runs` table status
2. Review logs: `pm2 logs scraper|analyzer|reporter`
3. Check external API status (Apify, OpenRouter, Resend)
4. Restart: `pm2 restart all`

**High Memory Usage**:
1. Check Node process: `node --max-old-space-size=2048 dist/index.js`
2. Review for memory leaks in logs
3. Clear cache: `rm -rf cache/llm/*`
4. Restart service

**Email Not Sending**:
1. Verify `RESEND_API_KEY` is valid
2. Check email recipients list
3. Review Resend dashboard for delivery status
4. Check logs: `grep "deliver" logs/app-*.log`

**Slow Queries**:
1. Run EXPLAIN ANALYZE on slow query
2. Check for missing indexes
3. Review query plan and optimize
4. Consider caching frequently-accessed data

---

## Appendix: Quick Reference

### CLI Commands
```bash
# Run full pipeline
npm run dev:run                    # With tsx
npm start                          # Compiled

# Individual stages
npm run dev:scrape
npm run dev:analyze
npm run dev:generate
npm run dev:deliver

# Database
npm run dev:migrate               # Apply migrations
npm run db:studio                 # Drizzle Studio UI

# API & Dashboard
npm run dev:api                   # Backend @ 3001
npm run dev:all                   # Both services

# Testing
npm run typecheck                 # Type checking
npm run lint                      # Linting
npm run build                     # Compile TypeScript
```

### API Endpoints Quick Reference
```
GET  /api/competitors            List all competitors
GET  /api/competitors/:id        Get competitor detail
POST /api/competitors            Create new competitor
PUT  /api/competitors/:id        Update competitor
DELETE /api/competitors/:id      Delete competitor

POST /api/pipeline/run           Execute full pipeline
POST /api/pipeline/scrape        Trigger scrape stage
POST /api/pipeline/analyze       Trigger analyze stage
POST /api/pipeline/generate      Generate report
POST /api/pipeline/deliver       Send email

GET  /api/reports                List reports
GET  /api/reports/:uuid          Get report detail
GET  /api/reports/:uuid/pdf      Download PDF

GET  /api/alerts                 List alerts
POST /api/alerts/:id/acknowledge Mark as sent

GET  /api/health                 System health
GET  /api/health/market          Market overview
GET  /api/health/leaderboard     Competitor rankings
```

### Database Connection
```bash
# Connect to PostgreSQL
psql -U competitor_user -d competitor_intel -h localhost

# Common queries
SELECT COUNT(*) FROM competitors WHERE is_active = true;
SELECT * FROM analyses WHERE analysis_date = CURRENT_DATE ORDER BY health_score DESC;
SELECT * FROM alerts WHERE severity = 'critical' AND is_sent = false;
SELECT * FROM reports ORDER BY report_date DESC LIMIT 5;
```

---

**Document Version**: 1.0.0
**Last Updated**: March 2026
**Next Review**: June 2026
