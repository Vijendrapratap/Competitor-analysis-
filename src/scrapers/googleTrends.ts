// =============================================================================
// Google Trends Fetcher
//
// Uses the `google-trends-api` package to fetch search interest data for
// configured keywords in the Thai market. Calculates current value, 30-day
// change, and 90-day change. Results are returned as `NewTrendData[]` for DB.
// =============================================================================

import googleTrends, {
  type InterestOverTimeResult,
  type RelatedQueriesResult,
  type TimelineDataPoint,
} from 'google-trends-api';

import { createLogger } from '../utils/logger.js';
import {
  sleep,
  toErrorMessage,
  formatDuration,
  chunk,
  round,
  percentageChange,
} from '../utils/helpers.js';
import { settings } from '../config/settings.js';
import { TrendSource } from '../types/index.js';
import type { NewTrendData, ScrapeResult } from '../types/index.js';

const log = createLogger('GoogleTrendsFetcher');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum keywords per single Google Trends API request. */
const MAX_KEYWORDS_PER_REQUEST = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Public class
// ─────────────────────────────────────────────────────────────────────────────

export class GoogleTrendsFetcher {
  private readonly geo: string;
  private readonly timeframeDays: number;
  private readonly requestDelayMs: number;
  private readonly maxRetries: number;
  private readonly keywords: string[];

  constructor() {
    this.geo = settings.googleTrends.geo;
    this.timeframeDays = settings.googleTrends.timeframeDays;
    this.requestDelayMs = settings.googleTrends.requestDelayMs;
    this.maxRetries = settings.googleTrends.maxRetries;
    this.keywords = [...settings.googleTrends.keywords];
  }

  // ─── Fetch trends for all configured keywords ───────────────────────────

  async fetchAllTrends(): Promise<ScrapeResult<NewTrendData[]>> {
    const start = Date.now();

    try {
      log.info(
        `Fetching Google Trends data for ${this.keywords.length} keywords (geo: ${this.geo}, ${this.timeframeDays}d)`,
      );

      const allTrends = await this.fetchTrends(this.keywords);

      log.info(
        `Google Trends fetch complete: ${allTrends.length} data points in ${formatDuration(Date.now() - start)}`,
      );

      return {
        success: true,
        data: allTrends,
        error: null,
        durationMs: Date.now() - start,
        retries: 0,
      };
    } catch (err) {
      const msg = toErrorMessage(err);
      log.error(`Google Trends fetch failed: ${msg}`);
      return {
        success: false,
        data: null,
        error: msg,
        durationMs: Date.now() - start,
        retries: 0,
      };
    }
  }

  // ─── Fetch trends for a set of keywords ─────────────────────────────────

  async fetchTrends(keywords: string[]): Promise<NewTrendData[]> {
    if (keywords.length === 0) return [];

    const allTrends: NewTrendData[] = [];

    // Split into batches of MAX_KEYWORDS_PER_REQUEST
    const batches = chunk(keywords, MAX_KEYWORDS_PER_REQUEST);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx]!;
      log.info(
        `  Batch ${batchIdx + 1}/${batches.length}: [${batch.join(', ')}]`,
      );

      const batchTrends = await this.fetchBatchWithRetry(batch);
      allTrends.push(...batchTrends);

      // Rate-limit between batches
      if (batchIdx < batches.length - 1) {
        log.debug(`  Waiting ${this.requestDelayMs}ms before next batch...`);
        await sleep(this.requestDelayMs);
      }
    }

    return allTrends;
  }

  // ─── Fetch related queries for a single keyword ──────────────────────────

  async fetchRelatedQueries(keyword: string): Promise<string[]> {
    log.info(`Fetching related queries for: "${keyword}"`);

    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - this.timeframeDays);

    try {
      const rawJson = await this.callWithRetry(() =>
        googleTrends.relatedQueries({
          keyword,
          startTime,
          endTime,
          geo: this.geo,
          hl: 'en-US',
        }),
      );

      const parsed: RelatedQueriesResult = JSON.parse(rawJson);

      const queries: string[] = [];
      for (const list of parsed.default.rankedList) {
        for (const item of list.rankedKeyword) {
          if (item.query) {
            queries.push(item.query);
          }
        }
      }

      log.info(`  Found ${queries.length} related queries for "${keyword}"`);
      return queries;
    } catch (err) {
      log.warn(
        `  Failed to fetch related queries for "${keyword}": ${toErrorMessage(err)}`,
      );
      return [];
    }
  }

  // ─── Batch fetch with retry ─────────────────────────────────────────────

  private async fetchBatchWithRetry(
    keywords: string[],
  ): Promise<NewTrendData[]> {
    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - this.timeframeDays);

    const rawJson = await this.callWithRetry(() =>
      googleTrends.interestOverTime({
        keyword: keywords,
        startTime,
        endTime,
        geo: this.geo,
        hl: 'en-US',
        granularTimeResolution: false,
      }),
    );

    const parsed: InterestOverTimeResult = JSON.parse(rawJson);
    const timeline = parsed.default.timelineData;

    if (timeline.length === 0) {
      log.warn(`  No timeline data returned for: [${keywords.join(', ')}]`);
      return [];
    }

    return this.processTimeline(timeline, keywords);
  }

  // ─── Process timeline data into TrendData records ────────────────────────

  private processTimeline(
    timeline: TimelineDataPoint[],
    keywords: string[],
  ): NewTrendData[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const trends: NewTrendData[] = [];

    for (let kwIdx = 0; kwIdx < keywords.length; kwIdx++) {
      const keyword = keywords[kwIdx]!;

      // Extract the value series for this keyword
      const series = timeline
        .map((point) => ({
          time: new Date(parseInt(point.time, 10) * 1_000),
          value: point.value[kwIdx] ?? 0,
          isPartial: point.isPartial ?? false,
        }))
        .filter((p) => !p.isPartial); // Exclude partial (incomplete) periods

      if (series.length === 0) {
        log.debug(`  No data points for "${keyword}"`);
        continue;
      }

      // ── Current value (latest non-partial data point) ──────────────────
      const latest = series[series.length - 1]!;
      const currentValue = latest.value;

      // ── 30-day change ──────────────────────────────────────────────────
      const changePct30d = this.calculateChangePct(series, 30);

      // ── 90-day change ──────────────────────────────────────────────────
      const changePct90d = this.calculateChangePct(series, 90);

      // ── Average value over the full period ─────────────────────────────
      const avgValue =
        series.length > 0
          ? round(
            series.reduce((sum, p) => sum + p.value, 0) / series.length,
            2,
          )
          : 0;

      // ── Peak value and date ────────────────────────────────────────────
      let peakValue = 0;
      let peakDate: Date | null = null;
      for (const point of series) {
        if (point.value > peakValue) {
          peakValue = point.value;
          peakDate = point.time;
        }
      }

      trends.push({
        trendDate: today,
        source: TrendSource.GoogleTrends,
        keyword,
        value: currentValue,
        changePct: changePct30d,
        metadata: {
          geo: this.geo,
          timeframeDays: this.timeframeDays,
          currentValue,
          avgValue,
          peakValue,
          peakDate: peakDate?.toISOString() ?? null,
          changePct30d,
          changePct90d,
          dataPoints: series.length,
          latestDate: latest.time.toISOString(),
          fetchedAt: now.toISOString(),
        },
      });

      log.info(
        `  "${keyword}": current=${currentValue}, avg=${avgValue}, peak=${peakValue}, ` +
        `30d=${changePct30d !== null ? `${changePct30d > 0 ? '+' : ''}${changePct30d}%` : 'N/A'}, ` +
        `90d=${changePct90d !== null ? `${changePct90d > 0 ? '+' : ''}${changePct90d}%` : 'N/A'}`,
      );
    }

    return trends;
  }

  // ─── Calculate percentage change over N days ─────────────────────────────

  private calculateChangePct(
    series: Array<{ time: Date; value: number }>,
    days: number,
  ): number | null {
    if (series.length < 2) return null;

    const latest = series[series.length - 1]!;
    const cutoff = new Date(latest.time);
    cutoff.setDate(cutoff.getDate() - days);

    // Find the data point closest to N days ago
    let closest: (typeof series)[0] | null = null;
    let closestDiff = Infinity;

    for (const point of series) {
      const diff = Math.abs(point.time.getTime() - cutoff.getTime());
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = point;
      }
    }

    if (!closest || closest === latest) return null;

    // Avoid division by zero — if the old value was 0, report null
    if (closest.value === 0) {
      return latest.value > 0 ? 100 : null;
    }

    return percentageChange(closest.value, latest.value);
  }

  // ─── Generic retry wrapper for API calls ─────────────────────────────────

  private async callWithRetry(
    fn: () => Promise<string>,
  ): Promise<string> {
    let lastErr: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const msg = toErrorMessage(err);

        // Check for rate-limiting (HTTP 429) or transient server errors
        const isRetryable =
          msg.includes('429') ||
          msg.includes('ECONNRESET') ||
          msg.includes('ETIMEDOUT') ||
          msg.includes('ENOTFOUND') ||
          msg.includes('socket hang up') ||
          msg.includes('500') ||
          msg.includes('502') ||
          msg.includes('503');

        if (attempt < this.maxRetries && isRetryable) {
          const backoff = this.requestDelayMs * 2 ** attempt;
          log.warn(
            `  API call failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${msg}. Retrying in ${backoff / 1_000}s`,
          );
          await sleep(backoff);
        } else if (!isRetryable) {
          // Non-retryable error — fail immediately
          throw err;
        }
      }
    }

    throw lastErr;
  }
}
