# 📘 COMPETITOR INTELLIGENCE SYSTEM — STANDARD OPERATING PROCEDURES

**Version**: 1.0.0
**Last Updated**: March 2026
**Target Audience**: Developers, DevOps, Operations Team
**Emergency Contact**: On-call Engineer (escalation@example.com)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [Daily Operations](#daily-operations)
4. [Pipeline Execution](#pipeline-execution)
5. [API Management](#api-management)
6. [Database Operations](#database-operations)
7. [Troubleshooting](#troubleshooting)
8. [Incident Response](#incident-response)
9. [Rollback Procedures](#rollback-procedures)
10. [Maintenance Checklist](#maintenance-checklist)

---

## SYSTEM OVERVIEW

### What is the Competitor Intelligence System?

A production system that:
1. **Scrapes** competitor marketing data daily (Meta Ads, Facebook, Google Trends)
2. **Analyzes** the data using AI to generate health scores and strategies
3. **Generates** PDF reports with charts and insights
4. **Delivers** reports via email to stakeholders

### Critical Components
- **CLI Tool** (`npm run dev:scrape|analyze|generate|deliver`)
- **Express API** (Port 3001) - REST endpoints for dashboard and manual triggers
- **Next.js Dashboard** (Port 3000) - Web UI for monitoring and control
- **PostgreSQL Database** - Central data store (14 tables)
- **Apify Actors** - Web scraping service
- **OpenRouter** - LLM API for analysis
- **Resend** - Email delivery service

### System State Diagram

```
┌─────────┐    ┌─────────────────┐    ┌────────────┐    ┌──────────┐
│  IDLE   │───>│ SCRAPING DATA   │───>│ ANALYZING  │───>│GENERATING│
└─────────┘    └─────────────────┘    └────────────┘    └──────────┘
                                                                │
                                                                ▼
                                                         ┌──────────────┐
                                                         │   SENDING    │
                                                         │    EMAIL     │
                                                         └──────────────┘
```

---

## GETTING STARTED

### Prerequisites

**System Requirements**:
- Node.js 20.0.0 or higher
- PostgreSQL 13+ running and accessible
- 4GB RAM minimum
- 10GB disk space for data/reports
- macOS, Linux, or Windows WSL2

**Required Credentials** (in `.env` file):
- `DATABASE_URL` or DB connection params
- `RESEND_API_KEY` - Email service
- `OPENROUTER_API_KEY` - LLM analysis
- `APIFY_API_TOKEN` - Web scraping

### Initial Setup

**Step 1: Clone and Install**
```bash
git clone <repo-url>
cd Competitor-analysis-
npm install
```

**Step 2: Configure Environment**
```bash
cp .env.example .env
# Edit .env with your actual credentials
nano .env
```

**Required .env Settings**:
```
DATABASE_URL=postgresql://competitor_user:password@localhost:5432/competitor_intel
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxxxxxxx
APIFY_API_TOKEN=apify_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=intel@yourcompany.com
EMAIL_RECIPIENTS=user@yourcompany.com,manager@yourcompany.com
```

**Step 3: Set Up Database**
```bash
# Create database and user (if not exists)
psql -U postgres -c "CREATE USER competitor_user WITH PASSWORD 'your_password';"
psql -U postgres -c "CREATE DATABASE competitor_intel OWNER competitor_user;"

# Apply schema migrations
npm run dev:migrate

# Verify schema loaded
psql -U competitor_user -d competitor_intel -c "\dt"
# Output should show 14 tables
```

**Step 4: Verify Configuration**
```bash
# Type check
npm run typecheck

# Test database connection
npm run dev:api
# Should start on http://localhost:3001

# Test API health
curl http://localhost:3001/api/health
# Should return: { status: "healthy", ... }
```

**Step 5: Add Sample Data**
```bash
# If testing, add sample competitors
psql -U competitor_user -d competitor_intel <<EOF
INSERT INTO competitors (name, facebook_page_id, facebook_page_url, ads_library_url, category, price_tier, is_active)
VALUES ('Test Resort', 'test.resort', 'https://facebook.com/test.resort', 'https://facebook.com/ads/library/...', 'hotel', 'premium', true);
EOF

# Verify
npm run dev:api
# Navigate to http://localhost:3000
# Should see competitor in list
```

---

## DAILY OPERATIONS

### Morning Checklist (Start of Business Day)

**Task 1: Verify System Status** (5 minutes)
```bash
# Check API is running
curl http://localhost:3001/api/health

# Check database connection
psql -U competitor_user -d competitor_intel -c "SELECT COUNT(*) FROM competitors;"

# Check logs for errors from overnight
tail -50 logs/app-$(date +%Y-%m-%d).log | grep -i error

# Monitor disk usage
df -h | grep data
# Should have <80% disk usage
```

**Expected Output**:
```json
{
  "status": "healthy",
  "database": { "status": "connected", "responseTime": "2ms" },
  "timestamp": "2026-03-11T08:00:00Z"
}
```

**Task 2: Check Pipeline Runs** (5 minutes)
```bash
# Via API - Get last 5 runs
curl http://localhost:3001/api/pipeline/runs?limit=5

# Expected: Latest run should be from overnight (02:00 UTC scrape)
# Status should be "completed"
```

**Task 3: Review Alerts** (10 minutes)
```bash
# Get critical alerts
curl "http://localhost:3001/api/alerts?severity=critical&isSent=false"

# If any critical alerts:
# 1. Review details
# 2. Investigate root cause
# 3. Mark as sent after review
# 4. Escalate if needed
```

**Task 4: Monitor Dashboard** (10 minutes)
```bash
# Open http://localhost:3000 in browser
# Review:
# - Market overview (total competitors, ads, health score)
# - Health score leaderboard
# - Recent alerts
# - Share of Voice changes
# - Note any unusual spikes
```

### Hourly Monitoring

**Every Hour - Run Health Check**:
```bash
# Automated check (add to crontab)
curl -s http://localhost:3001/api/health | jq '.status'

# If not "healthy":
# 1. Check PostgreSQL: psql -U competitor_user -d competitor_intel -c "SELECT 1;"
# 2. Check API logs: tail logs/app-*.log
# 3. Restart API: npm run dev:api (or PM2 restart)
```

### Daily Execution Schedule

**02:00 UTC - Scrape Stage** (Automatic via cron)
```bash
# Verify execution
tail -20 logs/app-$(date +%Y-%m-%d).log | grep -i scrape

# Expected log:
# [2026-03-11 02:00:00] INFO ScrapeService.run starting
# [2026-03-11 02:45:00] INFO ✓ Scrape completed: 145 ads, 89 posts

# If failed:
# - Check external service status: Apify, Facebook API
# - Manually trigger: npm run dev:scrape
# - Check logs for error details
```

**04:00 UTC - Analyze Stage** (Automatic)
```bash
# Verify execution
tail -20 logs/app-$(date +%Y-%m-%d).log | grep -i analyze

# Expected log:
# [2026-03-11 04:00:00] INFO AnalysisService.run starting
# [2026-03-11 04:15:00] INFO ✓ Analysis completed: 12 health scores, 5 alerts

# If failed:
# - Check OpenRouter API status
# - Check LLM API key validity
# - Manually trigger: npm run dev:analyze
```

**Monday 06:00 UTC - Generate Report** (Automatic, weekly)
```bash
# Verify execution
tail -30 logs/app-$(date +%Y-%m-%d).log | grep -i generate

# Expected log:
# [2026-03-11 06:00:00] INFO ReportService.run starting
# [2026-03-11 06:20:00] INFO ✓ Report generated: ID 5, file size 2.3MB

# Check report file exists
ls -lh data/exports/*.pdf | tail -1

# If failed:
# - Check disk space: df -h data/
# - Check Puppeteer availability
# - Manually trigger: npm run dev:generate
```

**Monday 07:00 UTC - Email Delivery** (Automatic, weekly)
```bash
# Verify execution
tail -20 logs/app-$(date +%Y-%m-%d).log | grep -i deliver

# Expected log:
# [2026-03-11 07:00:00] INFO DeliveryService.run starting
# [2026-03-11 07:05:00] INFO ✓ Email sent to 3 recipients

# If failed:
# - Check Resend API key
# - Verify recipient email addresses
# - Check spam folder for delivery
# - Manually trigger: npm run dev:deliver
```

### Evening Shutdown Checklist

**End of Day Review** (15 minutes):
```bash
# Check final pipeline status
curl http://localhost:3001/api/pipeline/runs?limit=1

# Review error logs for today
grep -i error logs/app-$(date +%Y-%m-%d).log | tail -10

# Verify tomorrow's cron jobs scheduled
# (if using PM2)
pm2 list

# Note any issues for follow-up next day
```

---

## PIPELINE EXECUTION

### Manual Trigger: Full Pipeline

**When to Use**: Test run, catch-up after maintenance, urgent report needed

**Step 1: Prepare**
```bash
# Ensure system is healthy
curl http://localhost:3001/api/health

# Choose option:
# Option A: CLI (for background execution)
# Option B: API (for tracking via dashboard)
```

**Step 2A: Via CLI (Background)**
```bash
# Full pipeline (all competitors)
npm run dev:run

# Specific competitors only
npm run dev:run -- -c 1,2,3

# Dry run (preview, no DB writes)
npm run dev:run -- --dry-run

# With force flag (re-scrape even if fresh)
npm run dev:run -- --force

# Monitor in separate terminal
tail -f logs/app-$(date +%Y-%m-%d).log
```

**Step 2B: Via API (Recommended for Tracking)**
```bash
# Start pipeline
curl -X POST http://localhost:3001/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{
    "competitors": [1, 2, 3],
    "dryRun": false
  }'

# Response includes runId, use it to track progress
# Response: { "runId": "run_20260311_142530", "status": "running" }

# Poll status every 30 seconds
curl http://localhost:3001/api/pipeline/status/run_20260311_142530

# Or watch in dashboard: http://localhost:3000/pipeline
# - See real-time progress
# - View logs
# - Download report when complete
```

**Step 3: Monitor Execution**
```bash
# Watch logs in real-time
tail -f logs/app-$(date +%Y-%m-%d).log | grep -E "Scrape|Analyze|Generate|Deliver"

# Expected progression:
# [1] Scrape: Starting → 145 ads scraped → Completed (5-10 min)
# [2] Analyze: Starting → 12 competitors analyzed → Completed (5-15 min)
# [3] Generate: Starting → PDF created → Completed (3-5 min)
# [4] Deliver: Starting → Email sent → Completed (1 min)

# Total time: 20-40 minutes
```

**Step 4: Verify Results**
```bash
# Check new report created
curl http://localhost:3001/api/reports?limit=1

# Check health scores updated
curl http://localhost:3001/api/health/leaderboard

# Verify email sent (if delivery stage ran)
# - Check inbox for report email
# - Check Resend dashboard: https://resend.com/dashboard

# Check database records
psql -U competitor_user -d competitor_intel <<EOF
SELECT COUNT(*) as ad_count FROM ads WHERE scraped_at > NOW() - INTERVAL '1 hour';
SELECT COUNT(*) as analysis_count FROM analyses WHERE created_at > NOW() - INTERVAL '1 hour';
SELECT COUNT(*) as report_count FROM reports WHERE created_at > NOW() - INTERVAL '1 hour';
EOF
```

### Manual Trigger: Individual Stages

**Scrape Only**
```bash
# CLI approach
npm run dev:scrape

# API approach
curl -X POST http://localhost:3001/api/pipeline/scrape \
  -H "Content-Type: application/json" \
  -d '{ "competitors": [1, 2, 3] }'

# Typical duration: 5-10 minutes
# Outputs: Ads, posts, page metrics, trends inserted into DB
```

**Analyze Only**
```bash
# CLI approach
npm run dev:analyze

# API approach
curl -X POST http://localhost:3001/api/pipeline/analyze \
  -H "Content-Type: application/json" \
  -d '{ "competitors": [1, 2, 3] }'

# Typical duration: 5-15 minutes (depends on LLM latency)
# Outputs: Health scores, strategies, alerts inserted into DB
```

**Generate Only**
```bash
# CLI approach
npm run dev:generate

# API approach
curl -X POST http://localhost:3001/api/pipeline/generate \
  -H "Content-Type: application/json" \
  -d '{}'

# Typical duration: 3-5 minutes
# Output: PDF file created in ./data/exports/
# Database: Reports table updated
```

**Deliver Only**
```bash
# CLI approach
npm run dev:deliver

# API approach
curl -X POST http://localhost:3001/api/pipeline/deliver \
  -H "Content-Type: application/json" \
  -d '{ "recipients": ["override@example.com"] }'

# Typical duration: 1 minute
# Output: Email sent via Resend
# Database: report_access_log updated
```

### Emergency: Restart Pipeline

**Scenario**: Pipeline stuck, needs immediate restart

```bash
# Step 1: Kill running processes
# Via PM2 (if using PM2):
pm2 stop all
pm2 start all

# Or manually:
# Kill Node processes: lsof -ti:3000,3001 | xargs kill -9

# Step 2: Clear any lock files
rm -f .lock
rm -f pipeline.lock

# Step 3: Check database for stale pipeline_runs records
psql -U competitor_user -d competitor_intel <<EOF
UPDATE pipeline_runs SET status = 'failed', error = 'Restarted by operator'
WHERE status = 'running' AND started_at < NOW() - INTERVAL '2 hours';
EOF

# Step 4: Restart services
npm run dev:api &
npm run dev:run  # Restart pipeline

# Step 5: Monitor logs
tail -f logs/app-$(date +%Y-%m-%d).log
```

---

## API MANAGEMENT

### Starting the API Server

```bash
# Development mode (with live reload)
npm run dev:api

# Production mode (compiled code)
npm run build
npm start

# With PM2 (recommended for production)
pm2 start ecosystem.config.js --only api
pm2 logs api

# Verify startup
sleep 3 && curl http://localhost:3001/api/health

# Expected output:
# { "status": "healthy", "database": { "status": "connected" }, ... }
```

### API Debugging

**Check API Logs**
```bash
# Last 100 lines
tail -100 logs/app-*.log | grep API

# Real-time monitoring
tail -f logs/app-$(date +%Y-%m-%d).log

# Filter by log level
grep "ERROR\|ERROR_HANDLER" logs/app-*.log

# Check specific endpoint calls
grep "GET /api/health\|POST /api/pipeline" logs/app-*.log
```

**Test Endpoints**
```bash
# Health check
curl http://localhost:3001/api/health | jq '.'

# List competitors
curl http://localhost:3001/api/competitors | jq '.data | length'

# Get market overview
curl http://localhost:3001/api/health/market | jq '.data'

# List reports
curl http://localhost:3001/api/reports | jq '.data | length'
```

**API Response Codes**

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Proceed normally |
| 400 | Bad Request | Check request format, parameters |
| 401 | Unauthorized | Check API authentication (if applicable) |
| 404 | Not Found | Check endpoint path, resource ID |
| 500 | Server Error | Check API logs, restart if needed |
| 503 | Service Unavailable | Check database connection, external services |

### Updating API Code

**Safe Deployment Steps**:

```bash
# Step 1: Code changes committed and ready
git status  # Should be clean

# Step 2: Type checking
npm run typecheck
# Must show: "0 errors"

# Step 3: Build
npm run build
# Check: dist/ directory created, no build errors

# Step 4: Backup current (if production)
cp -r dist dist.backup.$(date +%s)

# Step 5: Deploy
# Via PM2:
pm2 restart api

# Or manually:
# Kill current API: lsof -ti:3001 | xargs kill -9
# Start new: npm run dev:api &

# Step 6: Verify
sleep 5 && curl http://localhost:3001/api/health

# If health check fails, rollback:
# rm -rf dist && mv dist.backup.* dist
# Restart API again
```

### API Rate Limiting (Future Enhancement)

Currently no rate limiting. If needed:
- Use `express-rate-limit` npm package
- Configure: 100 requests per minute per IP
- Configure: 1000 requests per hour per endpoint

---

## DATABASE OPERATIONS

### Database Connection

**Direct Access**
```bash
# Connect to PostgreSQL
psql -U competitor_user -d competitor_intel -h localhost

# Or via connection string
PGPASSWORD=password psql -U competitor_user -h localhost -d competitor_intel
```

**Connection String (for reference)**
```
postgresql://competitor_user:password@localhost:5432/competitor_intel
```

### Common Database Queries

**View System Status**
```sql
-- Count records by table
SELECT
  'competitors' as table_name, COUNT(*) as count FROM competitors
UNION ALL
SELECT 'ads', COUNT(*) FROM ads
UNION ALL
SELECT 'analyses', COUNT(*) FROM analyses
UNION ALL
SELECT 'reports', COUNT(*) FROM reports
UNION ALL
SELECT 'alerts', COUNT(*) FROM alerts;

-- Output:
-- competitors | 12
-- ads         | 145
-- analyses    | 12
-- reports     | 5
-- alerts      | 23
```

**Find Recent Activity**
```sql
-- Recent ads scraped
SELECT COUNT(*) as recent_ads FROM ads
WHERE scraped_at > NOW() - INTERVAL '24 hours';

-- Recent analyses
SELECT competitor_id, health_score, threat_level, analysis_date
FROM analyses
WHERE analysis_date = CURRENT_DATE
ORDER BY health_score DESC;

-- Recent alerts
SELECT alert_type, severity, COUNT(*) as count
FROM alerts
WHERE alert_date > CURRENT_DATE - INTERVAL '7 days'
GROUP BY alert_type, severity;
```

**Database Maintenance**
```sql
-- Analyze query performance
ANALYZE competitors;
ANALYZE ads;
ANALYZE analyses;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan as index_scans
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC LIMIT 10;

-- Check missing indexes
SELECT * FROM pg_stat_user_tables
WHERE n_live_tup > 1000 AND seq_scan > idx_scan * 10
ORDER BY seq_scan DESC;
```

### Backups

**Manual Backup**
```bash
# Full database dump
pg_dump -U competitor_user -d competitor_intel > backup_$(date +%Y%m%d).sql

# Compressed backup (recommended)
pg_dump -U competitor_user -d competitor_intel | gzip > backup_$(date +%Y%m%d).sql.gz

# Verify backup size
ls -lh backup_*.sql.gz

# Expected size: 50-100 MB per month of data
```

**Restore from Backup**
```bash
# WARNING: This will replace all current data

# Step 1: Stop API and pipeline
pm2 stop all

# Step 2: Restore
gunzip -c backup_20260301.sql.gz | psql -U competitor_user -d competitor_intel

# Step 3: Verify restoration
psql -U competitor_user -d competitor_intel -c "SELECT COUNT(*) FROM competitors;"

# Step 4: Restart services
pm2 start all
```

**Automated Backups** (via crontab)
```bash
# Edit crontab
crontab -e

# Add daily backup at 01:00 UTC
0 1 * * * pg_dump -U competitor_user -d competitor_intel | gzip > /backups/competitor_intel_$(date +\%Y\%m\%d).sql.gz

# Cleanup old backups (keep 30 days)
0 2 * * * find /backups -name "*.sql.gz" -mtime +30 -delete
```

### Schema Migrations

**When to Migrate**: Adding new tables, columns, or indexes

**Process**:
```bash
# Step 1: Edit schema
# File: src/db/schema.ts
# Add new table or column definition

# Step 2: Create migration SQL
# File: src/db/migrations/run.ts
# Add corresponding ALTER TABLE / CREATE TABLE statements

# Step 3: Type check
npm run typecheck

# Step 4: Test on staging
# Run migrations: npm run dev:migrate
# Verify: psql -c "\dt" shows all tables

# Step 5: Deploy
# Commit changes to git
# Run in production: npm run migrate
# Verify: psql -U competitor_user -d competitor_intel -c "\dt"
```

**Important**: Always update BOTH files in sync:
- `src/db/schema.ts` (Drizzle ORM definition)
- `src/db/migrations/run.ts` (Raw SQL)

Failure to sync results in: "column does not exist" errors

---

## TROUBLESHOOTING

### Problem: Pipeline Fails at Scrape Stage

**Symptoms**:
```
[ERROR] ScrapeService.run failed: Unable to fetch Meta Ads
```

**Investigation**:
```bash
# Step 1: Check external service status
# - Facebook: Is Meta Ads Library accessible?
# - Apify: Check https://apify.com/status

# Step 2: Verify Apify credentials
echo $APIFY_API_TOKEN  # Should output token
# If empty: source .env or export APIFY_API_TOKEN=...

# Step 3: Test Apify API manually
curl -X GET "https://api.apify.com/v2/users/me" \
  -H "Authorization: Bearer $APIFY_API_TOKEN"
# Should return user info, not 401 Unauthorized

# Step 4: Check logs for specific error
tail -50 logs/app-*.log | grep -i "apify\|scrape"
```

**Solutions**:
```bash
# Solution 1: Wait and retry (if external service down)
# Wait 30 minutes, manually trigger:
npm run dev:scrape

# Solution 2: Update Apify token (if expired)
# 1. Get new token: https://apify.com/settings/integrations
# 2. Update .env: APIFY_API_TOKEN=new_token
# 3. Restart: npm run dev:api

# Solution 3: Check network connectivity
ping api.apify.com
curl -I https://api.apify.com/v2/users/me
# Should get response, not timeout

# Solution 4: Increase timeout (if slow network)
# Edit src/config/settings.ts
SCRAPER_TIMEOUT_MS=60000  # 60 seconds instead of 30

# Solution 5: Reduce competitor scope (if overloaded)
# Scrape fewer competitors:
npm run dev:scrape -- -c 1,2,3  # Only these 3
```

### Problem: API Returns 500 Errors

**Symptoms**:
```
POST /api/pipeline/run
Response: 500 Internal Server Error
Logs: Error: Connection timeout
```

**Investigation**:
```bash
# Step 1: Check database connection
psql -U competitor_user -d competitor_intel -c "SELECT 1;"
# Should return: 1

# Step 2: Check database logs
# On the database server:
tail -20 /var/log/postgresql/postgresql.log | grep ERROR

# Step 3: Check PostgreSQL status
sudo systemctl status postgresql  # Linux
brew services list | grep postgres  # macOS

# Step 4: Check connection pool usage
psql -U competitor_user -d competitor_intel <<EOF
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
EOF
# Should show <10 connections for competitor_intel
```

**Solutions**:
```bash
# Solution 1: Increase connection pool size
# Edit .env: DB_POOL_MAX=20
# Restart: npm run dev:api

# Solution 2: Restart database connection
# Kill stale connections:
psql -U competitor_user -d competitor_intel <<EOF
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'competitor_intel'
  AND pid <> pg_backend_pid();
EOF

# Solution 3: Check for long-running queries
psql -U competitor_user -d competitor_intel <<EOF
SELECT pid, usename, application_name, query_start, state
FROM pg_stat_activity
WHERE state = 'active'
  AND query_start < NOW() - INTERVAL '5 minutes';
EOF
# Kill if needed: SELECT pg_terminate_backend(pid);

# Solution 4: Restart API
lsof -ti:3001 | xargs kill -9
npm run dev:api &
```

### Problem: LLM Analysis Fails or Times Out

**Symptoms**:
```
[ERROR] LLM call failed: 408 Request Timeout
       or
[ERROR] LLM call failed: 503 Service Unavailable
```

**Investigation**:
```bash
# Step 1: Verify OpenRouter API key
echo $OPENROUTER_API_KEY  # Should output token (length ~40)

# Step 2: Test OpenRouter API directly
curl -X POST https://openrouter.ai/api/v1/messages \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "test"}],
    "max_tokens": 100
  }'
# Should return a response, not error

# Step 3: Check for rate limiting
# Look for 429 status codes in logs
grep "429\|rate limit" logs/app-*.log

# Step 4: Check cache hit rate
tail -100 logs/app-*.log | grep -i "cache"
# Healthy: ~20-30% cache hit rate
```

**Solutions**:
```bash
# Solution 1: Increase LLM timeout
# Edit src/intelligence/llmAnalyzer.ts
const TIMEOUT_MS = 60000;  // 60 seconds instead of 30

# Solution 2: Reduce concurrent LLM calls
# Current: 5 concurrent
# Edit src/intelligence/llmAnalyzer.ts
const MAX_CONCURRENT = 2;  // Lower concurrency

# Solution 3: Wait if rate limited
# OpenRouter has daily/hourly limits
# Check dashboard: https://openrouter.ai/usage
# Solution: Upgrade plan or wait for reset

# Solution 4: Use fallback model
# Edit src/intelligence/llmAnalyzer.ts
const FALLBACK_MODEL = 'google/gemini-2.0-flash-001';
# Auto-retries with fallback on primary model failure

# Solution 5: Clear cache if corrupted
rm -rf cache/llm/*.json
# Will force fresh LLM calls next run
```

### Problem: Email Delivery Fails

**Symptoms**:
```
[ERROR] DeliveryService: Failed to send email
        Error: Invalid API key
```

**Investigation**:
```bash
# Step 1: Verify Resend API key
echo $RESEND_API_KEY  # Should output token

# Step 2: Check email configuration
grep "EMAIL_" .env

# Step 3: Check Resend dashboard
# https://resend.com/dashboard
# - Verify API key matches
# - Check rate limits (default: 100/day)
# - Check verified domains

# Step 4: Test Resend API directly
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "delivered@resend.dev",
    "subject": "hello world",
    "html": "<strong>it works!</strong>"
  }'
# Should return success, not 401
```

**Solutions**:
```bash
# Solution 1: Update Resend API key (if expired)
# 1. Get new key: https://resend.com/api-keys
# 2. Update .env: RESEND_API_KEY=re_new_key_here
# 3. Restart: npm run dev:api

# Solution 2: Verify sender email is configured
# Email must match verified domain in Resend
# Update .env: EMAIL_FROM=user@yourdomain.com
# Add domain to Resend if not already verified

# Solution 3: Check email recipient limits
# Resend has daily rate limits
# Check: https://resend.com/settings/api-tokens
# Solution: Upgrade plan or increase limit

# Solution 4: Manually send test email
npm run dev:api
curl -X POST http://localhost:3001/api/pipeline/deliver \
  -H "Content-Type: application/json" \
  -d '{}'
# Check logs for detailed error message

# Solution 5: Check email address format
# Recipient emails must be valid
psql -U competitor_user -d competitor_intel <<EOF
SELECT EMAIL_RECIPIENTS FROM settings;
EOF
# Format: email1@domain.com,email2@domain.com (no spaces)
```

### Problem: High Memory Usage or Out of Memory

**Symptoms**:
```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

**Investigation**:
```bash
# Step 1: Check current memory usage
ps aux | grep node
# Look for "RES" column (resident memory)

# Step 2: Check for memory leaks
# Monitor memory over time:
watch -n 5 'ps aux | grep node'
# If memory keeps growing, likely a leak

# Step 3: Check what's consuming memory
# - Large LLM responses cached
# - Large result sets from database
# - Unreleased file handles

# Step 4: Check disk space (swap memory)
df -h /
# Should have >2GB free

# Step 5: Review logs for large operations
grep -i "processing\|fetched\|loaded" logs/app-*.log | tail -20
```

**Solutions**:
```bash
# Solution 1: Increase Node.js heap size
# Default: 512MB, Increase to 2GB:
node --max-old-space-size=2048 dist/index.js

# Or in npm scripts:
# Edit package.json:
"start": "NODE_OPTIONS=--max-old-space-size=2048 node dist/index.js"

# Solution 2: Process fewer competitors per run
npm run dev:scrape -- -c 1,2,3  # Instead of all competitors

# Solution 3: Increase interval between operations
# Edit scheduler to space out stages more:
# Scrape: 02:00, Analyze: 06:00 (was 04:00)
# This reduces concurrent load

# Solution 4: Clear cache files
rm -rf cache/llm/*.json
rm -rf data/screenshots/*.png

# Solution 5: Restart service to clear memory
pm2 restart all
# Or manually: kill and restart Node process

# Solution 6: Check for memory leak in code
# Add debugging:
setInterval(() => {
  const mem = process.memoryUsage();
  console.log('Memory:', Math.round(mem.heapUsed / 1024 / 1024) + 'MB');
}, 10000);
```

---

## INCIDENT RESPONSE

### Incident Severity Levels

| Level | Definition | Response Time | Example |
|-------|-----------|----------------|---------|
| P1 - Critical | System down, no workaround | <15 min | Database unreachable, API crashes |
| P2 - High | Feature broken, impacts users | <1 hour | Email delivery fails, health scores wrong |
| P3 - Medium | Feature degraded | <4 hours | Slow API responses, occasional errors |
| P4 - Low | Minor issue, no user impact | <1 day | Documentation error, warning logs |

### P1: Critical Incident - System Down

**Checklist**:
```
[ ] 1. Declare incident started (record time)
[ ] 2. Identify affected component(s)
[ ] 3. Activate incident commander
[ ] 4. Assemble response team
[ ] 5. Start incident bridge (Slack #incidents)
[ ] 6. Investigate root cause
[ ] 7. Implement fix or workaround
[ ] 8. Verify system recovered
[ ] 9. Monitor for 30 minutes
[ ] 10. Post-mortem within 24 hours
```

**Response Steps**:

```bash
# Step 1: Assess damage
curl http://localhost:3001/api/health
# If 500 error or no response: API is down

# Step 2: Try to restart API
pm2 restart api
sleep 5
curl http://localhost:3001/api/health

# Step 3: If still down, check database
psql -U competitor_user -d competitor_intel -c "SELECT 1;"
# If fails: Database is down

# Step 4: If database is down, check status
sudo systemctl status postgresql  # Linux
pg_isready -h localhost -U competitor_user  # Check connection

# Step 5: Restart PostgreSQL
sudo systemctl restart postgresql

# Step 6: Restart API after DB recovery
pm2 restart api
sleep 10
curl http://localhost:3001/api/health

# Step 7: If still failing, check logs
tail -100 logs/app-*.log | grep ERROR

# Step 8: Last resort - full restart
pm2 stop all
pm2 start all
sleep 10
curl http://localhost:3001/api/health
```

**Communication**:
```markdown
@channel INCIDENT P1: Competitor Intel System Down
Reported: 2026-03-11 12:30 UTC
Status: INVESTIGATING
Impact: Dashboard and reports unavailable
Updated: Every 5 minutes
```

### P2: High Priority - Feature Broken

**Example**: Email delivery fails, but system otherwise operational

```bash
# Step 1: Isolate problem
# Test non-email functions
curl http://localhost:3001/api/reports  # Works?
npm run dev:scrape  # Works?
npm run dev:generate  # Works?

# Step 2: Diagnose specific issue
# If only email broken:
npm run dev:deliver

# Check logs for error
grep -i "email\|resend\|deliver" logs/app-*.log | tail -20

# Step 3: Fix (example: invalid API key)
# Update .env
RESEND_API_KEY=re_correct_key
# Restart API
pm2 restart api

# Step 4: Verify fix
npm run dev:deliver

# Step 5: Escalate if can't fix within 1 hour
# Engage on-call engineer, open incident ticket
```

### P3: Medium Priority - Degraded Performance

**Example**: API responds slowly (>5 seconds)

```bash
# Step 1: Identify slow endpoints
# Check logs for response times
grep "GET\|POST" logs/app-*.log | grep "[5-9][0-9][0-9][0-9]ms\|[0-9][0-9][0-9][0-9][0-9]ms"

# Step 2: Check system load
top  # Process view
htop  # Better view if available

# Step 3: Profile slow query
# If database slow:
psql -U competitor_user -d competitor_intel <<EOF
EXPLAIN ANALYZE SELECT * FROM competitors;
EOF

# Step 4: Scale response
# Increase resources or optimize query
# Escalate to senior engineer if unclear

# Step 5: Monitor improvement
# Track response times before/after fix
time curl http://localhost:3001/api/competitors
```

### P4: Low Priority - Minor Issues

**Example**: Warning logs, documentation typo

```bash
# Step 1: Create ticket (no emergency response needed)
# Example: "API returns 200 but should log INFO level"

# Step 2: Fix when time permits
# Schedule in next sprint

# Step 3: Document workaround if needed
# Add to Slack #known-issues
```

### Post-Incident Review

**Within 24 hours of any P1-P2 incident**:

```markdown
# Post-Incident Review: [Incident Name]

## Timeline
- 2026-03-11 12:30 UTC: Incident detected
- 2026-03-11 12:35 UTC: Root cause identified (corrupted DB index)
- 2026-03-11 12:50 UTC: System recovered
- **Total Duration**: 20 minutes

## Root Cause
Database index corruption due to power outage during migration

## Actions Taken
1. Restarted PostgreSQL
2. Rebuilt indexes: REINDEX DATABASE
3. Verified data integrity

## Preventive Measures
1. Add UPS (uninterruptible power supply) to database server
2. Schedule migrations during maintenance window only
3. Implement database backup verification script
4. Add monitoring alert for index health

## Responsible Party
- Investigation: Engineer A
- Follow-up actions: Engineer B (deadline: 2026-03-20)
```

---

## ROLLBACK PROCEDURES

### Code Rollback (If Recent Deploy Broke System)

**Scenario**: Deployed new code, API now crashing

```bash
# Step 1: Stop current version
pm2 stop api

# Step 2: Check git history
git log --oneline -5
# Output:
# abc1234 (HEAD) Fix API performance
# def5678 Add new alert type
# ghi9012 Refactor database queries
# ...

# Step 3: Identify last known good version
# Check when issue started: 12:45 UTC
# Search logs for error
grep "12:4[5-9]\|13:[0-5]" logs/app-2026-03-11.log | grep ERROR

# Step 4: Revert to previous commit
git revert HEAD  # Creates new commit that undoes changes
# OR reset if multiple commits broken:
git reset --hard ghi9012  # Reset to ghi9012

# Step 5: Rebuild
npm run build

# Step 6: Restart API
pm2 start api

# Step 7: Verify
sleep 5 && curl http://localhost:3001/api/health

# Step 8: If still broken, go further back
git reset --hard def5678
npm run build
pm2 restart api
```

**Important**: Only use `git reset --hard` if:
1. No pending commits to preserve
2. This is a deployment emergency
3. Otherwise use `git revert` (safer)

### Database Rollback (If Migration Broke Schema)

**Scenario**: Added new column, now getting errors

```bash
# Step 1: Identify the issue
tail -50 logs/app-*.log | grep -i "column does not exist\|migration"

# Step 2: Restore from backup
# File: backup_20260310.sql.gz (from day before migration)

# Step 3: Stop application
pm2 stop all

# Step 4: Drop current database (DANGEROUS - confirm backup exists!)
# Verify backup is valid
gunzip -t backup_20260310.sql.gz  # Should succeed with no output

# Step 5: Restore from backup
dropdb -U postgres competitor_intel
createdb -U postgres competitor_intel -O competitor_user
gunzip -c backup_20260310.sql.gz | psql -U competitor_user -d competitor_intel

# Step 6: Verify restoration
psql -U competitor_user -d competitor_intel -c "SELECT COUNT(*) FROM competitors;"
# Should match count from before migration

# Step 7: Restart application
pm2 start all

# Step 8: Monitor logs
tail -f logs/app-$(date +%Y-%m-%d).log | grep -i error
```

### Data Rollback (If Analysis Produced Wrong Results)

**Scenario**: Health scores calculated incorrectly, need to recompute

```bash
# Step 1: Identify affected date
# Scores calculated on 2026-03-11 at 04:00 UTC

# Step 2: Backup current data
pg_dump -U competitor_user -d competitor_intel > backup_before_recompute.sql

# Step 3: Delete affected analyses
psql -U competitor_user -d competitor_intel <<EOF
DELETE FROM analyses WHERE analysis_date = '2026-03-11';
DELETE FROM alerts WHERE alert_date = '2026-03-11';
UPDATE competitors SET cached_health_score = NULL, cached_threat_level = NULL;
EOF

# Step 4: Recompute analyses
npm run dev:analyze

# Step 5: Verify new scores
curl http://localhost:3001/api/health/leaderboard | jq '.data[0]'
# Should show recent health scores

# Step 6: Compare before/after
# If worse, restore backup and investigate root cause
# psql -U competitor_user -d competitor_intel < backup_before_recompute.sql
```

---

## MAINTENANCE CHECKLIST

### Daily Maintenance (5 minutes)
- [ ] Check API health: `curl http://localhost:3001/api/health`
- [ ] Review error logs: `grep ERROR logs/app-*.log`
- [ ] Verify database accessible: `psql -c "SELECT 1;"`
- [ ] Check disk usage: `df -h data/`

### Weekly Maintenance (30 minutes, Sundays)
- [ ] Review system performance metrics
- [ ] Check PostgreSQL query performance: `ANALYZE competitors;`
- [ ] Verify backups completed: `ls -lh backup_*.sql.gz`
- [ ] Clean old reports: `find data/exports -mtime +30 -delete`
- [ ] Review application logs for warnings
- [ ] Test manual pipeline execution

### Monthly Maintenance (1 hour, 1st Sunday)
- [ ] Security update check: `npm audit`
- [ ] Database full backup verification (restore test)
- [ ] Review API rate limits and capacity
- [ ] Check external service status (Apify, Resend, OpenRouter)
- [ ] Update environment variables if needed
- [ ] Document any changes or observations
- [ ] Verify disaster recovery plan still valid

### Quarterly Maintenance (2 hours)
- [ ] Full system security audit
- [ ] Performance benchmarking
- [ ] Capacity planning review
- [ ] Test complete disaster recovery scenario
- [ ] Review and update SOP/documentation
- [ ] Team training/knowledge sharing

### Seasonal Checks (Yearly, 4 times per year)

**Q1 (January)**:
- [ ] Verify all API integrations still working (Apify, Resend, OpenRouter)
- [ ] Check expiring certificates or API keys (due dates)
- [ ] Update dependencies: `npm update`

**Q2 (April)**:
- [ ] Load testing with production dataset
- [ ] Database optimization and re-indexing
- [ ] Review and archive old reports

**Q3 (July)**:
- [ ] Full security audit and penetration testing
- [ ] Update disaster recovery documentation
- [ ] Test failover to backup database

**Q4 (October)**:
- [ ] Plan infrastructure upgrades
- [ ] Review next year's capacity needs
- [ ] Prepare for holiday/year-end surge in reports

### Backup Verification Checklist

Every month, verify backup can be restored:

```bash
# Step 1: List recent backups
ls -lh backup_*.sql.gz | tail -3

# Step 2: Pick one to test restore
BACKUP_FILE="backup_20260310.sql.gz"

# Step 3: Create test database
createdb -U postgres competitor_intel_test -O competitor_user

# Step 4: Restore to test DB
gunzip -c $BACKUP_FILE | psql -U competitor_user -d competitor_intel_test

# Step 5: Verify data integrity
psql -U competitor_user -d competitor_intel_test <<EOF
-- Check row counts match expected
SELECT 'competitors' as table_name, COUNT(*) FROM competitors
UNION ALL
SELECT 'ads', COUNT(*) FROM ads
UNION ALL
SELECT 'analyses', COUNT(*) FROM analyses;

-- Check indexes exist
\di

-- Check recent data
SELECT MAX(created_at) as latest_creation FROM reports;
EOF

# Step 6: Cleanup test database
dropdb -U postgres competitor_intel_test

# Step 7: Document result in backup log
echo "$(date): Verified $BACKUP_FILE - OK" >> backup_verification.log
```

---

## Emergency Contacts

**On-Call Escalation**:
1. Primary Engineer: +1-XXX-XXX-XXXX
2. Secondary Engineer: +1-XXX-XXX-XXXX
3. Database Admin: +1-XXX-XXX-XXXX
4. Manager: +1-XXX-XXX-XXXX

**External Services**:
- Apify Status: https://apify.com/status
- Resend Status: https://status.resend.com
- OpenRouter Status: https://status.openrouter.io
- PostgreSQL Documentation: https://www.postgresql.org/docs/

---

**Document Version**: 1.0.0
**Last Updated**: March 2026
**Next Review**: June 2026
**Owner**: DevOps & Operations Team

---

## Document Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Document Owner | [Name] | 2026-03-11 | ______________ |
| Tech Lead | [Name] | 2026-03-11 | ______________ |
| Operations Manager | [Name] | 2026-03-11 | ______________ |
| Security Officer | [Name] | 2026-03-11 | ______________ |

