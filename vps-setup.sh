#!/usr/bin/env bash
# =============================================================================
# VPS Setup Script — Ubuntu 22.04 (Hostinger)
# Target: Node.js 20 LTS + PostgreSQL 16 + Playwright/Chromium + PM2
# Run as root on a fresh server: bash vps-setup.sh
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}[✔]${NC} $*"; }
info() { echo -e "${CYAN}[→]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
die()  { echo -e "${RED}[✖] ERROR: $*${NC}" >&2; exit 1; }

# ── Config ───────────────────────────────────────────────────────────────────
APP_USER="competitor"
APP_HOME="/home/${APP_USER}"
APP_DIR="${APP_HOME}/competitor-intel-system"
DB_NAME="competitor_intel"
DB_USER="competitor_user"
DB_PASS="${POSTGRES_PASSWORD:-$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 24)}"
NODE_MAJOR=20
PG_VERSION=16

# ── Guard: must be root ───────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Run this script as root (sudo bash $0)"

echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  VPS Setup — Competitor Intel System      ${NC}"
echo -e "${BOLD}${CYAN}══════════════════════════════════════════${NC}\n"

# =============================================================================
# 1. SYSTEM UPDATE
# =============================================================================
info "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq \
  -o Dpkg::Options::="--force-confdef" \
  -o Dpkg::Options::="--force-confold"
apt-get install -yq \
  curl wget gnupg2 ca-certificates lsb-release \
  software-properties-common apt-transport-https \
  build-essential git unzip jq \
  ufw fail2ban htop \
  openssl
log "System updated."

# =============================================================================
# 2. NODE.JS 20 LTS  (via NodeSource)
# =============================================================================
info "Installing Node.js ${NODE_MAJOR} LTS..."
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -ne $NODE_MAJOR ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -yq nodejs
fi
node -v; npm -v
log "Node.js $(node -v) installed."

# =============================================================================
# 3. POSTGRESQL 16
# =============================================================================
info "Installing PostgreSQL ${PG_VERSION}..."
if ! command -v psql &>/dev/null; then
  # Add official PostgreSQL APT repo
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL "https://www.postgresql.org/media/keys/ACCC4CF8.asc" \
    | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -q
  apt-get install -yq "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}"
fi
systemctl enable postgresql
systemctl start postgresql
log "PostgreSQL ${PG_VERSION} installed and running."

# =============================================================================
# 4. CHROMIUM + PLAYWRIGHT SYSTEM DEPENDENCIES
# =============================================================================
info "Installing Chromium and Playwright dependencies..."
apt-get install -yq \
  chromium-browser \
  libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
  libasound2 libatspi2.0-0 libwayland-client0 \
  xvfb fonts-liberation fonts-noto-color-emoji \
  libvulkan1

# Playwright looks for these env variables when running headless
CHROMIUM_PATH=$(command -v chromium-browser || command -v chromium || true)
if [[ -n "$CHROMIUM_PATH" ]]; then
  log "Chromium found at: ${CHROMIUM_PATH}"
else
  warn "chromium-browser not found in PATH; Playwright will download its own."
fi
log "Playwright system dependencies installed."

# =============================================================================
# 5. CREATE "competitor" USER
# =============================================================================
info "Creating system user '${APP_USER}'..."
if ! id "$APP_USER" &>/dev/null; then
  useradd --system \
          --create-home \
          --home-dir "$APP_HOME" \
          --shell /bin/bash \
          --comment "Competitor Intel App User" \
          "$APP_USER"
  log "User '${APP_USER}' created."
else
  warn "User '${APP_USER}' already exists — skipping."
fi

# =============================================================================
# 6. POSTGRESQL DATABASE + USER
# =============================================================================
info "Creating PostgreSQL user '${DB_USER}' and database '${DB_NAME}'..."
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
  ELSE
    ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}') \gexec

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};

\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
SQL
log "Database '${DB_NAME}' and user '${DB_USER}' ready."

# Configure pg_hba.conf to allow local password auth for app user
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
if ! grep -q "^local\s*${DB_NAME}\s*${DB_USER}" "$PG_HBA" 2>/dev/null; then
  sed -i "/^# \"local\" is for Unix domain socket connections only/a local   ${DB_NAME}   ${DB_USER}   md5" "$PG_HBA"
  systemctl reload postgresql
fi

# =============================================================================
# 7. PM2
# =============================================================================
info "Installing PM2 globally..."
npm install -g pm2
pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" | tail -1 | bash || true
log "PM2 installed: $(pm2 -v)."

# =============================================================================
# 8. APP DIRECTORY STRUCTURE
# =============================================================================
info "Creating application directory structure at ${APP_DIR}..."
dirs=(
  "${APP_DIR}"
  "${APP_DIR}/src"
  "${APP_DIR}/dist"
  "${APP_DIR}/logs"
  "${APP_DIR}/data"
  "${APP_DIR}/data/screenshots"
  "${APP_DIR}/data/exports"
  "${APP_DIR}/config"
  "${APP_DIR}/scripts"
)
for d in "${dirs[@]}"; do
  mkdir -p "$d"
done

# Stub .env file (never committed to git)
ENV_FILE="${APP_DIR}/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<ENV
# Auto-generated by vps-setup.sh — fill in real values before starting the app
NODE_ENV=production
PORT=3000

# PostgreSQL
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}

# Playwright
PLAYWRIGHT_BROWSERS_PATH=/home/${APP_USER}/.cache/ms-playwright
CHROMIUM_PATH=${CHROMIUM_PATH:-/usr/bin/chromium-browser}

# Add your API keys below
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
ENV
  chmod 600 "$ENV_FILE"
fi

# PM2 ecosystem file
ECOSYSTEM_FILE="${APP_DIR}/ecosystem.config.js"
if [[ ! -f "$ECOSYSTEM_FILE" ]]; then
  cat > "$ECOSYSTEM_FILE" <<'ECOSYSTEM'
module.exports = {
  apps: [
    {
      name: 'competitor-intel',
      script: './dist/index.js',
      cwd: '/home/competitor/competitor-intel-system',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
ECOSYSTEM
fi

# Minimal tsconfig stub (replaced by your own during deployment)
if [[ ! -f "${APP_DIR}/tsconfig.json" ]]; then
  cat > "${APP_DIR}/tsconfig.json" <<'TSCONFIG'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
TSCONFIG
fi

log "Directory structure created."

# =============================================================================
# 9. PERMISSIONS
# =============================================================================
info "Setting permissions..."
chown -R "${APP_USER}:${APP_USER}" "$APP_HOME"
chmod 750 "$APP_DIR"
chmod 700 "${APP_DIR}/logs" "${APP_DIR}/data"
chmod 600 "${APP_DIR}/.env"
find "${APP_DIR}/scripts" -name "*.sh" -exec chmod 750 {} +
log "Permissions set."

# =============================================================================
# BASIC FIREWALL (UFW)
# =============================================================================
info "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
log "Firewall configured (SSH, 80, 443 open)."

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Setup Complete!                         ${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}App user:${NC}       ${APP_USER}"
echo -e "  ${BOLD}App directory:${NC}  ${APP_DIR}"
echo -e "  ${BOLD}Node.js:${NC}        $(node -v)"
echo -e "  ${BOLD}npm:${NC}            $(npm -v)"
echo -e "  ${BOLD}PM2:${NC}            $(pm2 -v)"
echo -e "  ${BOLD}PostgreSQL:${NC}     ${PG_VERSION}"
echo -e "  ${BOLD}Database:${NC}       ${DB_NAME}"
echo -e "  ${BOLD}DB user:${NC}        ${DB_USER}"
echo ""
echo -e "  ${YELLOW}${BOLD}DATABASE PASSWORD (save this securely!):${NC}"
echo -e "  ${BOLD}${DB_PASS}${NC}"
echo ""
echo -e "  ${CYAN}Next steps:${NC}"
echo -e "  1. Deploy your app to ${APP_DIR}"
echo -e "  2. Review/complete ${APP_DIR}/.env"
echo -e "  3. Run: npm ci && npm run build"
echo -e "  4. Start: pm2 start ${APP_DIR}/ecosystem.config.js"
echo -e "  5. Save PM2 list: pm2 save"
echo ""
echo -e "  ${YELLOW}Tip:${NC} sudo -u ${APP_USER} bash   — to switch to app user"
echo ""
