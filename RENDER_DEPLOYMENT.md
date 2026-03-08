# Render Deployment Guide — Competitor Intelligence System

Deploy the system to [Render](https://render.com) for testing without managing a VPS.

> **When to use this guide vs `DEPLOYMENT.md`**
> - **Render** → quick testing, no server management, ~$7/month
> - **Hostinger VPS** → production, full control, better performance for Playwright scraping

---

## Table of Contents

1. [How It Runs on Render](#1-how-it-runs-on-render)
2. [Cost Breakdown](#2-cost-breakdown)
3. [Prerequisites](#3-prerequisites)
4. [Deploy via Blueprint (One-Click)](#4-deploy-via-blueprint-one-click)
5. [Set Secret Environment Variables](#5-set-secret-environment-variables)
6. [Run First Migration](#6-run-first-migration)
7. [Test the Deployment](#7-test-the-deployment)
8. [Trigger a Manual Pipeline Run](#8-trigger-a-manual-pipeline-run)
9. [Monitor Logs](#9-monitor-logs)
10. [Known Render Limitations](#10-known-render-limitations)
11. [Tear Down](#11-tear-down)

---

## 1. How It Runs on Render

```
render.yaml defines:
  ┌─────────────────────────────────────────────────────┐
  │  PostgreSQL 16 (managed)                             │
  │    competitor_intel database + competitor_user        │
  └─────────────────────────┬───────────────────────────┘
                            │ DATABASE_URL auto-wired
  ┌─────────────────────────▼───────────────────────────┐
  │  Web Service: competitor-intel  (Starter plan)       │
  │    Build:  npm ci → playwright install → tsc build   │
  │    Start:  render-start.sh → node dist/scheduler.js  │
  │    Health: GET /health (checked every 30s by Render) │
  │    Cron:   fires at 23:00 UTC (06:00 Bangkok) daily  │
  └─────────────────────────────────────────────────────┘
```

**What `render-start.sh` does on each deploy:**
1. Maps Render's dynamic `PORT` → `HEALTH_PORT` for the health check server
2. Auto-detects the Playwright Chromium binary path
3. Creates `/tmp` directories for screenshots and PDF exports
4. Runs database migrations automatically
5. Starts `dist/scheduler.js`

---

## 2. Cost Breakdown

| Resource          | Plan       | Cost           | Notes                           |
|-------------------|------------|----------------|---------------------------------|
| PostgreSQL        | Free       | $0 (90 days)   | Upgrade to Starter after trial  |
| Web Service       | Starter    | ~$7/month      | Required — keeps cron alive 24/7|
| **Total**         |            | **~$7/month**  | After the 90-day DB free trial  |

> **Free tier web services spin down after 15 minutes of inactivity.** The internal
> cron job would not fire at the scheduled time. The **Starter plan** ($7/month) keeps
> the service awake 24/7 — this is required for reliable scheduling.

---

## 3. Prerequisites

- [ ] GitHub or GitLab account with this repository pushed
- [ ] Render account — [sign up free](https://dashboard.render.com/register)
- [ ] Resend account + API key — [resend.com](https://resend.com)
- [ ] Anthropic API key — [console.anthropic.com](https://console.anthropic.com)
- [ ] A verified sending domain in Resend (or use Resend's free `@resend.dev` domain for testing)

---

## 4. Deploy via Blueprint (One-Click)

The `render.yaml` file in this repo defines all services as Infrastructure as Code.

### Step 1 — Push to GitHub

```bash
git add render.yaml render-start.sh
git commit -m "Add Render deployment config"
git push origin main
```

### Step 2 — Create Blueprint

1. Go to **[Render Dashboard](https://dashboard.render.com)** → **Blueprints** (left sidebar)
2. Click **New Blueprint Instance**
3. Connect your GitHub/GitLab account if not already done
4. Select your repository → click **Connect**
5. Render detects `render.yaml` automatically

### Step 3 — Configure Blueprint

Render shows a preview of services to be created:

```
Will create:
  ✓  PostgreSQL  competitor-intel-db   (free)
  ✓  Web Service  competitor-intel     (starter)
```

- Leave the **Service Group Name** as default or rename it
- Click **Apply**

Render starts provisioning. The first build takes **5–10 minutes** (Playwright install + tsc build).

### Step 4 — Wait for Build to Complete

Watch the build logs in **Dashboard → competitor-intel → Logs**:

```
==> Installing dependencies
==> npm ci
==> PLAYWRIGHT_BROWSERS_PATH=... npx playwright install --with-deps chromium
  Downloading Chromium 131.0.6778.33...
==> npm run build
==> Copying templates to dist/reports/
==> Build succeeded 🎉
==> Starting service with 'bash render-start.sh'
[render-start] Health check server port: 10000
[render-start] Chromium found: /opt/render/project/.playwright/chromium-xxx/chrome-linux/chrome
[render-start] Migrations applied successfully.
[render-start] Starting scheduler (node dist/scheduler.js)...
```

---

## 5. Set Secret Environment Variables

`render.yaml` marks 5 variables as `sync: false` — they must be set manually (never stored in git).

1. In Render Dashboard → **competitor-intel** → **Environment** tab
2. Add each variable:

| Variable              | Value                                        | Example                                   |
|-----------------------|----------------------------------------------|-------------------------------------------|
| `RESEND_API_KEY`      | Your Resend API key                          | `re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `EMAIL_FROM`          | Verified sender name + email                 | `Competitor Intel <intel@yourdomain.com>` |
| `EMAIL_RECIPIENTS`    | Comma-separated recipient list               | `you@example.com,manager@example.com`     |
| `EMAIL_TEST_RECIPIENT`| Your personal email for test emails         | `you@example.com`                         |
| `OPENROUTER_API_KEY`  | Your OpenRouter API key                      | `sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`   |

3. Click **Save Changes** → Render will auto-redeploy with the new variables

> **Resend free tier note:** On the Resend free plan, you can only send to verified email addresses
> unless you add a custom domain. For quick testing, use your own email as both sender and recipient
> with the free `@resend.dev` domain: `EMAIL_FROM=Competitor Intel <onboarding@resend.dev>`

---

## 6. Run First Migration

The `render-start.sh` auto-runs migrations on every startup, so the tables are created automatically on first boot. Verify by checking the logs:

```
[render-start] Running database migrations...
[render-start] Migrations applied successfully.
```

To verify manually, use the Render **Shell** tab (Dashboard → competitor-intel → Shell):

```bash
node dist/db/migrations/run.js
```

Or check the database directly:

```bash
psql "$DATABASE_URL" -c "\dt"
```

Expected output — 9 tables:

```
 Schema |      Name        | Type  |      Owner
--------+------------------+-------+-----------------
 public | ads              | table | competitor_user
 public | alerts           | table | competitor_user
 public | analyses         | table | competitor_user
 public | competitors      | table | competitor_user
 public | facebook_pages   | table | competitor_user
 public | facebook_posts   | table | competitor_user
 public | follower_history  | table | competitor_user
 public | reports          | table | competitor_user
 public | trends           | table | competitor_user
```

---

## 7. Test the Deployment

### Test Email Delivery

In the Render Shell:

```bash
node dist/index.js test-email
```

Check your inbox — you should receive the test email within 30 seconds.

### Test Health Endpoint

Your service URL is shown in the Render Dashboard (e.g. `https://competitor-intel-xxxx.onrender.com`).

```bash
curl https://competitor-intel-xxxx.onrender.com/health
```

Expected:

```json
{
  "status": "ok",
  "uptime": "0h 12m 34s",
  "startedAt": "2025-01-15T10:00:00.000Z",
  "isRunning": false,
  "totalRuns": 0,
  "successfulRuns": 0,
  "failedRuns": 0
}
```

### Test Scraper (Single Competitor)

In the Render Shell:

```bash
node dist/index.js scrape -c 1 --dry-run
```

---

## 8. Trigger a Manual Pipeline Run

### Option A — HTTP endpoint

```bash
curl -X POST https://competitor-intel-xxxx.onrender.com/trigger
```

Response:

```json
{ "message": "Pipeline triggered" }
```

### Option B — Render Shell

```bash
node dist/index.js run
```

### Option C — Run individual stages

```bash
# Scrape only
node dist/index.js scrape

# Analyze only
node dist/index.js analyze

# Generate report PDF
node dist/index.js generate

# Deliver report email
node dist/index.js deliver
```

---

## 9. Monitor Logs

### Live Logs

In **Render Dashboard → competitor-intel → Logs**, you can filter:

- All logs: `competitor`
- Errors only: search `ERROR`
- Pipeline runs: search `STAGE`
- Email events: search `EmailDelivery`

### Last Run Status

```bash
curl https://competitor-intel-xxxx.onrender.com/last-run | python3 -m json.tool
```

Example response after a successful run:

```json
{
  "startedAt": "2025-01-15T23:00:01.000Z",
  "finishedAt": "2025-01-15T25:23:00.000Z",
  "duration": "2h 23m 0s",
  "status": "success",
  "stages": [
    { "name": "scrape",   "status": "success", "durationMs": 4500000 },
    { "name": "analyze",  "status": "success", "durationMs": 2100000 },
    { "name": "generate", "status": "success", "durationMs": 45000 },
    { "name": "deliver",  "status": "success", "durationMs": 3000 }
  ]
}
```

---

## 10. Known Render Limitations

### No Persistent Disk

Render Starter web services do not have persistent disk storage. Files written to `/tmp` are lost on each redeploy. This is acceptable because:

- Screenshots are temporary by design
- PDFs are emailed during the same pipeline run
- The database stores all persistent state

If you need to download PDFs, attach a [Render Disk](https://render.com/docs/disks) ($0.25/GB/month):

```yaml
# Add to the web service in render.yaml:
disk:
  name: competitor-intel-data
  mountPath: /data
  sizeGB: 5
```

Then update env vars to use `/data/exports` and `/data/screenshots`.

### Playwright on Shared IPs

Render's outbound IPs are shared with thousands of other services. Meta's Ads Library and Facebook may detect and block scraping from cloud provider IPs more aggressively than from residential/VPS IPs. If scraping fails consistently:

1. Check logs for `ERR_CONNECTION_REFUSED` or login-wall detection
2. Reduce `SCRAPER_REQUEST_DELAY_MS` to `6000` or higher
3. For production, use the Hostinger VPS — dedicated IP with better success rates

### Build Time

The first build takes 5–10 minutes due to Playwright's Chromium download (~150MB). Subsequent builds use Render's build cache and complete in 2–3 minutes.

### Cron Accuracy

Render's node-cron runs inside the Node.js process. If the service restarts mid-day (e.g., due to a deploy), the next cron trigger will be the following day at 23:00 UTC. To run immediately after a restart:

```bash
curl -X POST https://competitor-intel-xxxx.onrender.com/trigger
```

---

## 11. Tear Down

To remove all resources and stop billing:

1. **Render Dashboard → Blueprints → [Your Blueprint] → Delete Blueprint**
   - This removes all services in the blueprint group
2. Or delete individually:
   - Dashboard → competitor-intel → Settings → Delete Service
   - Dashboard → competitor-intel-db → Settings → Delete Database

> **Warning:** Deleting the database is permanent. Export data first:
> ```bash
> pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql
> ```

---

## Quick Reference

```bash
# Check health
curl https://competitor-intel-xxxx.onrender.com/health

# Check last run
curl https://competitor-intel-xxxx.onrender.com/last-run

# Trigger manual run
curl -X POST https://competitor-intel-xxxx.onrender.com/trigger

# In Render Shell — test email
node dist/index.js test-email

# In Render Shell — run full pipeline
node dist/index.js run

# In Render Shell — single competitor scrape (dry-run)
node dist/index.js scrape -c 1 --dry-run
```
