#!/usr/bin/env bash
# =============================================================================
# render-start.sh — Render startup wrapper for Competitor Intelligence System
#
# This script runs BEFORE node dist/scheduler.js to:
#   1. Map Render's dynamic PORT to HEALTH_PORT (the health check server)
#   2. Auto-detect the exact Playwright Chromium binary path
#   3. Create required /tmp directories
#   4. Run database migrations automatically on each deploy
#   5. Exec the compiled scheduler
#
# Render sets PORT dynamically — it changes between deploys.
# We must listen on $PORT or Render's health checks will fail.
# =============================================================================

set -euo pipefail

log()  { echo "[render-start] $*"; }
warn() { echo "[render-start] WARNING: $*" >&2; }

log "========================================="
log "  Competitor Intelligence System"
log "  Render Startup — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
log "========================================="

# ─────────────────────────────────────────────────────────────────────────────
# 1. Port mapping
#    Render assigns a random PORT via env var. Our health server reads HEALTH_PORT.
# ─────────────────────────────────────────────────────────────────────────────

export HEALTH_PORT="${PORT:-10000}"
log "Health check server port: $HEALTH_PORT (from Render PORT=$PORT)"

# ─────────────────────────────────────────────────────────────────────────────
# 2. Chromium binary detection
#    Playwright installs to $PLAYWRIGHT_BROWSERS_PATH during build.
#    We find the exact chrome binary and export it for both Playwright and Puppeteer.
# ─────────────────────────────────────────────────────────────────────────────

PLAYWRIGHT_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/render/project/.playwright}"
log "Looking for Chromium in: $PLAYWRIGHT_PATH"

# Find the chrome binary — exclude helper/crashpad binaries
CHROMIUM_BIN=$(find "$PLAYWRIGHT_PATH" -name "chrome" \
  -not -path "*chrome_crashpad_handler*" \
  -not -path "*chrome-sandbox*" \
  -not -name "*.so" \
  -type f 2>/dev/null | head -1 || true)

if [[ -n "$CHROMIUM_BIN" ]]; then
  export CHROMIUM_EXECUTABLE_PATH="$CHROMIUM_BIN"
  export PUPPETEER_EXECUTABLE_PATH="$CHROMIUM_BIN"
  log "Chromium found: $CHROMIUM_BIN"
  # Verify it's executable
  if [[ ! -x "$CHROMIUM_BIN" ]]; then
    chmod +x "$CHROMIUM_BIN" 2>/dev/null || warn "Could not chmod $CHROMIUM_BIN"
  fi
else
  warn "Chromium binary not found under $PLAYWRIGHT_PATH"
  warn "Scraping stages will fail. Check your build logs."
  warn "Build command must include: PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_PATH npx playwright install --with-deps chromium"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. Temp directory creation
#    Render's ephemeral filesystem — /tmp persists during the service lifetime
#    but is cleared on each new deploy. PDFs are emailed during the same run.
# ─────────────────────────────────────────────────────────────────────────────

log "Creating temp directories..."
mkdir -p \
  /tmp/competitor-intel/exports \
  /tmp/competitor-intel/screenshots

log "Directories ready:"
log "  exports:     /tmp/competitor-intel/exports"
log "  screenshots: /tmp/competitor-intel/screenshots"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Database migrations
#    Run on every startup so new deploys automatically apply schema changes.
#    Safe to re-run — migration runner uses IF NOT EXISTS checks.
# ─────────────────────────────────────────────────────────────────────────────

log "Running database migrations..."
if node dist/db/migrations/run.js; then
  log "Migrations applied successfully."
else
  warn "Migrations failed — check DATABASE_URL and DB_SSL settings."
  warn "The scheduler will still start; DB errors will surface at runtime."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. Environment summary
# ─────────────────────────────────────────────────────────────────────────────

log "-----------------------------------------"
log "Environment:"
log "  NODE_ENV:             ${NODE_ENV:-production}"
log "  DB_HOST:              ${DB_HOST:-<from DATABASE_URL>}"
log "  DB_NAME:              ${DB_NAME:-competitor_intel}"
log "  DB_SSL:               ${DB_SSL:-true}"
log "  OPENROUTER_MODEL:     ${OPENROUTER_MODEL:-anthropic/claude-3.5-haiku}"
log "  SCRAPER_HEADLESS:     ${SCRAPER_HEADLESS:-true}"
log "  CHROMIUM_PATH:        ${CHROMIUM_EXECUTABLE_PATH:-not set}"
log "  HEALTH_PORT:          $HEALTH_PORT"
log "-----------------------------------------"

# ─────────────────────────────────────────────────────────────────────────────
# 6. Start scheduler
#    exec replaces this shell with node — process signals (SIGTERM etc.) are
#    forwarded directly to the Node.js process for graceful shutdown.
# ─────────────────────────────────────────────────────────────────────────────

log "Starting scheduler (node dist/scheduler.js)..."
exec node dist/scheduler.js
