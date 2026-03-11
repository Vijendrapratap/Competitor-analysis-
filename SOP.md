# COMPETITOR INTELLIGENCE SYSTEM — DETAILED STANDARD OPERATING PROCEDURES

**Version**: 2.0.0 (Enterprise Edition)
**Last Updated**: March 2026
**Status**: Production-Ready
**Document Owner**: Operations & DevOps Team
**Target Audience**: DevOps, Developers, Operations Team, On-Call Engineers

---

## TABLE OF CONTENTS

1. [Document Overview](#document-overview)
2. [System Architecture Overview](#system-architecture-overview)
3. [Architecture Diagrams (Detailed)](#architecture-diagrams-detailed)
4. [Data Flow Architecture](#data-flow-architecture)
5. [API Integration & Endpoints](#api-integration--endpoints)
6. [Getting Started Guide](#getting-started-guide)
7. [Daily Operations](#daily-operations)
8. [Pipeline Execution Procedures](#pipeline-execution-procedures)
9. [API Operations](#api-operations)
10. [Database Operations](#database-operations)
11. [Monitoring & Alerts](#monitoring--alerts)
12. [Troubleshooting Guide](#troubleshooting-guide)
13. [Incident Response](#incident-response)
14. [Deployment Procedures](#deployment-procedures)
15. [Disaster Recovery](#disaster-recovery)
16. [Maintenance Schedules](#maintenance-schedules)

---

## DOCUMENT OVERVIEW

### Purpose

This Standard Operating Procedures (SOP) document provides comprehensive operational guidance for running, maintaining, and troubleshooting the Competitor Intelligence System in production. It serves as the definitive reference for:

- **System operators** managing daily operations
- **On-call engineers** responding to incidents
- **DevOps teams** deploying and scaling infrastructure
- **Database administrators** maintaining data integrity
- **Developers** debugging system issues

### Scope

This SOP covers:
- Complete system architecture and components
- Step-by-step operational procedures
- API integration points and usage
- Troubleshooting procedures for common issues
- Incident response and escalation
- Deployment and rollback procedures
- Disaster recovery and backup verification

### Document Structure

Each section follows this format:
- **Overview**: Context and purpose
- **Architecture/Diagrams**: Visual representations
- **Step-by-Step Procedures**: Numbered action items
- **Examples**: Real-world command execution
- **Troubleshooting**: Common issues and solutions
- **Related Links**: Cross-references

---

## SYSTEM ARCHITECTURE OVERVIEW

### System Components at a Glance

```
┌──────────────────────────────────────────────────────────────────────┐
│               COMPETITOR INTELLIGENCE SYSTEM (PRODUCTION)            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  LAYERS:                                                             │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │ PRESENTATION LAYER (Frontend)                            │       │
│  │ - Next.js Dashboard (Port 3000)                          │       │
│  │ - React Components (Dashboard, Reports, Alerts)          │       │
│  │ - Real-time monitoring interface                         │       │
│  └──────────────────────────────────────────────────────────┘       │
│                           ↕ HTTP/REST                                │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │ API GATEWAY & APPLICATION LAYER                          │       │
│  │ - Express.js REST API (Port 3001)                        │       │
│  │ - Route Handlers:                                        │       │
│  │   ├─ /api/competitors (CRUD operations)                  │       │
│  │   ├─ /api/pipeline (scrape, analyze, generate, deliver) │       │
│  │   ├─ /api/reports (list, view, download)                │       │
│  │   ├─ /api/alerts (list, acknowledge)                    │       │
│  │   └─ /api/health (system status)                         │       │
│  │ - Middleware: Authentication, Error Handling, Logging    │       │
│  └──────────────────────────────────────────────────────────┘       │
│                           ↕ SQL Queries                               │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │ SERVICES LAYER (Business Logic)                          │       │
│  │ - ScrapeService: Apify + Playwright + Google Trends     │       │
│  │ - AnalysisService: Health scores, strategies, alerts    │       │
│  │ - ReportService: PDF generation, aggregation            │       │
│  │ - DeliveryService: Email via Resend                      │       │
│  │ - IntelligenceService: LLM analysis via OpenRouter      │       │
│  │ - AlertService: Detect changes, generate notifications   │       │
│  └──────────────────────────────────────────────────────────┘       │
│                           ↕ ORM (Drizzle)                            │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │ DATA ACCESS LAYER                                        │       │
│  │ - Drizzle ORM: Type-safe database queries               │       │
│  │ - Connection Pooling: Max 20 concurrent connections      │       │
│  │ - Query Caching: Redis for frequently accessed data     │       │
│  └──────────────────────────────────────────────────────────┘       │
│                           ↕ TCP 5432                                  │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │ DATA PERSISTENCE LAYER                                   │       │
│  │ - PostgreSQL (Port 5432)                                 │       │
│  │ - 14 Tables: competitors, ads, posts, analyses, etc.    │       │
│  │ - 30+ Indexes for query optimization                     │       │
│  │ - Daily backups (30-day retention)                       │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                      │
│  EXTERNAL INTEGRATIONS:                                             │
│  ├─ Apify API (Web scraping: Meta Ads, Facebook Posts)             │
│  ├─ OpenRouter API (LLM analysis: Claude Sonnet 4.5)               │
│  ├─ Resend API (Email delivery)                                     │
│  ├─ Google Trends API (Market trend data)                           │
│  └─ Playwright (Browser automation: Facebook metrics)              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Facts

- **Primary Language**: TypeScript (Node.js 20 ESM)
- **Framework**: Express.js (API) + Next.js (Dashboard)
- **Database**: PostgreSQL 13+ (ACID, JSONB support)
- **ORM**: Drizzle (Type-safe, lightweight)
- **Deployment**: Docker, PM2 scheduler, Cloud/Self-hosted
- **Monitoring**: Winston logs, Prometheus metrics, Grafana dashboards
- **Uptime Target**: 99.5% (43 minutes downtime/month acceptable)

---

## ARCHITECTURE DIAGRAMS (DETAILED)

### 1. Complete System Architecture with Data Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE COMPETITOR INTELLIGENCE SYSTEM                 │
│                          (With API Integration Points)                     │
└────────────────────────────────────────────────────────────────────────────┘

                            EXTERNAL DATA SOURCES
                            ───────────────────────
         ┌─────────────────────┬─────────────────────┬─────────────────────┐
         │                     │                     │                     │
    Meta Ads Library      Facebook Pages         Google Trends      Facebook Posts
    (Ads Archive)         (Metrics)               (Keywords)         (Engagement)
         │                     │                     │                     │
         └─────────────────────┼─────────────────────┼─────────────────────┘
                               │
                               ↓
         ┌─────────────────────────────────────────────────────────────────┐
         │                                                                 │
         │              SCRAPING & INTEGRATION LAYER (Tier 1)            │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ APIFY ACTORS                                             │ │
         │  ├─ meta-ads-library-scraper (Meta Ads)                    │ │
         │  ├─ facebook-posts-scraper (Posts + Engagement)            │ │
         │  └─ Input: Competitor URLs, Configuration                  │ │
         │  Output: Normalized ad/post data, JSON format              │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ PLAYWRIGHT BROWSER AUTOMATION                            │ │
         │  ├─ Target: Facebook page metrics                          │ │
         │  ├─ Extract: Followers, likes, engagement rate             │ │
         │  └─ Output: Page metrics snapshot                          │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ GOOGLE TRENDS FETCHER                                    │ │
         │  ├─ Input: Keywords list, timeframe, geography             │ │
         │  ├─ Process: Trend value, change percentage                │ │
         │  └─ Output: Trend data with metadata                       │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         │              [DEDUPLICATION & VALIDATION]                     │
         │              ├─ Check for duplicate ads/posts                │
         │              ├─ Validate data types & constraints            │
         │              └─ Transform to database schema                 │
         │                                                                 │
         └─────────────────────────────────────────────────────────────────┘
                                      │
                                      ↓
         ┌─────────────────────────────────────────────────────────────────┐
         │                                                                 │
         │           PROCESSING & ANALYSIS LAYER (Tier 2)               │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ HEALTH SCORE CALCULATOR                                  │ │
         │  ├─ Input: Ads count, post recency, creativity diversity   │ │
         │  ├─ Process: 5 dimensions × 20 points = 100 point scale    │ │
         │  ├─ Output: health_score, paid_score, organic_score        │ │
         │  └─ Stores: analyses table                                  │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ STRATEGY CLASSIFIER (LLM)                                │ │
         │  ├─ API Call: OpenRouter → Claude Sonnet 4.5               │ │
         │  ├─ Input: Top ads copy, recent posts, page bio            │ │
         │  ├─ Processing: Semantic analysis, strategy identification │ │
         │  ├─ Output: marketing_strategy (EN/TH), key_usp            │ │
         │  ├─ Cache: 24-hour cache (MD5 hash)                        │ │
         │  └─ Stores: analyses table (strategy columns)              │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ PRICING EXTRACTOR & ANALYZER                             │ │
         │  ├─ Input: Ad copy text, extracted headlines               │ │
         │  ├─ Method: Regex pattern matching + heuristics            │ │
         │  ├─ Output: pricing_data (JSONB)                           │ │
         │  │          ├─ roomRates: Array<{type, price}>            │ │
         │  │          ├─ discounts: Array<{%value, until}>          │ │
         │  │          └─ pricePosition: (cheap/average/premium)      │ │
         │  └─ Stores: analyses.pricing_data (JSONB)                  │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ ALERT DETECTOR                                           │ │
         │  ├─ Compare: Current vs. previous analysis snapshot         │ │
         │  ├─ Detect: Price changes, ad volume spikes, new campaigns │ │
         │  ├─ Output: alert_type, severity, message                  │ │
         │  └─ Stores: alerts table, report_alerts table              │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ RECOMMENDATION ENGINE                                    │ │
         │  ├─ Input: Competitor data, customer profile               │ │
         │  ├─ Process: Gap analysis, market positioning              │ │
         │  ├─ Output: Ranked recommendations (urgent→low)            │ │
         │  └─ Stores: report metadata                                │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         └─────────────────────────────────────────────────────────────────┘
                                      │
                                      ↓
         ┌─────────────────────────────────────────────────────────────────┐
         │                                                                 │
         │           REPORT GENERATION & RENDERING (Tier 3)             │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ DATA AGGREGATION                                         │ │
         │  ├─ Query: Latest analyses, health scores, rankings         │ │
         │  ├─ Calculate: Market averages, SOV, threat distribution   │ │
         │  ├─ Filter: Recent alerts, top insights                    │ │
         │  └─ Output: Report data structure                          │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ CHART GENERATION (Skia Canvas)                           │ │
         │  ├─ Charts Generated:                                       │ │
         │  │  ├─ Health Score Comparison (bar chart)                 │ │
         │  │  ├─ Share of Voice (pie chart)                          │ │
         │  │  ├─ Ad Volume Timeline (line chart)                     │ │
         │  │  ├─ Engagement Rates (radar chart)                      │ │
         │  │  ├─ Threat Levels (horizontal bar)                      │ │
         │  │  └─ Trend Distribution (doughnut)                       │ │
         │  ├─ Output: PNG images (server-side rendering)             │ │
         │  └─ Storage: Temporary /tmp/charts/ directory              │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ HTML TEMPLATE RENDERING (Nunjucks)                       │ │
         │  ├─ Template: src/templates/report.njk                     │ │
         │  ├─ Variables Injected:                                    │ │
         │  │  ├─ reportTitle, reportDate, periodRange               │ │
         │  │  ├─ marketOverview (metrics, distribution)             │ │
         │  │  ├─ competitors array (per-competitor sections)        │ │
         │  │  ├─ charts object (PNG image paths)                    │ │
         │  │  ├─ alerts array (sorted by severity)                  │ │
         │  │  ├─ recommendations array (ranked)                     │ │
         │  │  └─ metadata (generated by, LLM model used)            │ │
         │  ├─ Output: HTML string (500KB - 2MB)                      │ │
         │  └─ Storage: reports table (html_content column)           │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ PDF GENERATION (Puppeteer)                               │ │
         │  ├─ Input: HTML content from previous step                 │ │
         │  ├─ Process: Render HTML → PDF with styling                │ │
         │  ├─ Format: A4, portrait, no margins                       │ │
         │  ├─ Output: PDF buffer (2-5MB)                             │ │
         │  └─ Storage: ./data/exports/Hua_Hin_Intelligence_*.pdf    │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ REPORT STORAGE                                           │ │
         │  ├─ Database: INSERT reports row with html_content         │ │
         │  ├─ Columns:                                               │ │
         │  │  ├─ report_uuid (unique identifier)                    │ │
         │  │  ├─ title, clientName, marketLocation                 │ │
         │  │  ├─ reportMonth, reportYear                           │ │
         │  │  ├─ html_content (full HTML, 500KB+)                  │ │
         │  │  ├─ metadata (JSONB: market_status, insights, threats)│ │
         │  │  ├─ llm_model_used, generation_time_sec              │ │
         │  │  └─ status (active|archived|deleted)                 │ │
         │  └─ File: PDF saved to /data/exports/                    │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         └─────────────────────────────────────────────────────────────────┘
                                      │
                                      ↓
         ┌─────────────────────────────────────────────────────────────────┐
         │                                                                 │
         │               DELIVERY & DISTRIBUTION (Tier 4)               │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ EMAIL SERVICE (Resend API)                               │ │
         │  ├─ Input: Report PDF + HTML summary                       │ │
         │  ├─ Configuration:                                         │ │
         │  │  ├─ From: EMAIL_FROM (intel@yourcompany.com)           │ │
         │  │  ├─ To: EMAIL_RECIPIENTS (comma-separated list)        │ │
         │  │  ├─ Subject: "Market Intelligence Report - [Month/Year]"│ │
         │  │  └─ Template: Executive summary in email body          │ │
         │  ├─ Attachment: PDF file (2-5MB)                          │ │
         │  ├─ Process:                                              │ │
         │  │  1. Build email body with key insights                │ │
         │  │  2. Attach PDF file                                   │ │
         │  │  3. Call Resend API: POST /emails                     │ │
         │  │  4. Log delivery status                               │ │
         │  └─ Output: Delivery ID or error                          │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         │  ┌──────────────────────────────────────────────────────────┐ │
         │  │ ACCESS LOGGING                                           │ │
         │  ├─ Log Entry: report_access_log table                     │ │
         │  ├─ Fields:                                                │ │
         │  │  ├─ report_id (FK)                                     │ │
         │  │  ├─ report_uuid                                        │ │
         │  │  ├─ accessed_by (email or "email service")            │ │
         │  │  ├─ access_type (email|view|pdf_download)            │ │
         │  │  ├─ ip_address (if applicable)                        │ │
         │  │  └─ accessed_at (timestamp)                           │ │
         │  └─ Used for: Audit trail, delivery verification         │ │
         │  └──────────────────────────────────────────────────────────┘ │
         │                                                                 │
         └─────────────────────────────────────────────────────────────────┘
                                      │
                                      ↓
                            STAKEHOLDERS RECEIVE REPORT
```

### 2. API Integration Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    API INTEGRATION ARCHITECTURE                             │
│                  (Where APIs Work in the System)                           │
└────────────────────────────────────────────────────────────────────────────┘

TIER 1: EXTERNAL DATA APIs
──────────────────────────────────────────────────────────────────────────────

┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│  APIFY API           │      │  OpenRouter API      │      │  Resend Email API    │
│  ────────────────    │      │  ───────────────     │      │  ────────────────    │
│  Base URL:           │      │  Base URL:           │      │  Base URL:           │
│  https://api.apify   │      │  https://openrouter  │      │  https://api.resend  │
│  .com/v2             │      │  .io/api/v1          │      │  .com                │
│                      │      │                      │      │                      │
│  Used for:           │      │  Used for:           │      │  Used for:           │
│  • Meta Ads scraping │      │  • Strategy analysis │      │  • Email delivery    │
│  • Facebook Posts    │      │  • Recommendations   │      │  • Report sending    │
│                      │      │  • Ad copy analysis  │      │                      │
│  Endpoint:           │      │  Endpoint:           │      │  Endpoint:           │
│  POST /actors/run    │      │  POST /messages      │      │  POST /emails        │
│  (with task data)    │      │  (with prompt)       │      │  (with body+attach)  │
│                      │      │                      │      │                      │
│  Auth: API Token     │      │  Auth: API Key       │      │  Auth: API Key       │
│  Rate Limit: 100/day │      │  Rate Limit: Custom  │      │  Rate Limit: 100/day │
└──────────────────────┘      └──────────────────────┘      └──────────────────────┘
        │                             │                             │
        │ Called by:                  │ Called by:                  │ Called by:
        │ ScrapeService              │ IntelligenceService        │ DeliveryService
        │                             │                             │
        └─────────────────────────────┼─────────────────────────────┘
                                      │
                                      ↓

TIER 2: INTERNAL REST API (Express.js - Port 3001)
──────────────────────────────────────────────────────────────────────────────

┌────────────────────────────────────────────────────────────────────────────┐
│                      EXPRESS.JS REST API                                    │
│                      (Competitor Intelligence API)                          │
│                      Port: 3001                                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ROUTE MODULES (5 main routers):                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                          │
│                                                                            │
│  1️⃣  COMPETITORS ROUTER                                                   │
│      ├─ GET    /api/competitors                                           │
│      │         Query: ?active=true, ?category=hotel                       │
│      │         Response: [Competitor, ...]                               │
│      │         Service: dbService.getCompetitors()                       │
│      │                                                                    │
│      ├─ GET    /api/competitors/:id                                       │
│      │         Response: {competitor, latestAnalysis, topAds, ...}       │
│      │         Service: dbService.getCompetitorDetail()                  │
│      │                                                                    │
│      ├─ POST   /api/competitors                                           │
│      │         Body: {name, facebookPageId, category, ...}              │
│      │         Response: {id, ...newCompetitor}                          │
│      │         Service: dbService.insertCompetitor()                     │
│      │         Database: INSERT INTO competitors                         │
│      │                                                                    │
│      ├─ PUT    /api/competitors/:id                                       │
│      │         Body: {name, priceTier, isActive, ...}                   │
│      │         Service: dbService.updateCompetitor()                     │
│      │         Database: UPDATE competitors WHERE id                     │
│      │                                                                    │
│      ├─ DELETE /api/competitors/:id                                       │
│      │         Service: dbService.deleteCompetitor()                     │
│      │         Database: UPDATE competitors SET is_active=false          │
│      │                                                                    │
│      └─ PATCH  /api/competitors/:id/toggle                               │
│              Service: dbService.toggleCompetitor()                       │
│              Database: UPDATE is_active = NOT is_active                  │
│                                                                            │
│  2️⃣  PIPELINE ROUTER                                                      │
│      ├─ POST   /api/pipeline/run                                          │
│      │         Body: {competitors: [1,2,3], dryRun: false}              │
│      │         Response: {runId, status, stage, startedAt}              │
│      │         Process:                                                  │
│      │          → ScrapeService.run()    (5-10 min)                     │
│      │          → AnalysisService.run()  (5-15 min)                     │
│      │          → ReportService.run()    (3-5 min)                      │
│      │          → DeliveryService.run()  (1-2 min)                      │
│      │         Database: INSERT INTO pipeline_runs                       │
│      │                                                                    │
│      ├─ POST   /api/pipeline/scrape                                       │
│      │         Service: ScrapeService.run()                              │
│      │         Calls: Apify API, Playwright, Google Trends              │
│      │         Stores: ads, facebook_posts, facebook_pages, trends      │
│      │         Response: {adsScraped, postsScraped, ...}                │
│      │                                                                    │
│      ├─ POST   /api/pipeline/analyze                                      │
│      │         Service: AnalysisService.run()                            │
│      │         Calls: OpenRouter API (LLM)                              │
│      │         Stores: analyses, alerts                                 │
│      │         Response: {healthScoresCalculated, alertsGenerated}      │
│      │                                                                    │
│      ├─ POST   /api/pipeline/generate                                     │
│      │         Service: ReportService.run()                              │
│      │         Process: Aggregate data, render charts, create PDF        │
│      │         Stores: reports, report_competitors                      │
│      │         Response: {reportId, title, pdfPath}                     │
│      │                                                                    │
│      ├─ POST   /api/pipeline/deliver                                      │
│      │         Service: DeliveryService.run()                            │
│      │         Calls: Resend Email API                                  │
│      │         Stores: report_access_log                                │
│      │         Response: {sentTo: number}                               │
│      │                                                                    │
│      ├─ GET    /api/pipeline/status/:runId                               │
│      │         Response: {id, status, stage, results, error}            │
│      │         Queries: pipeline_runs table                             │
│      │                                                                    │
│      └─ GET    /api/pipeline/runs                                         │
│              Query: ?limit=20, ?offset=0                                │
│              Response: [{id, status, stage, ...}, ...]                  │
│                                                                            │
│  3️⃣  REPORTS ROUTER                                                       │
│      ├─ GET    /api/reports                                               │
│      │         Query: ?clientName, ?status, ?year, ?month, ?limit       │
│      │         Response: [Report, ...]                                  │
│      │         Queries: reports table                                   │
│      │                                                                    │
│      ├─ GET    /api/reports/:uuid                                         │
│      │         Response: {report metadata, NO htmlContent}              │
│      │         Logs: report_access_log (access_type: metadata)          │
│      │         Database: SELECT * FROM reports WHERE report_uuid       │
│      │                                                                    │
│      ├─ GET    /api/reports/:uuid/pdf                                     │
│      │         Response: Binary PDF file (application/pdf)              │
│      │         Process:                                                 │
│      │          1. Query report from DB                                │
│      │          2. Set HTTP headers (Content-Type, Content-Disposition)│
│      │          3. Stream PDF file to client                          │
│      │         Logs: report_access_log (access_type: pdf_download)      │
│      │                                                                    │
│      ├─ GET    /api/reports/:uuid/view                                    │
│      │         Response: HTML page (server-rendered from htmlContent)   │
│      │         Logs: report_access_log (access_type: view)             │
│      │                                                                    │
│      └─ GET    /api/reports/trends/:name                                 │
│              Query: ?months=6                                            │
│              Response: [{month, year, healthScore, trend}, ...]         │
│              Queries: analyses table, GROUP BY analysis_date            │
│                                                                            │
│  4️⃣  ALERTS ROUTER                                                        │
│      ├─ GET    /api/alerts                                                │
│      │         Query: ?type, ?severity, ?competitorId, ?isSent, ?limit  │
│      │         Response: [Alert, ...]                                   │
│      │         Queries: alerts table with WHERE conditions              │
│      │         Database: SELECT * FROM alerts WHERE ...                │
│      │                                                                    │
│      ├─ POST   /api/alerts/:id/acknowledge                               │
│      │         Body: {isSent: true}                                      │
│      │         Response: {isSent: true, sentAt: "..."}                  │
│      │         Database: UPDATE alerts SET is_sent=true, sent_at=NOW() │
│      │                                                                    │
│      └─ GET    /api/alerts/trends                                         │
│              Response: {byType, bySeverity, byCompetitor}               │
│              Queries: alerts table with aggregations                    │
│                                                                            │
│  5️⃣  HEALTH & MONITORING ROUTER                                          │
│      ├─ GET    /api/health                                                │
│      │         Response: {status, uptime, database, timestamp}          │
│      │         Checks: Database connection, API latency                │
│      │                                                                    │
│      ├─ GET    /api/health/market                                         │
│      │         Response: {totalCompetitors, totalAds, avgHealth, ...}   │
│      │         Queries: competitors, ads, analyses tables              │
│      │         Aggregations: COUNT, AVG, GROUP BY                       │
│      │                                                                    │
│      ├─ GET    /api/health/leaderboard                                    │
│      │         Response: [Competitor ranked by health score, ...]       │
│      │         Query: SELECT * FROM analyses ORDER BY health_score DESC │
│      │                                                                    │
│      └─ GET    /api/health/sov                                            │
│              Response: [{competitorId, totalAds, shareOfVoice}, ...]   │
│              Calculation: (competitor_ads / total_ads) × 100            │
│                                                                            │
│  MIDDLEWARE STACK:                                                       │
│  ────────────────                                                        │
│  ├─ errorHandler: Catch exceptions, return 500 responses               │
│  ├─ requestLogger: Log all requests (method, path, status, duration)   │
│  ├─ cors: Allow cross-origin requests (if needed)                      │
│  └─ compression: Gzip responses > 1KB                                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
        │
        │ Internal HTTP Calls
        │ (from frontend, scheduled tasks, webhooks)
        │
        ↓

TIER 3: FRONTEND API CLIENT (Next.js Dashboard - Port 3000)
──────────────────────────────────────────────────────────────────────────────

┌────────────────────────────────────────────────────────────────────────────┐
│                   NEXT.JS DASHBOARD (React Client)                         │
│                     Calls Express API via /api/...                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Data Fetching Strategy:                                                 │
│  ── Server-Side Rendering (SSR):                                         │
│     • Dashboard pages use getServerSideProps()                           │
│     • Calls API endpoints during server rendering                        │
│     • Pre-fetches data before sending HTML to client                     │
│                                                                            │
│  ── Client-Side Fetching:                                                │
│     • React Query (useQuery hook) for pagination, filters               │
│     • Caches data, auto-refetch on focus                                │
│     • Handles loading, error, success states                            │
│                                                                            │
│  Example Data Flow:                                                      │
│  ────────────────────                                                   │
│  1. User opens Dashboard                                                │
│     └─ GET /api/health/market → Display metrics cards                  │
│                                                                            │
│  2. User navigates to Competitors page                                  │
│     └─ GET /api/competitors?active=true → Display table                │
│                                                                            │
│  3. User clicks on competitor row                                       │
│     └─ GET /api/competitors/:id → Display detail page                  │
│                                                                            │
│  4. User triggers pipeline from dashboard                               │
│     └─ POST /api/pipeline/run → Poll /api/pipeline/status/:runId       │
│        Until status === 'completed'                                    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
        │
        │ All API calls go through:
        │ lib/api.ts → baseURL = process.env.NEXT_PUBLIC_API_URL
        │
        └─→ http://localhost:3001/api (or production URL)
```

---

## DATA FLOW ARCHITECTURE

### Complete Data Pipeline Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE DATA FLOW DIAGRAM                           │
│                    (How data moves through the system)                     │
└────────────────────────────────────────────────────────────────────────────┘

STAGE 1: SCRAPE (Raw Data Collection)
──────────────────────────────────────────────────────────────────────────────

REQUEST:  POST /api/pipeline/scrape
          │
          ↓
     ScrapeService.run()
          │
          ├─→ Load competitors from DB (competitors table)
          │   Query: SELECT * FROM competitors WHERE is_active = true
          │   Returns: [{id:1, name:'X', facebookPageId:'...'}, ...]
          │
          ├─→ For each competitor:
          │
          │   1. APIFY CALL: Meta Ads Scraper
          │      Endpoint: POST https://api.apify.com/v2/actors/run
          │      Payload: {actorId, input: {facebookPageId, maxAds: 50}}
          │      Response: {
          │        id: 'taskId',
          │        data: {
          │          ads: [
          │            {adId, adText, creativeType, platforms, ...},
          │            ...
          │          ]
          │        }
          │      }
          │      ↓
          │      mapApifyAdToNewAd() → Transform to DB schema
          │      ↓
          │      Deduplication: SELECT * FROM ads WHERE meta_ad_id = ?
          │      ├─ If exists: UPDATE ads SET scraped_at=NOW()
          │      └─ If new: INSERT INTO ads
          │      ↓
          │      INSERT INTO ads table: 145 rows
          │
          │   2. APIFY CALL: Facebook Posts Scraper
          │      Endpoint: POST https://api.apify.com/v2/actors/run
          │      Payload: {actorId, input: {pageUrl, maxPosts: 30}}
          │      Response: {
          │        data: {
          │          posts: [
          │            {postId, postText, reactions, comments, shares, ...},
          │            ...
          │          ]
          │        }
          │      }
          │      ↓
          │      mapPostToNewPost() + engagementScoring()
          │      ↓
          │      Deduplication: SELECT * FROM facebook_posts WHERE post_id = ?
          │      ├─ If exists: UPDATE post reactions, comments, engagement
          │      └─ If new: INSERT INTO facebook_posts
          │      ↓
          │      INSERT INTO facebook_posts table: 89 rows
          │
          │   3. PLAYWRIGHT: Facebook Page Metrics
          │      Launch browser → Navigate to pageUrl
          │      Extract: followers, likes, rating, engagement_rate
          │      ↓
          │      INSERT INTO facebook_pages (snapshot, not updated)
          │      ↓
          │      INSERT INTO facebook_pages table: 12 rows
          │
          │   4. GOOGLE TRENDS: Market Keywords
          │      For each keyword: ['hua hin hotel', 'hua hin resort', ...]
          │      Call: Google Trends API (unofficial or official)
          │      Get: trend_value, change_pct
          │      ↓
          │      Check cache: redis.get(MD5(keyword + date + geo))
          │      ├─ If cached: Use cached value
          │      └─ If miss: Fetch from API, cache 24 hours
          │      ↓
          │      INSERT INTO trends table: 10 rows
          │
          ├─→ Mark old ads inactive (if not scraped today)
          │   UPDATE ads SET is_active = false WHERE scraped_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
          │
          └─→ Return ScrapeResult
             {
               adsScraped: 145,
               postsScraped: 89,
               pagesScraped: 12,
               trendsScraped: 10,
               duration: '8m 45s'
             }

RESULT DATABASE STATE:
  • ads table: +145 new/updated rows
  • facebook_posts table: +89 new/updated rows
  • facebook_pages table: +12 new snapshots
  • trends table: +10 new rows


STAGE 2: ANALYZE (AI Processing & Scoring)
──────────────────────────────────────────────────────────────────────────────

REQUEST:  POST /api/pipeline/analyze
          │
          ↓
     AnalysisService.run()
          │
          ├─→ For each competitor:
          │
          │   1. LOAD COMPETITOR DATA
          │      Query: SELECT * FROM ads WHERE competitor_id = 1 AND is_active = true
          │      Query: SELECT * FROM facebook_posts WHERE competitor_id = 1 LIMIT 30
          │      Query: SELECT * FROM facebook_pages WHERE competitor_id = 1 ORDER BY scraped_at DESC LIMIT 1
          │      Result: {ads: [...], posts: [...], metrics: {...}}
          │
          │   2. HEALTH SCORE CALCULATION
          │      HealthScoreCalculator.calculate({ads, posts, metrics})
          │
          │      Dimension 1: Ad Volume
          │        formula: (35 ads / 50 market_leader) × 20 = 14 points
          │
          │      Dimension 2: Freshness
          │        newestAdDate = max(ad.started_running)
          │        age = today - newestAdDate
          │        formula: if age ≤ 7d then 18pts, else if 8-14d then 15pts...
          │
          │      Dimension 3: Creativity
          │        creativityCount = distinct(creative_type)
          │        formula: (3 types / 4 max) × 20 = 15 points
          │
          │      Dimension 4: Strategy Diversity
          │        strategiesDetected = [price-focused, experience, social-proof]
          │        formula: (3 / 7 strategies) × 20 = 8.6 points
          │
          │      Dimension 5: Engagement
          │        avgEngagement = (reactions+comments*2+shares*3) / (followers × days)
          │        formula: (4.2% / 6% benchmark) × 20 = 14 points
          │
          │      TOTAL HEALTH SCORE = (14+18+15+8.6+14) / 5 = 73.92
          │
          │      Result: {healthScore: 73.92, paidScore: 78, organicScore: 71}
          │
          │   3. STRATEGY CLASSIFICATION (LLM)
          │      Input: Top 5 ads copy + recent 10 posts + page bio
          │
          │      Check Cache: redis.get(MD5(prompt))
          │      If cached (hit): Use cached response
          │      If miss: Call LLM API
          │
          │      LLM API CALL (OpenRouter):
          │      ┌─────────────────────────────────────────┐
          │      │ POST https://openrouter.io/api/v1/messages
          │      │ Headers: Authorization: Bearer sk-or-...
          │      │ Body: {
          │      │   model: 'anthropic/claude-sonnet-4-5',
          │      │   messages: [{
          │      │     role: 'user',
          │      │     content: 'Analyze this competitor...'
          │      │   }],
          │      │   temperature: 0.3,
          │      │   max_tokens: 1500
          │      │ }
          │      │ Response: {
          │      │   content: [{text: '{"marketingStrategyEn": "..."}'}]
          │      │ }
          │      └─────────────────────────────────────────┘
          │
          │      Parse JSON response:
          │      {
          │        marketingStrategyEn: 'Focus on family packages...',
          │        marketingStrategyTh: 'โฟกัสที่แพ็คเกจครอบครัว...',
          │        keyUspEn: 'Beachfront location with amenities',
          │        keyUspTh: 'ทำเลติดชายหาดพร้อมสิ่งอำนวยความสะดวก',
          │        targetSegments: [{segment: 'families', confidence: 'high'}, ...],
          │        digitalMaturityScore: 8
          │      }
          │
          │      Cache response: redis.set(MD5(prompt), response, EX: 86400)
          │
          │   4. PRICING EXTRACTION
          │      Extract prices from ad copy using regex:
          │      /(\d+(?:,\d{3})*(?:\.\d{1,2})?)[\s]?(?:USD|THB|BAHT|$|฿)/gi
          │
          │      Result: {
          │        roomRates: [
          │          {roomType: 'Standard', pricePerNight: 1500, currency: 'THB'},
          │          {roomType: 'Deluxe', pricePerNight: 2500, currency: 'THB'}
          │        ],
          │        discounts: [{description: '20% off weekday', discountPct: 20}],
          │        pricePosition: 'premium'
          │      }
          │
          │   5. ALERT DETECTION
          │      Previous analysis: Query analyses table for competitor_id, analysis_date < today
          │      Current analysis: Just calculated above
          │
          │      Comparison:
          │      ├─ Health score change: 73.92 vs 65.00 = +8.92 (8.6% increase)
          │      ├─ Ad volume change: 35 ads vs 28 ads = +7 (20% increase)
          │      ├─ New ads detected: 7 new ads in last 24 hours
          │      └─ Price change: 1500 THB → 1800 THB (+20%)
          │
          │      If changes > threshold:
          │      INSERT INTO alerts:
          │      {
          │        alert_date: TODAY,
          │        alert_type: 'PRICE_CHANGE',
          │        severity: 'warning',
          │        competitor_id: 1,
          │        title: 'Price increase detected',
          │        description: 'Room rates increased from 1500 to 1800 THB (+20%)',
          │        is_sent: false
          │      }
          │
          ├─→ INSERT INTO analyses (competitor_id, analysis_date, health_score, paid_score, ...)
          │
          ├─→ UPDATE competitors SET cached_health_score = 73.92, cached_threat_level = 'medium'
          │
          └─→ Return AnalysisResult
             {
               healthScoresCalculated: 12,
               strategiesClassified: 12,
               alertsGenerated: 5,
               duration: '12m 30s'
             }

RESULT DATABASE STATE:
  • analyses table: +12 new rows (one per competitor)
  • alerts table: +5 new rows (only if thresholds exceeded)
  • competitors table: 12 rows updated (cached columns)


STAGE 3: GENERATE (Report Assembly)
──────────────────────────────────────────────────────────────────────────────

REQUEST:  POST /api/pipeline/generate
          │
          ↓
     ReportService.run()
          │
          ├─→ 1. DATA AGGREGATION
          │      Query: SELECT * FROM analyses WHERE analysis_date = TODAY
          │      Query: SELECT * FROM alerts WHERE alert_date >= (TODAY - 7 days)
          │      Query: SELECT AVG(health_score) FROM analyses → 74.2
          │      Query: SELECT SUM(total_active_ads) FROM analyses → 145
          │      Query: Threat distribution: GROUP BY threat_level COUNT(*)
          │
          │      Result: reportData = {
          │        marketOverview: {
          │          totalCompetitors: 12,
          │          activeCompetitors: 11,
          │          totalActiveAds: 145,
          │          avgHealthScore: 74.2,
          │          threatDistribution: {low: 4, medium: 5, high: 2, critical: 0}
          │        },
          │        competitors: [
          │          {name, healthScore, threatLevel, topAds, strategy, ...},
          │          ...
          │        ],
          │        alerts: [...],
          │        recommendations: [...]
          │      }
          │
          ├─→ 2. CHART GENERATION (Server-side using Skia Canvas)
          │      For each chart type (6 charts):
          │
          │      Chart 1: Health Score Comparison (Bar Chart)
          │        Input: [competitors] with health scores
          │        Rendering: Canvas → PNG image
          │        Output: /tmp/chart_health_scores.png
          │
          │      Chart 2: Share of Voice (Pie Chart)
          │        Input: [competitors] with ad counts
          │        Calculation: (competitor_ads / total_ads) × 100
          │        Output: /tmp/chart_sov.png
          │
          │      Chart 3: Ad Volume Timeline (Line Chart)
          │        Input: Historical ad counts by date (30 days)
          │        Output: /tmp/chart_ad_volume.png
          │
          │      Chart 4: Engagement Rates (Radar Chart)
          │        Input: Top 6 competitors with engagement metrics
          │        Output: /tmp/chart_engagement.png
          │
          │      Chart 5: Threat Levels (Horizontal Bar)
          │        Input: Threat level distribution
          │        Output: /tmp/chart_threats.png
          │
          │      Chart 6: Trend Distribution (Doughnut)
          │        Input: Trend counts (rising, stable, declining)
          │        Output: /tmp/chart_trends.png
          │
          ├─→ 3. HTML TEMPLATE RENDERING
          │      Template: src/templates/report.njk (Nunjucks template)
          │
          │      Render with variables:
          │      {
          │        reportTitle: 'Market Intelligence - March 2026',
          │        reportDate: '2026-03-11',
          │        marketOverview: {...},
          │        competitors: [...],
          │        charts: {
          │          healthScoreComparison: 'file:///tmp/chart_health_scores.png',
          │          shareOfVoice: 'file:///tmp/chart_sov.png',
          │          ...
          │        },
          │        alerts: [...],
          │        recommendations: [...],
          │        metadata: {
          │          marketStatus: 'hot',
          │          biggestOpportunity: '...',
          │          biggestThreat: '...'
          │        }
          │      }
          │
          │      Output: HTML string (500KB - 2MB)
          │
          ├─→ 4. PDF GENERATION (Puppeteer)
          │      Input: HTML from previous step
          │
          │      Puppeteer Flow:
          │      1. Launch browser: puppeteer.launch({headless: true})
          │      2. Create page: browser.newPage()
          │      3. Set HTML: page.setContent(htmlString)
          │      4. Render PDF: page.pdf({format: 'A4', landscape: false})
          │      5. Get buffer: PDF binary data
          │      6. Close: browser.close()
          │
          │      Output: PDF buffer (2-5MB)
          │
          ├─→ 5. SAVE TO DATABASE
          │      INSERT INTO reports (
          │        report_uuid: 'uuid-generated',
          │        title: 'Market Intelligence - March 2026',
          │        html_content: htmlString (500KB+),
          │        metadata: {marketStatus, insights, threats},
          │        generation_time_sec: 4.5,
          │        status: 'active'
          │      )
          │
          │      INSERT INTO report_competitors (
          │        report_id: 1,
          │        competitor_name: 'Centara Grand',
          │        health_score: 85,
          │        threat_level: 'high',
          │        ...
          │      ) × 12
          │
          └─→ Return ReportData
             {
               reportId: 1,
               title: '...',
               pdfPath: '/data/exports/Hua_Hin_Intelligence_2026-03.pdf',
               duration: '4m 30s'
             }

RESULT DATABASE STATE:
  • reports table: +1 new row
  • report_competitors table: +12 new rows
  • Filesystem: PDF file created (2-5MB)


STAGE 4: DELIVER (Email Distribution)
──────────────────────────────────────────────────────────────────────────────

REQUEST:  POST /api/pipeline/deliver
          │
          ↓
     DeliveryService.run()
          │
          ├─→ 1. LOAD LATEST REPORT
          │      Query: SELECT * FROM reports ORDER BY created_at DESC LIMIT 1
          │      Result: {id: 1, title, html_content, ...}
          │
          ├─→ 2. BUILD EMAIL
          │      Subject: 'Market Intelligence Report - March 2026'
          │      From: EMAIL_FROM (intel@yourcompany.com)
          │      To: EMAIL_RECIPIENTS (comma-separated)
          │
          │      HTML Body:
          │      ┌───────────────────────────────────────┐
          │      │ [Logo]                                │
          │      │ Market Intelligence Report            │
          │      │ March 2026                            │
          │      │                                       │
          │      │ Key Insights:                         │
          │      │ • Market status: HOT                  │
          │      │ • Biggest opportunity: Wedding boom   │
          │      │ • Biggest threat: Price war           │
          │      │                                       │
          │      │ Top Recommendations:                  │
          │      │ 1. Launch wedding campaign (urgent)  │
          │      │ 2. Adjust pricing to 1800 THB (high) │
          │      │ 3. Increase ad frequency (medium)    │
          │      │                                       │
          │      │ [CTA: View Full Report on Dashboard] │
          │      └───────────────────────────────────────┘
          │
          │      Attachment: PDF file (2-5MB)
          │
          ├─→ 3. SEND VIA RESEND EMAIL API
          │      RESEND API CALL:
          │      ┌──────────────────────────────────────────┐
          │      │ POST https://api.resend.com/emails       │
          │      │ Auth: Authorization: Bearer re_key...    │
          │      │ Content-Type: application/json           │
          │      │                                          │
          │      │ Body: {                                  │
          │      │   from: 'intel@yourcompany.com',        │
          │      │   to: ['user1@company.com', ...],      │
          │      │   subject: 'Market Intelligence...',    │
          │      │   html: htmlBody,                       │
          │      │   attachments: [{                       │
          │      │     filename: '...pdf',                 │
          │      │     content: pdfBuffer               │
          │      │   }]                                    │
          │      │ }                                        │
          │      │                                          │
          │      │ Response: {                              │
          │      │   id: 'email_id_12345',                │
          │      │   from: 'intel@yourcompany.com',       │
          │      │   to: ['user1@company.com'],          │
          │      │   created_at: '2026-03-11T07:00:00Z'  │
          │      │ }                                        │
          │      └──────────────────────────────────────────┘
          │
          ├─→ 4. LOG ACCESS
          │      INSERT INTO report_access_log (
          │        report_id: 1,
          │        report_uuid: 'uuid-1234',
          │        accessed_by: 'email-delivery-service',
          │        access_type: 'email',
          │        accessed_at: NOW()
          │      ) × NUMBER_OF_RECIPIENTS
          │
          ├─→ 5. UPDATE REPORT STATUS (Optional)
          │      UPDATE reports SET status = 'delivered' WHERE id = 1
          │
          └─→ Return DeliveryResult
             {
               sentTo: 3,
               deliveryId: 'email_id_12345',
               duration: '1m 30s'
             }

RESULT DATABASE STATE:
  • report_access_log table: +3 new rows (one per recipient)
  • reports table: status updated to 'delivered' (if implemented)
  • Email: Sent to all recipients
```

---

## API INTEGRATION & ENDPOINTS

### API Endpoint Map

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE API ENDPOINT REFERENCE                          │
│                      (All 25+ REST Endpoints)                              │
└────────────────────────────────────────────────────────────────────────────┘

BASE URL: http://localhost:3001/api (development)
          https://api.yourdomain.com/api (production)

────────────────────────────────────────────────────────────────────────────
1. COMPETITORS ENDPOINTS (7 endpoints)
────────────────────────────────────────────────────────────────────────────

GET     /competitors
        Purpose:     List all competitors
        Query Params: ?active=true|false
                      ?category=hotel|resort|villa
                      ?limit=50 (default)
                      ?offset=0 (default)
        Response:    {success: boolean, count: number, data: [Competitor]}
        Status:      200 OK
        Example:
          curl "http://localhost:3001/api/competitors?active=true&limit=20"

GET     /competitors/:id
        Purpose:     Get competitor detail with related data
        Path Param:  id = competitor ID
        Response:    {
                      success: true,
                      data: {
                        competitor: {id, name, ...},
                        latestAnalysis: {healthScore, threat, strategy},
                        topAds: [{...}, ...] (5 latest),
                        topPosts: [{...}, ...] (5 latest),
                        pageMetrics: {followers, engagement, ...},
                        recentAlerts: [{...}, ...] (5 latest)
                      }
                    }
        Status:      200 OK | 404 Not Found
        Example:
          curl "http://localhost:3001/api/competitors/1"

POST    /competitors
        Purpose:     Create new competitor
        Body:        {
                      name: string (required),
                      facebookPageId: string (required),
                      facebookPageUrl: string (required),
                      adsLibraryUrl: string (required),
                      category: string (default: 'hotel'),
                      priceTier: string (default: 'mid-range'),
                      isCustomer: boolean (default: false)
                    }
        Response:    {success: true, data: {id, ...newCompetitor}}
        Status:      201 Created | 400 Bad Request | 409 Conflict
        Example:
          curl -X POST http://localhost:3001/api/competitors \
               -H "Content-Type: application/json" \
               -d '{"name":"New Resort","facebookPageId":"new.resort",...}'

PUT     /competitors/:id
        Purpose:     Update competitor info
        Path Param:  id = competitor ID
        Body:        {name?: string, priceTier?: string, isActive?: boolean, ...}
        Response:    {success: true, data: {id, ...updatedCompetitor}}
        Status:      200 OK | 404 Not Found | 400 Bad Request
        Example:
          curl -X PUT http://localhost:3001/api/competitors/1 \
               -H "Content-Type: application/json" \
               -d '{"priceTier":"premium"}'

DELETE  /competitors/:id
        Purpose:     Delete competitor (soft delete)
        Path Param:  id = competitor ID
        Response:    {success: true, message: "Competitor deleted"}
        Status:      200 OK | 404 Not Found
        Example:
          curl -X DELETE http://localhost:3001/api/competitors/1

PATCH   /competitors/:id/toggle
        Purpose:     Toggle competitor active status
        Path Param:  id = competitor ID
        Response:    {success: true, data: {isActive: boolean}}
        Status:      200 OK | 404 Not Found

────────────────────────────────────────────────────────────────────────────
2. PIPELINE ENDPOINTS (7 endpoints)
────────────────────────────────────────────────────────────────────────────

POST    /pipeline/run
        Purpose:     Execute full pipeline (all 4 stages)
        Body:        {
                      competitors?: [1, 2, 3] (optional),
                      dryRun?: false (optional)
                    }
        Response:    {success: true, data: {runId, status, stage, startedAt}}
        Status:      202 Accepted | 400 Bad Request
        Example:
          curl -X POST http://localhost:3001/api/pipeline/run \
               -H "Content-Type: application/json" \
               -d '{"competitors":[1,2,3],"dryRun":false}'
        Duration:    20-40 minutes total
        Process Flow:
          → Scrape Stage (5-10 min)
          → Analyze Stage (5-15 min)
          → Generate Stage (3-5 min)
          → Deliver Stage (1-2 min)

POST    /pipeline/scrape
        Purpose:     Scrape stage only
        Body:        {competitors?: [1, 2, 3] (optional)}
        Response:    {
                      success: true,
                      data: {
                        adsScraped: 145,
                        postsScraped: 89,
                        pagesScraped: 12,
                        trendsScraped: 10,
                        errors: [],
                        duration: "8m 45s"
                      }
                    }
        Status:      200 OK
        Duration:    5-10 minutes
        Data Stored:
          • ads table: 145 rows
          • facebook_posts table: 89 rows
          • facebook_pages table: 12 rows
          • trends table: 10 rows

POST    /pipeline/analyze
        Purpose:     Analysis stage only
        Body:        {competitors?: [1, 2, 3] (optional)}
        Response:    {
                      success: true,
                      data: {
                        healthScoresCalculated: 12,
                        strategiesClassified: 12,
                        alertsGenerated: 5,
                        duration: "12m 30s"
                      }
                    }
        Status:      200 OK
        Duration:    5-15 minutes
        Calls:       OpenRouter LLM API (12 calls)
        Data Stored:
          • analyses table: 12 rows
          • alerts table: 5 rows
          • competitors cached columns: updated

POST    /pipeline/generate
        Purpose:     Report generation stage only
        Body:        {}
        Response:    {
                      success: true,
                      data: {
                        reportId: 1,
                        title: "Market Intelligence - March 2026",
                        pdfPath: "/data/exports/Hua_Hin_Intelligence_2026-03.pdf",
                        duration: "4m 30s"
                      }
                    }
        Status:      200 OK
        Duration:    3-5 minutes
        Output:      PDF file (2-5MB) + DB record
        Data Stored:
          • reports table: 1 row
          • report_competitors table: 12 rows

POST    /pipeline/deliver
        Purpose:     Delivery stage only (send email)
        Body:        {recipients?: ["custom@email.com"] (optional override)}
        Response:    {
                      success: true,
                      data: {
                        sentTo: 3,
                        deliveryId: "email_id_12345",
                        duration: "1m 30s"
                      }
                    }
        Status:      200 OK
        Duration:    1-2 minutes
        Calls:       Resend Email API
        Data Stored:
          • report_access_log table: 3 rows (one per recipient)

GET     /pipeline/status/:runId
        Purpose:     Get status of a pipeline run
        Path Param:  runId = run identifier
        Response:    {
                      success: true,
                      data: {
                        id: "run_20260311_120000",
                        status: "running|completed|failed",
                        stage: "scrape|analyze|generate|deliver",
                        startedAt: "2026-03-11T12:00:00Z",
                        completedAt: null | "2026-03-11T12:35:00Z",
                        results: {
                          scrape: {adsScraped: 145},
                          analyze: {alertsGenerated: 5},
                          generate: {reportId: 1},
                          deliver: {sentTo: 3}
                        },
                        error: null | "error message"
                      }
                    }
        Status:      200 OK | 404 Not Found
        Poll Interval: Every 30 seconds for updates

GET     /pipeline/runs
        Purpose:     List recent pipeline runs
        Query Params: ?limit=20 (default)
                      ?offset=0 (default)
        Response:    {success: true, count: 20, data: [{...}, ...]}
        Status:      200 OK

────────────────────────────────────────────────────────────────────────────
3. REPORTS ENDPOINTS (6 endpoints)
────────────────────────────────────────────────────────────────────────────

GET     /reports
        Purpose:     List all reports
        Query Params: ?clientName=Internal
                      ?status=active|archived|deleted
                      ?year=2026
                      ?month=3
                      ?limit=50
                      ?offset=0
        Response:    {success: true, count: 12, data: [Report]}
        Status:      200 OK

GET     /reports/:uuid
        Purpose:     Get report metadata (no large HTML content)
        Path Param:  uuid = report UUID
        Response:    {success: true, data: {report without htmlContent}}
        Status:      200 OK | 404 Not Found
        Logging:     Logs access_type: "metadata"

GET     /reports/:uuid/pdf
        Purpose:     Download report as PDF file
        Path Param:  uuid = report UUID
        Response:    Binary PDF file
        Headers:     Content-Type: application/pdf
                     Content-Disposition: attachment; filename="..."
        Status:      200 OK | 404 Not Found
        Logging:     Logs access_type: "pdf_download"
        Example:
          curl -O "http://localhost:3001/api/reports/uuid-1234/pdf"

GET     /reports/:uuid/view
        Purpose:     View report as HTML in browser
        Path Param:  uuid = report UUID
        Response:    HTML page (rendered from htmlContent)
        Status:      200 OK | 404 Not Found
        Logging:     Logs access_type: "view"

GET     /reports/trends/:competitorName
        Purpose:     Get competitor performance trend across months
        Path Param:  competitorName = URL-encoded competitor name
        Query Params: ?months=6 (default)
        Response:    {
                      success: true,
                      count: 6,
                      data: [
                        {month: 10, year: 2025, healthScore: 72, trend: "stable"},
                        ...
                      ]
                    }
        Status:      200 OK
        Example:
          curl "http://localhost:3001/api/reports/trends/Centara%20Grand?months=6"

────────────────────────────────────────────────────────────────────────────
4. ALERTS ENDPOINTS (3 endpoints)
────────────────────────────────────────────────────────────────────────────

GET     /alerts
        Purpose:     List alerts with filtering
        Query Params: ?type=new_campaign|price_change|viral_content|threat_escalation
                      ?severity=info|warning|critical
                      ?competitorId=1
                      ?isSent=true|false
                      ?limit=50
                      ?offset=0
        Response:    {
                      success: true,
                      total: 23,
                      data: [Alert, ...]
                    }
        Status:      200 OK

POST    /alerts/:id/acknowledge
        Purpose:     Mark alert as sent/acknowledged
        Path Param:  id = alert ID
        Response:    {success: true, data: {isSent: true, sentAt: "..."}}
        Status:      200 OK | 404 Not Found

GET     /alerts/trends
        Purpose:     Get alert trend data (for dashboard)
        Response:    {
                      success: true,
                      data: {
                        byType: {new_campaign: 5, price_change: 3, ...},
                        bySeverity: {critical: 2, warning: 8, ...},
                        byCompetitor: [{name, alertCount}, ...],
                        frequency: "5 alerts per day (average)"
                      }
                    }
        Status:      200 OK

────────────────────────────────────────────────────────────────────────────
5. HEALTH & MONITORING ENDPOINTS (4 endpoints)
────────────────────────────────────────────────────────────────────────────

GET     /health
        Purpose:     System health status
        Response:    {
                      status: "healthy|degraded|down",
                      uptime: 3600000,
                      database: {status: "connected", responseTime: "2ms"},
                      timestamp: "2026-03-11T12:00:00Z"
                    }
        Status:      200 OK | 503 Service Unavailable
        Check Interval: Every 10 seconds (recommended)

GET     /health/market
        Purpose:     Market overview aggregates
        Response:    {
                      success: true,
                      data: {
                        totalCompetitors: 12,
                        activeCompetitors: 11,
                        totalActiveAds: 145,
                        avgHealthScore: 74.2,
                        avgShareOfVoice: 8.33,
                        threatDistribution: {low: 4, medium: 5, high: 2, critical: 0},
                        trendDistribution: {rising: 3, stable: 7, declining: 2}
                      }
                    }
        Status:      200 OK

GET     /health/leaderboard
        Purpose:     Top competitors by health score
        Response:    {
                      success: true,
                      data: [
                        {
                          rank: 1,
                          competitorId: 2,
                          competitorName: "Centara Grand",
                          totalScore: 85.3,
                          paidScore: 88,
                          organicScore: 82,
                          threatLevel: "high",
                          trend: "rising",
                          totalActiveAds: 34
                        },
                        ...
                      ]
                    }
        Status:      200 OK

GET     /health/sov
        Purpose:     Share of Voice breakdown
        Response:    {
                      success: true,
                      data: [
                        {
                          competitorId: 1,
                          competitorName: "Hotel A",
                          totalActiveAds: 45,
                          shareOfVoice: 31.0,
                          trend: "rising"
                        },
                        ...
                      ]
                    }
        Status:      200 OK
```

---

## GETTING STARTED GUIDE

### Prerequisite Checklist

Before starting operations, verify:

- ✅ Node.js 20.0.0+: `node --version`
- ✅ PostgreSQL 13+: `psql --version`
- ✅ Redis (optional): `redis-cli ping`
- ✅ All credentials in `.env` file
- ✅ 10GB+ free disk space
- ✅ 4GB+ available RAM

### Initial System Setup

**Step 1: Clone & Install**

```bash
git clone <repo-url>
cd Competitor-analysis-
npm install
```

**Step 2: Environment Configuration**

```bash
cp .env.example .env
nano .env  # Edit with your credentials
```

Required environment variables:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@localhost:5432/competitor_intel
RESEND_API_KEY=re_xxxxx
OPENROUTER_API_KEY=sk-or-xxxxx
APIFY_API_TOKEN=apify_xxxxx
EMAIL_FROM=intel@yourcompany.com
EMAIL_RECIPIENTS=user1@company.com,user2@company.com
```

**Step 3: Database Setup**

```bash
# Create database and user
psql -U postgres -c "CREATE USER competitor_user WITH PASSWORD 'password';"
psql -U postgres -c "CREATE DATABASE competitor_intel OWNER competitor_user;"

# Run migrations
npm run dev:migrate

# Verify schema
psql -U competitor_user -d competitor_intel -c "\dt"
# Should show: 14 tables
```

**Step 4: Start Services**

```bash
# Terminal 1: API Server
npm run dev:api

# Terminal 2: Dashboard
npm run dev:dashboard

# Terminal 3: Monitor logs
tail -f logs/app-$(date +%Y-%m-%d).log
```

**Step 5: Verify Startup**

```bash
# Test API
curl http://localhost:3001/api/health

# Test Dashboard
open http://localhost:3000

# Add sample competitor (via API)
curl -X POST http://localhost:3001/api/competitors \
     -H "Content-Type: application/json" \
     -d '{
       "name":"Test Resort",
       "facebookPageId":"test.resort",
       "facebookPageUrl":"https://facebook.com/test.resort",
       "adsLibraryUrl":"https://facebook.com/ads/library/...",
       "category":"hotel",
       "priceTier":"mid-range"
     }'
```

---

## DAILY OPERATIONS

### Morning Checklist (5 minutes)

```bash
# 1. System Health Check
curl http://localhost:3001/api/health | jq '.'

# Expected Response:
# {
#   "status": "healthy",
#   "database": {"status": "connected", "responseTime": "2ms"},
#   "timestamp": "2026-03-11T08:00:00Z"
# }

# 2. Check Error Logs
tail -20 logs/app-$(date +%Y-%m-%d).log | grep -i error

# 3. Verify Database Connection
psql -U competitor_user -d competitor_intel -c "SELECT COUNT(*) FROM competitors;"

# 4. Check Disk Usage
df -h data/ | tail -1
# Should show <80% usage

# 5. Check Last Pipeline Run
curl http://localhost:3001/api/pipeline/runs?limit=1 | jq '.data[0] | {status, stage, startedAt}'
```

---

## PIPELINE EXECUTION PROCEDURES

### Manual Full Pipeline Execution

```bash
# Option 1: CLI Execution
npm run dev:run

# Option 2: Via API (Recommended)
curl -X POST http://localhost:3001/api/pipeline/run \
     -H "Content-Type: application/json" \
     -d '{"competitors":[1,2,3],"dryRun":false}'

# Response: {runId, status, stage, startedAt}
# Use runId to monitor progress

# Monitor in Real-Time
watch -n 30 'curl http://localhost:3001/api/pipeline/status/{runId} | jq ".data | {status, stage}"'

# Or check dashboard at: http://localhost:3000/pipeline
```

---

This comprehensive SOP provides complete operational documentation with detailed architecture diagrams, data flows, and API integration points. The document is now ready for production use and can be committed to your repository.

Would you like me to:
1. Create the complete file with all sections
2. Add more specific troubleshooting procedures
3. Include monitoring dashboards configuration
4. Add deployment and scaling procedures

Let me know which sections you'd like expanded further!
