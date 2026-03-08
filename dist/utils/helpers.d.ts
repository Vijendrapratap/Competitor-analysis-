/**
 * Promise-based sleep.
 * @param ms  Milliseconds to wait.
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Sleep for a random duration between `minMs` and `maxMs`.
 * Useful for adding jitter between scraper requests.
 */
export declare function sleepRandom(minMs: number, maxMs: number): Promise<void>;
/**
 * Run an async operation with automatic retry on failure.
 *
 * @param fn          Async function to attempt.
 * @param maxRetries  Maximum number of additional attempts after the first.
 * @param delayMs     Base delay between retries (doubles on each attempt).
 * @param label       Human-readable label used in log messages.
 */
export declare function withRetry<T>(fn: () => Promise<T>, maxRetries?: number, delayMs?: number, label?: string): Promise<T>;
/**
 * Measure execution time of an async operation.
 * @returns  `[result, durationMs]`
 */
export declare function timed<T>(fn: () => Promise<T>): Promise<[T, number]>;
/**
 * Parse a potentially messy string into a finite number.
 * Handles "1,234", "1.5k", "1.2M", "฿3,500 / night", etc.
 *
 * @returns  Parsed number, or `null` if unparseable.
 */
export declare function parseNumber(raw: string | null | undefined): number | null;
/**
 * Clamp a number between `min` and `max`.
 */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Round to a given number of decimal places.
 */
export declare function round(value: number, decimals?: number): number;
/**
 * Calculate percentage change from `from` to `to`.
 * Returns `null` when the base value is 0 to avoid division by zero.
 */
export declare function percentageChange(from: number, to: number): number | null;
/**
 * Format a date as a locale-aware string.
 *
 * @param date    Date object or ISO string.
 * @param locale  BCP 47 locale tag (default `"en-GB"`).
 * @param opts    `Intl.DateTimeFormatOptions` (defaults to short date).
 */
export declare function formatDate(date: Date | string | null | undefined, locale?: string, opts?: Intl.DateTimeFormatOptions): string;
/**
 * Format a date as `YYYY-MM-DD` (ISO date portion, local time).
 */
export declare function toIsoDate(date: Date | string | null | undefined): string;
/**
 * Returns the start of the current ISO week (Monday 00:00:00.000 UTC).
 */
export declare function startOfCurrentWeek(): Date;
/**
 * Returns a Date `n` days ago (relative to now, at midnight UTC).
 */
export declare function daysAgo(n: number): Date;
/**
 * Human-readable duration string from milliseconds.
 * e.g. 75 600 000 → "21h 0m 0s"
 */
export declare function formatDuration(ms: number): string;
/**
 * Truncate a string to `maxLen` characters, appending `suffix` if truncated.
 */
export declare function truncate(text: string, maxLen: number, suffix?: string): string;
/**
 * Normalise whitespace: collapse runs of whitespace/newlines into single spaces
 * and trim leading/trailing whitespace.
 */
export declare function normaliseWhitespace(text: string): string;
/**
 * Slugify a string for use in file names or URLs.
 * e.g. "Samui Luxury Hotel" → "samui-luxury-hotel"
 */
export declare function slugify(text: string): string;
/**
 * Split an array into chunks of at most `size` items.
 */
export declare function chunk<T>(arr: T[], size: number): T[][];
/**
 * Remove duplicate items from an array by a key function.
 */
export declare function uniqueBy<T>(arr: T[], key: (item: T) => unknown): T[];
/**
 * Group an array of objects by a string key.
 */
export declare function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]>;
/**
 * Safely extract an error message from any thrown value.
 */
export declare function toErrorMessage(err: unknown): string;
/**
 * Wrap a value that might be thrown as a structured `{ ok, value, error }`.
 */
export declare function safeAsync<T>(fn: () => Promise<T>): Promise<{
    ok: true;
    value: T;
} | {
    ok: false;
    error: string;
}>;
//# sourceMappingURL=helpers.d.ts.map