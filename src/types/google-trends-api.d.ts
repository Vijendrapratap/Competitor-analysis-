// =============================================================================
// Type declarations for the `google-trends-api` npm package (v4.x)
// The package has no official @types — declare the public API we use.
// =============================================================================

declare module 'google-trends-api' {
  export interface TrendsApiOptions {
    /** Search keyword or array of keywords (max 5) */
    keyword: string | string[];
    /** Start time for the data range */
    startTime?: Date;
    /** End time for the data range */
    endTime?: Date;
    /** Two-letter country code, e.g. "TH", "US" */
    geo?: string;
    /** hl parameter — interface language, e.g. "en-US" */
    hl?: string;
    /** Timezone offset in minutes (default: new Date().getTimezoneOffset()) */
    timezone?: number;
    /** Category number (0 = all categories) */
    category?: number;
    /** Search property: '' (web), 'images', 'news', 'youtube', 'froogle' */
    property?: '' | 'images' | 'news' | 'youtube' | 'froogle';
    /** Granularity hint, e.g. "now 7-d", "today 3-m", "today 12-m" */
    granularTimeResolution?: boolean;
  }

  export interface TimelineDataPoint {
    time: string;
    formattedTime: string;
    value: number[];
    formattedValue: string[];
    isPartial?: boolean;
    hasData?: boolean[];
  }

  export interface InterestOverTimeResult {
    default: {
      timelineData: TimelineDataPoint[];
      averages: number[];
    };
  }

  export interface RankedKeyword {
    query: string;
    value: number;
    formattedValue: string;
    link: string;
  }

  export interface RelatedQueriesResult {
    default: {
      rankedList: Array<{
        rankedKeyword: RankedKeyword[];
      }>;
    };
  }

  /**
   * Fetch interest-over-time data. Returns a JSON string.
   */
  export function interestOverTime(options: TrendsApiOptions): Promise<string>;

  /**
   * Fetch related queries. Returns a JSON string.
   */
  export function relatedQueries(options: TrendsApiOptions): Promise<string>;

  /**
   * Fetch interest by region. Returns a JSON string.
   */
  export function interestByRegion(options: TrendsApiOptions): Promise<string>;

  /**
   * Fetch related topics. Returns a JSON string.
   */
  export function relatedTopics(options: TrendsApiOptions): Promise<string>;
}
