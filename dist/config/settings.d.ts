export declare const settings: {
    readonly env: "development" | "test" | "production";
    readonly isDev: boolean;
    readonly isProd: boolean;
    readonly log: {
        readonly level: "error" | "info" | "warn" | "http" | "verbose" | "debug" | "silly";
    };
    readonly db: {
        readonly url: string;
        readonly host: string;
        readonly port: number;
        readonly name: string;
        readonly user: string;
        readonly password: string;
        readonly ssl: boolean;
        readonly poolMax: number;
    };
    readonly email: {
        readonly resendApiKey: string;
        readonly from: string;
        readonly recipients: string[];
        readonly testRecipient: string | undefined;
    };
    readonly apify: {
        readonly token: string | undefined;
    };
    readonly scraper: {
        readonly chromiumPath: string | undefined;
        readonly playwrightBrowsersPath: string | undefined;
        readonly viewport: {
            readonly width: number;
            readonly height: number;
        };
        readonly timeoutMs: number;
        readonly requestDelayMs: number;
        readonly maxRetries: number;
        readonly headless: boolean;
    };
    readonly pdf: {
        readonly puppeteerPath: string | undefined;
        readonly format: "A4" | "A3" | "Letter" | "Legal";
        readonly outputDir: string;
    };
    readonly paths: {
        readonly screenshots: string;
        readonly templates: string;
        readonly reports: string;
    };
    readonly meta: {
        readonly adsCountry: string;
        readonly maxAdsPerCompetitor: number;
    };
    readonly openrouter: {
        readonly apiKey: string;
        readonly model: string;
        readonly maxTokens: number;
        readonly maxRetries: number;
    };
    readonly googleTrends: {
        readonly geo: string;
        readonly timeframeDays: number;
        readonly requestDelayMs: number;
        readonly maxRetries: number;
        readonly keywords: string[];
    };
    readonly analysis: {
        readonly paidWeight: number;
        readonly organicWeight: number;
        readonly threatHighThreshold: number;
        readonly threatMediumThreshold: number;
    };
};
export type Settings = typeof settings;
//# sourceMappingURL=settings.d.ts.map