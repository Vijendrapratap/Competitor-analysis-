// =============================================================================
// Drizzle Kit Configuration
// Used by:  npx drizzle-kit generate   (SQL migration files)
//           npx drizzle-kit push        (push schema directly to DB)
//           npx drizzle-kit studio      (visual DB browser)
// =============================================================================

import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadDotenv();

function getDatabaseUrl(): string {
  if (process.env['DATABASE_URL']) {
    return process.env['DATABASE_URL'];
  }

  const host = process.env['DB_HOST'] ?? 'localhost';
  const port = process.env['DB_PORT'] ?? '5432';
  const user = process.env['DB_USER'] ?? 'competitor_user';
  const password = process.env['DB_PASSWORD'] ?? '';
  const name = process.env['DB_NAME'] ?? 'competitor_intel';

  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

export default defineConfig({
  // ── Schema source ──────────────────────────────────────────────────────────
  schema: './src/db/schema.ts',

  // ── Generated migration output ─────────────────────────────────────────────
  out: './src/db/migrations/sql',

  // ── Database driver ────────────────────────────────────────────────────────
  dialect: 'postgresql',

  dbCredentials: {
    url: getDatabaseUrl(),
  },

  // ── Behaviour ──────────────────────────────────────────────────────────────
  verbose: true,
  strict: true,
});
