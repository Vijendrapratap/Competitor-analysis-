# Deployment Guide — Competitor Intelligence System

Complete step-by-step deployment instructions for **Hostinger VPS** running Ubuntu 22.04.

---

## Table of Contents

1. [VPS Requirements](#1-vps-requirements)
2. [Initial Server Setup](#2-initial-server-setup)
3. [Application Deployment](#3-application-deployment)
4. [PM2 Setup](#4-pm2-setup)
5. [Monitoring](#5-monitoring)
6. [Maintenance](#6-maintenance)
7. [Security Hardening](#7-security-hardening)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. VPS Requirements

| Requirement       | Minimum            | Recommended        |
|-------------------|--------------------|--------------------|
| **Plan**          | Hostinger KVM2     | KVM4 or higher     |
| **RAM**           | 4 GB               | 8 GB               |
| **CPU**           | 2 vCPU             | 4 vCPU             |
| **Storage**       | 50 GB SSD          | 100 GB SSD         |
| **OS**            | Ubuntu 22.04 LTS   | Ubuntu 22.04 LTS   |
| **Network**       | Public IPv4         | IPv4 + IPv6        |

**Software stack installed by setup script:**

- Node.js 20 LTS
- PostgreSQL 16
- Chromium (system) + Playwright dependencies *(legacy — only used for Facebook Page metrics)*
- PM2 (process manager)
- UFW firewall + Fail2Ban

> **Note (2026-03 Migration):** Meta Ads and Facebook Posts scraping now use Apify cloud API. Playwright is only needed for Facebook Page metrics. Set `APIFY_API_TOKEN` in `.env`.

---

## 2. Initial Server Setup

### 2.1 SSH Access

**On your local machine**, generate an SSH key if you don't have one:

```bash
ssh-keygen -t ed25519 -C "competitor-intel-deploy"
```

Copy your public key to the server (replace `YOUR_SERVER_IP`):

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@YOUR_SERVER_IP
```

Connect to the server:

```bash
ssh root@YOUR_SERVER_IP
```

### 2.2 Disable Password Authentication

```bash
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
```

### 2.3 Run the Setup Script

Upload and execute the automated setup script:

```bash
# From your local machine
scp vps-setup.sh root@YOUR_SERVER_IP:/root/

# On the server
ssh root@YOUR_SERVER_IP
chmod +x /root/vps-setup.sh
bash /root/vps-setup.sh
```

The script will:

- Update all system packages
- Install Node.js 20 LTS
- Install PostgreSQL 16 and create the database + user
- Install Chromium and Playwright system dependencies
- Create the `competitor` application user
- Install PM2 globally
- Create the directory structure at `/home/competitor/competitor-intel-system`
- Generate a stub `.env` file with a random database password
- Configure UFW firewall (allow SSH, 80, 443)

**Save the database password** printed at the end of the script output.

### 2.4 Verify Firewall

```bash
ufw status verbose
```

Expected output:

```
Status: active
Default: deny (incoming), allow (outgoing)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
```

---

## 3. Application Deployment

### 3.1 Switch to Application User

```bash
sudo -u competitor bash
cd ~/competitor-intel-system
```

### 3.2 Clone the Repository

```bash
# If deploying from Git
git clone https://github.com/YOUR_ORG/competitor-intel-system.git .

# Or upload via SCP from your local machine
# scp -r ./dist ./src ./package.json ./tsconfig.json ./ecosystem.config.js competitor@YOUR_SERVER_IP:~/competitor-intel-system/
```

### 3.3 Install Dependencies

```bash
npm ci --omit=dev
```

If you need to build from source (TypeScript):

```bash
npm ci
npm run build
```

### 3.4 Install Playwright Browsers

```bash
npx playwright install chromium
```

Verify Chromium works:

```bash
npx playwright install --dry-run
which chromium-browser
```

### 3.5 Configure Environment Variables

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

**Required values to fill in:**

```env
# Database (use the password from vps-setup.sh output)
DATABASE_URL=postgresql://competitor_user:YOUR_DB_PASSWORD@localhost:5432/competitor_intel
DB_PASSWORD=YOUR_DB_PASSWORD

# Apify (primary scraping backend)
APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email delivery
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Competitor Intel <intel@yourdomain.com>
EMAIL_RECIPIENTS=analyst@yourdomain.com,manager@yourdomain.com
EMAIL_TEST_RECIPIENT=developer@yourdomain.com

# AI (Strategy classifier + recommendations)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Chromium paths (legacy — only needed for FB Page metrics scraper)
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
PLAYWRIGHT_BROWSERS_PATH=/home/competitor/.cache/ms-playwright

# File paths (production defaults)
PDF_OUTPUT_DIR=/home/competitor/competitor-intel-system/data/exports
SCREENSHOTS_DIR=/home/competitor/competitor-intel-system/data/screenshots
REPORTS_DIR=/home/competitor/competitor-intel-system/data/exports
TEMPLATES_DIR=/home/competitor/competitor-intel-system/src/reports/templates

# Health check endpoint
HEALTH_PORT=3000
```

### 3.6 Run Database Migrations

```bash
npm run migrate:direct
```

This creates all 9 tables and seeds the 30 default Hua Hin hotel competitors.

Verify the database:

```bash
psql -U competitor_user -d competitor_intel -c "\dt"
```

Expected tables: `competitors`, `ads`, `facebook_pages`, `facebook_posts`, `analyses`, `trends`, `alerts`, `reports`, `follower_history`.

### 3.7 Send Test Email

```bash
node --import tsx/esm src/index.ts test-email
```

Check that the test email arrives in your inbox.

### 3.8 Test Scraper Manually

Run a dry-run scrape for one competitor to verify everything works:

```bash
node --import tsx/esm src/index.ts scrape -c 1 --dry-run
```

Run a full single-competitor test:

```bash
node --import tsx/esm src/index.ts run -c 1
```

---

## 4. PM2 Setup

### 4.1 Install PM2 (if not already done by setup script)

```bash
sudo npm install -g pm2
```

### 4.2 Start the Application

```bash
cd ~/competitor-intel-system
pm2 start ecosystem.config.js --only competitor-intel
```

Verify it's running:

```bash
pm2 status
pm2 logs competitor-intel --lines 20
```

### 4.3 Enable Startup on Boot

```bash
pm2 startup
# Copy and run the command PM2 outputs, e.g.:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u competitor --hp /home/competitor

pm2 save
```

### 4.4 Configure PM2 Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD
pm2 set pm2-logrotate:workerInterval 3600
```

### 4.5 Verify the Schedule

The scheduler runs daily at **23:00 UTC** (06:00 Bangkok time). Check the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "uptime": "0h 5m 12s",
  "startedAt": "2025-01-15T10:00:00.000Z",
  "isRunning": false,
  "totalRuns": 0,
  "successfulRuns": 0,
  "failedRuns": 0
}
```

### 4.6 Trigger a Manual Run (Optional)

```bash
curl -X POST http://localhost:3000/trigger
```

Or use the CLI directly:

```bash
pm2 start ecosystem.config.js --only competitor-intel-run
```

---

## 5. Monitoring

### 5.1 PM2 Commands

```bash
# Live process dashboard
pm2 monit

# Process list with CPU/memory
pm2 status

# View live logs
pm2 logs competitor-intel

# View last 100 lines of logs
pm2 logs competitor-intel --lines 100

# View only errors
pm2 logs competitor-intel --err --lines 50

# Process details
pm2 describe competitor-intel

# Restart the scheduler
pm2 restart competitor-intel

# Stop the scheduler
pm2 stop competitor-intel
```

### 5.2 Log File Locations

| Log File                        | Description                       |
|---------------------------------|-----------------------------------|
| `logs/pm2-out.log`             | PM2 stdout (scheduler output)     |
| `logs/pm2-error.log`           | PM2 stderr (errors)               |
| `logs/app-YYYY-MM-DD.log`      | Application combined log (Winston)|
| `logs/error-YYYY-MM-DD.log`    | Application error log (Winston)   |
| `~/.pm2/logs/`                 | PM2 system-level logs             |

### 5.3 Health Check Endpoints

| Endpoint         | Method | Description                          |
|------------------|--------|--------------------------------------|
| `/health`        | GET    | Uptime, run counts, current status   |
| `/last-run`      | GET    | Last pipeline run details and stages |
| `/trigger`       | POST   | Manually trigger a pipeline run      |

### 5.4 External Monitoring (Optional)

Set up an external uptime check with a cron job or service like UptimeRobot:

```
URL: http://YOUR_SERVER_IP:3000/health
Interval: 5 minutes
Alert when: status != 200 or body does not contain "ok"
```

---

## 6. Maintenance

### 6.1 Update the Application

```bash
sudo -u competitor bash
cd ~/competitor-intel-system

# Pull latest code
git pull origin main

# Install dependencies
npm ci

# Build (if using compiled JS)
npm run build

# Run any new migrations
npm run migrate:direct

# Restart PM2
pm2 restart competitor-intel
pm2 save
```

**Zero-downtime update** (waits for current pipeline to finish):

```bash
# Check if pipeline is currently running
curl http://localhost:3000/health | jq '.isRunning'

# If false, proceed with update
pm2 stop competitor-intel
git pull origin main && npm ci && npm run build
npm run migrate:direct
pm2 start competitor-intel
pm2 save
```

### 6.2 Database Backup

**Daily automated backup** — add to the `competitor` user's crontab:

```bash
crontab -e
```

Add this line:

```cron
0 22 * * * pg_dump -U competitor_user competitor_intel | gzip > /home/competitor/backups/db-$(date +\%Y\%m\%d).sql.gz 2>> /home/competitor/logs/backup.log
```

Create the backup directory:

```bash
mkdir -p ~/backups
```

**Manual backup:**

```bash
pg_dump -U competitor_user competitor_intel > ~/backups/db-manual-$(date +%Y%m%d-%H%M%S).sql
```

**Restore from backup:**

```bash
psql -U competitor_user competitor_intel < ~/backups/db-20250115.sql
```

**Cleanup old backups (keep last 30 days):**

```bash
find ~/backups -name "db-*.sql.gz" -mtime +30 -delete
```

Add to crontab for automatic cleanup:

```cron
0 23 * * 0 find /home/competitor/backups -name "db-*.sql.gz" -mtime +30 -delete
```

### 6.3 Log Cleanup

Winston logs auto-rotate (14-day retention for combined, 30-day for errors). For PM2 logs:

```bash
# Flush PM2 logs manually
pm2 flush

# Check disk usage
du -sh ~/competitor-intel-system/logs/
du -sh ~/backups/
df -h
```

### 6.4 Data Directory Cleanup

```bash
# Check screenshot disk usage
du -sh ~/competitor-intel-system/data/screenshots/
du -sh ~/competitor-intel-system/data/exports/

# Remove old exports (keep last 60 days)
find ~/competitor-intel-system/data/exports -name "*.pdf" -mtime +60 -delete
find ~/competitor-intel-system/data/exports -name "*.html" -mtime +60 -delete
```

---

## 7. Security Hardening

### 7.1 SSH — Key-Only Authentication

Already configured in step 2.2. Verify:

```bash
grep PasswordAuthentication /etc/ssh/sshd_config
# Should show: PasswordAuthentication no
```

Change the default SSH port (optional):

```bash
# Edit sshd_config
sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
ufw allow 2222/tcp
ufw delete allow ssh
systemctl restart sshd
```

### 7.2 Firewall Rules

```bash
# Current rules
ufw status numbered

# Add a rule (e.g., allow health check from specific IP only)
ufw allow from YOUR_OFFICE_IP to any port 3000 proto tcp

# Block health endpoint from public internet
ufw deny 3000/tcp
```

Recommended production rules:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp        # SSH (or your custom port)
ufw allow 80/tcp        # HTTP (if needed for web dashboard)
ufw allow 443/tcp       # HTTPS
# Health check — restrict to monitoring IPs only
ufw allow from YOUR_MONITORING_IP to any port 3000
```

### 7.3 Database Access Restricted

PostgreSQL is configured to accept local connections only. Verify:

```bash
sudo grep -E "^(local|host)" /etc/postgresql/16/main/pg_hba.conf
```

Expected — the app user should only have `local` or `127.0.0.1` access:

```
local   competitor_intel   competitor_user   md5
```

**Never expose port 5432 to the internet.** Verify:

```bash
ufw status | grep 5432
# Should show nothing (no rule = blocked by default deny)
```

### 7.4 Environment Variables Protected

```bash
# .env should be readable only by the app user
ls -la ~/competitor-intel-system/.env
# -rw------- 1 competitor competitor ... .env

# Ensure correct permissions
chmod 600 ~/competitor-intel-system/.env
```

**Never commit `.env` to git.** Verify it's in `.gitignore`:

```bash
grep '.env' ~/competitor-intel-system/.gitignore
```

### 7.5 Fail2Ban

Installed by the setup script. Check status:

```bash
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

### 7.6 Automatic Security Updates

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 8. Troubleshooting

### Pipeline Not Running

```bash
# Check scheduler is alive
pm2 status
curl http://localhost:3000/health

# Check last run for errors
curl http://localhost:3000/last-run | jq .

# Check logs
pm2 logs competitor-intel --err --lines 50
tail -50 ~/competitor-intel-system/logs/error-$(date +%Y-%m-%d).log
```

### Scraper Failing

**Apify (Meta Ads / Facebook Posts):**

```bash
# Check Apify token is set
grep APIFY_API_TOKEN ~/competitor-intel-system/.env

# Test a single competitor via CLI
node --import tsx/esm src/index.ts scrape -c 1

# Check logs for Apify errors
grep -i "apify\|actor" ~/competitor-intel-system/logs/app-$(date +%Y-%m-%d).log
```

**Playwright (Facebook Page Metrics — legacy):**

```bash
# Test Chromium manually
chromium-browser --headless --dump-dom https://example.com

# Check Playwright installation
npx playwright install --dry-run

# Re-install Playwright browsers
npx playwright install chromium

# Test a single competitor
node --import tsx/esm src/index.ts scrape -c 1
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U competitor_user -d competitor_intel -c "SELECT count(*) FROM competitors;"

# Check connection string in .env
grep DATABASE_URL ~/competitor-intel-system/.env

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Email Not Sending

```bash
# Test email delivery
node --import tsx/esm src/index.ts test-email

# Check Resend API key
grep RESEND_API_KEY ~/competitor-intel-system/.env

# Check logs for email errors
grep -i "email\|resend" ~/competitor-intel-system/logs/app-$(date +%Y-%m-%d).log
```

### Out of Memory

```bash
# Check current memory usage
free -h
pm2 describe competitor-intel | grep memory

# PM2 auto-restarts at 1G (configured in ecosystem.config.js)
# If persistent, increase VPS RAM or reduce concurrent scraping

# Check for memory leaks
pm2 monit
```

### Disk Space Full

```bash
# Check disk usage
df -h
du -sh ~/competitor-intel-system/data/*
du -sh ~/competitor-intel-system/logs/*
du -sh ~/backups/*

# Clean up
find ~/competitor-intel-system/data/exports -name "*.pdf" -mtime +30 -delete
find ~/competitor-intel-system/data/screenshots -mtime +7 -delete
pm2 flush
```

### PM2 Won't Start on Boot

```bash
# Re-generate startup script
pm2 unstartup
pm2 startup

# Run the printed command with sudo, then:
pm2 save

# Verify
sudo systemctl status pm2-competitor
```

---

## Quick Reference

```bash
# Start everything
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs competitor-intel

# Manual pipeline run
curl -X POST http://localhost:3000/trigger

# Health check
curl http://localhost:3000/health

# Database backup
pg_dump -U competitor_user competitor_intel | gzip > ~/backups/db-$(date +%Y%m%d).sql.gz

# Update application
git pull && npm ci && npm run build && pm2 restart competitor-intel
```
