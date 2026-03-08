// =============================================================================
// Helpers — pure utility functions (no side-effects, no external deps)
// =============================================================================

import { createLogger } from './logger.js';

const log = createLogger('helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Async / timing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Promise-based sleep.
 * @param ms  Milliseconds to wait.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

/**
 * Sleep for a random duration between `minMs` and `maxMs`.
 * Useful for adding jitter between scraper requests.
 */
export async function sleepRandom(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await sleep(delay);
}

/**
 * Run an async operation with automatic retry on failure.
 *
 * @param fn          Async function to attempt.
 * @param maxRetries  Maximum number of additional attempts after the first.
 * @param delayMs     Base delay between retries (doubles on each attempt).
 * @param label       Human-readable label used in log messages.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1_000,
  label = 'operation',
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const wait = delayMs * 2 ** attempt;
        log.warn(`${label} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${wait}ms`, {
          error: err instanceof Error ? err.message : String(err),
        });
        await sleep(wait);
      }
    }
  }
  throw lastError;
}

/**
 * Measure execution time of an async operation.
 * @returns  `[result, durationMs]`
 */
export async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now();
  const result = await fn();
  return [result, Date.now() - start];
}

// ─────────────────────────────────────────────────────────────────────────────
// Number parsing & formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a potentially messy string into a finite number.
 * Handles "1,234", "1.5k", "1.2M", "฿3,500 / night", etc.
 *
 * @returns  Parsed number, or `null` if unparseable.
 */
export function parseNumber(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;

  let s = raw.trim().replace(/,/g, '');

  // Handle shorthand suffixes (case-insensitive)
  const suffixMap: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };
  const suffixMatch = /^([\d.]+)\s*([kmb])$/i.exec(s);
  if (suffixMatch) {
    const [, num, suffix] = suffixMatch;
    const multiplier = suffixMap[suffix!.toLowerCase() as keyof typeof suffixMap] ?? 1;
    return parseFloat(num!) * multiplier;
  }

  // Strip leading currency symbols and trailing non-numeric chars
  s = s.replace(/^[^\d\-+.]+/, '').replace(/[^\d.]+$/, '');

  const parsed = parseFloat(s);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Clamp a number between `min` and `max`.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Round to a given number of decimal places.
 */
export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Calculate percentage change from `from` to `to`.
 * Returns `null` when the base value is 0 to avoid division by zero.
 */
export function percentageChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return round(((to - from) / Math.abs(from)) * 100, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Date / time utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a date as a locale-aware string.
 *
 * @param date    Date object or ISO string.
 * @param locale  BCP 47 locale tag (default `"en-GB"`).
 * @param opts    `Intl.DateTimeFormatOptions` (defaults to short date).
 */
export function formatDate(
  date: Date | string | null | undefined,
  locale = 'en-GB',
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
  if (date == null) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, opts).format(d);
}

/**
 * Format a date as `YYYY-MM-DD` (ISO date portion, local time).
 */
export function toIsoDate(date: Date | string | null | undefined): string {
  if (date == null) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the start of the current ISO week (Monday 00:00:00.000 UTC).
 */
export function startOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift so Mon=0
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/**
 * Returns a Date `n` days ago (relative to now, at midnight UTC).
 */
export function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Human-readable duration string from milliseconds.
 * e.g. 75 600 000 → "21h 0m 0s"
 */
export function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1_000);
  const h = Math.floor(totalSecs / 3_600);
  const m = Math.floor((totalSecs % 3_600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// String utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Truncate a string to `maxLen` characters, appending `suffix` if truncated.
 */
export function truncate(text: string, maxLen: number, suffix = '…'): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - suffix.length) + suffix;
}

/**
 * Normalise whitespace: collapse runs of whitespace/newlines into single spaces
 * and trim leading/trailing whitespace.
 */
export function normaliseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Slugify a string for use in file names or URLs.
 * e.g. "Samui Luxury Hotel" → "samui-luxury-hotel"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Array utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Split an array into chunks of at most `size` items.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Remove duplicate items from an array by a key function.
 */
export function uniqueBy<T>(arr: T[], key: (item: T) => unknown): T[] {
  const seen = new Set<unknown>();
  return arr.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Group an array of objects by a string key.
 */
export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Error utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely extract an error message from any thrown value.
 */
export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return JSON.stringify(err);
}

/**
 * Wrap a value that might be thrown as a structured `{ ok, value, error }`.
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  }
}
