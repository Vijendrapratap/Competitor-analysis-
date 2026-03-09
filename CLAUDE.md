# CLAUDE.md — Competitor Intelligence System Engineering Guide

## Project Overview

**Stack**: TypeScript (NodeNext ESM), PostgreSQL, Drizzle ORM, Express.js API, Next.js dashboard

**Key directories**:
- `src/db/` — Database layer (schema, migrations, queries)
- `src/types/` — TypeScript type definitions (enums, interfaces)
- `src/services/` — Business logic (analysis, scraping, reporting)
- `src/api/` — Express REST API routes
- `dashboard/` — Next.js frontend
- `src/index.ts` — CLI pipeline entry point

**Pipeline stages**: Scrape → Analyze → Generate → Deliver

---

## Database & Drizzle ORM

### Schema Management Rules

- **NEVER remove or rename existing columns** — schema is additive only
- **Always update TWO files in sync**:
  1. `src/db/schema.ts` — Drizzle ORM table definitions
  2. `src/db/migrations/run.ts` — raw SQL DDL statements

  Failure to keep both in sync results in a schema mismatch: ORM expects columns that don't exist in DB.

- **ALTER TABLE pattern** (for existing tables):
  ```sql
  ALTER TABLE IF EXISTS tablename ADD COLUMN IF NOT EXISTS col_name TYPE;
  ```
  Always use `IF EXISTS` and `IF NOT EXISTS` — idempotent for safety on re-runs.

- **CREATE TABLE pattern** (for new tables):
  ```sql
  CREATE TABLE IF NOT EXISTS tablename ( ... );
  CREATE UNIQUE INDEX IF NOT EXISTS name_idx ON tablename (...);
  CREATE INDEX IF NOT EXISTS name_idx ON tablename (...);
  ```

- **Column typing**:
  - Use `varchar` (not `pgEnum`) for enum-like values — easier to extend without migrations
  - Use `numeric(precision, scale)` for financial/percentages: e.g., `NUMERIC(5,2)` for 0–100 range
  - Use `jsonb` (not `json`) for flexible data; Drizzle types it with `.$type<T>()`
  - All timestamps: `TIMESTAMPTZ` (with timezone) via `.defaultNow()`
  - All dates: `DATE` (no time component) via `{ mode: 'date' }`

- **Foreign keys**:
  - Child tables: `.references(() => parent.id, { onDelete: 'cascade' })` — auto-delete children
  - Optional FKs: `.references(() => parent.id, { onDelete: 'set null' })` — can be null
  - Never use `RESTRICT` or `NO ACTION` — cascade or set null only

- **Indexing**:
  - Always index:
    - Foreign key columns (query joins)
    - Frequently filtered columns (dates, status, booleans)
    - Unique constraints (prevent duplicates)
  - Naming: `{table}_{column(s)}_idx` or `{table}_{column(s)}_unique_idx`

- **Cached/computed columns**:
  - Prefix with `cached_` to signal they're derived/denormalized: `cached_health_score`, `cached_threat_level`
  - These mirror values from other tables for dashboard performance
  - Update them via business logic in `src/services/`, not via triggers

- **New columns on existing tables**:
  - Must be nullable (no `NOT NULL` without `DEFAULT`) to avoid migration failure on populated tables
  - Exception: booleans can use `.notNull().default(false)` — safe for all rows
  - In SQL: `ADD COLUMN IF NOT EXISTS col BOOLEAN NOT NULL DEFAULT FALSE` is safe

---

## TypeScript Patterns

### Strict Mode

- Project uses `"strict": true`, `"noUncheckedIndexedAccess": true` in `tsconfig.json`
- **Never use non-null assertion (`!`)** on database results
  - ❌ `const row = rows[0]!;` — rows[0] may be undefined
  - ✅ `const row = rows[0]; if (!row) throw new Error(...);`

### ESM Imports

- All imports use `.js` extension (required for NodeNext ESM):
  ```typescript
  import { something } from './utils.js';
  import * as schema from '../db/schema.js';
  ```
  - ❌ `from './utils'` or `from './utils.ts'`
  - ✅ `from './utils.js'`

### Numeric Columns from Drizzle

- **Drizzle returns `NUMERIC` columns as strings** (PostgreSQL driver limitation)
- Use `parseFloat()` or a `toNum()` helper before arithmetic:
  ```typescript
  const healthScore = parseFloat(row.healthScore ?? '0');
  const percentagea = healthScore / 100 * 50;
  ```
- Check `src/db/queries.ts` for existing `toNum()` / `toNumOrNull()` helpers

### Enums

- Define in `src/types/index.ts`:
  ```typescript
  export enum ThreatLevel {
    Low = 'low',
    Medium = 'medium',
    High = 'high',
    Critical = 'critical',
  }
  ```
- In Drizzle schema, use `varchar` (not `pgEnum`):
  ```typescript
  threatLevel: varchar('threat_level', { length: 20 })
  ```
- In TypeScript interfaces, type with enum or union:
  ```typescript
  threatLevel: ThreatLevel | null;
  // or
  threatLevel: 'low' | 'medium' | 'high' | 'critical' | null;
  ```

### Type Safety Patterns

- **Omit-based derived types** for insert/update shapes:
  ```typescript
  export type NewCompetitor = Omit<Competitor, 'id' | 'createdAt' | 'updatedAt'>;
  export type NewMarketSnapshot = Omit<MarketSnapshot, 'id' | 'createdAt'>;
  ```
- All new columns must be typed as `T | null` (not optional `T?`)
  ```typescript
  cachedHealthScore: number | null;  // ✅ field exists but may be null
  // NOT:
  cachedHealthScore?: number;        // ❌ field may not exist
  ```

### Export All New Tables

- In `src/db/schema.ts`, use `export const` for all tables:
  ```typescript
  export const marketSnapshots = pgTable(...);
  export const competitorSegments = pgTable(...);
  export const reportAlerts = pgTable(...);
  ```
- The `src/db/index.ts` imports via `import * as schema`, so all exports are included automatically

---

## Common Bugs to Never Repeat

### 1. Schema Drift (Most Critical)
**Symptom**: "column does not exist" error in production
**Cause**: Added column to `schema.ts` but forgot `ALTER TABLE` in `run.ts`
**Prevention**: Update BOTH files simultaneously; run `npx tsc --noEmit` before commit

### 2. Missing Table Export
**Symptom**: Drizzle cannot query new table
**Cause**: Defined table without `export const`
**Prevention**: All `pgTable(...)` must start with `export const`

### 3. NOT NULL on Populated Table
**Symptom**: Migration fails with "column does not exist" or constraint error
**Cause**: Added `NOT NULL` column without `DEFAULT` to existing table
**Prevention**: New columns on existing tables must be nullable or have safe defaults
- ✅ `ALTER TABLE x ADD COLUMN y INT;` (nullable)
- ✅ `ALTER TABLE x ADD COLUMN y BOOLEAN NOT NULL DEFAULT FALSE;` (safe default)
- ❌ `ALTER TABLE x ADD COLUMN y INT NOT NULL;` (fails on populated table)

### 4. Forgetting IF NOT EXISTS
**Symptom**: Migration fails on second run (idempotency broken)
**Cause**: `CREATE TABLE` or `ALTER TABLE` without `IF NOT EXISTS` / `IF NOT EXISTS`
**Prevention**: Always use:
- `CREATE TABLE IF NOT EXISTS ...`
- `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS ...`
- `CREATE INDEX IF NOT EXISTS ...`

### 5. Missing ESM .js Extension
**Symptom**: "Cannot find module" errors at runtime
**Cause**: Import without `.js` extension in ESM context
**Prevention**: All imports must include `.js`: `from './utils.js'`

### 6. Drizzle Numeric as String
**Symptom**: NaN or unexpected values in calculations
**Cause**: Trying to do math on NUMERIC columns directly
**Prevention**: Always parse: `parseFloat(row.score ?? '0')` before arithmetic

### 7. Duplicate Columns
**Symptom**: ORM expects column, scraper/service already populates it
**Cause**: Not checking existing schema before adding new fields
**Prevention**: Review existing columns in all 3 modified tables before adding new ones

### 8. Wrong Null Handling
**Symptom**: "Cannot read property of undefined" errors
**Cause**: Typed as nullable but not checking for null
**Prevention**: Use type guards: `if (value !== null) { ... }`

### 9. Index Naming Conflicts
**Symptom**: Duplicate index names or unclear purpose
**Cause**: Random/inconsistent naming convention
**Prevention**: Always use `{table}_{column(s)}_idx` or `{table}_{columns}_unique_idx`

### 10. Forgetting to Update Log Message
**Symptom**: Misleading console output after migration
**Cause**: Migration runner logs old table count after adding new tables
**Prevention**: Update the final log statement in `runSchemaPush()`: e.g., "all 14 tables and indexes are up to date"

---

## Code Style & Conventions

### File Organization

- **Schema sections**: Organize `schema.ts` with numbered comments matching table count:
  ```typescript
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. COMPETITORS
  // ─────────────────────────────────────────────────────────────────────────────
  ```

- **Migration SQL sections**: Match schema sections in `run.ts`:
  ```sql
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 1. COMPETITORS
  -- ═══════════════════════════════════════════════════════════════════════════
  ```

### Naming Conventions

- **Tables**: snake_case (PostgreSQL convention): `market_snapshots`, `competitor_segments`
- **Columns**: snake_case in SQL, camelCase in TypeScript Drizzle:
  - SQL: `created_at`, `competitor_id`, `ad_archive_id`
  - Drizzle: `createdAt`, `competitorId`, `adArchiveId`
  - Drizzle auto-converts via `varchar('snake_case')` definition

- **Indexes**: lowercase snake_case, suffix with `_idx`:
  - `competitors_spend_tier_idx`
  - `market_snapshots_snapshot_date_idx`
  - `competitor_segments_comp_seg_idx`

### Comments

- Use section dividers in code:
  ```typescript
  // ─────────────────────────────────────────────────────────────────────────────
  // section name
  // ─────────────────────────────────────────────────────────────────────────────

  // or for inline:
  // ── NEW COLUMNS (002_schema_enhancements) ────────────────────────────────────
  ```

---

## Testing & Verification

### After Schema Changes

1. **Type check** (must be 0 errors):
   ```bash
   npx tsc --noEmit
   ```

2. **Run migration** (dev or prod):
   ```bash
   npm run dev:migrate
   # or
   npm run migrate
   ```

3. **Verify in PostgreSQL**:
   ```bash
   psql -U competitor_user -d competitor_intel

   # Check specific table columns:
   \d competitors
   \d ads
   \d facebook_posts

   # List all tables:
   \dt

   # Verify new tables exist:
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' ORDER BY table_name;

   # Verify new indexes:
   SELECT indexname FROM pg_indexes
   WHERE tablename IN ('market_snapshots','competitor_segments','report_alerts');
   ```

---

## Migration History

### 001_create_reports_tables.sql
Initial report system (reports, report_competitors, report_access_log)

### 002_schema_enhancements.sql (current)
Added fields to competitors, ads, facebook_posts (6, 20, 10 columns respectively)
Added 3 new tables: market_snapshots, competitor_segments, report_alerts

---

## References

- **Drizzle ORM docs**: https://orm.drizzle.team/
- **PostgreSQL data types**: https://www.postgresql.org/docs/current/datatype.html
- **Project git**: `claude/debug-scrape-database-4Q7bJ` branch
