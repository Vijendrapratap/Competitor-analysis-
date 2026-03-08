import type { Alert } from '../types/index.js';
export interface DeliveryConfig {
    from: string;
    to: string[];
    cc?: string[];
    replyTo?: string;
    maxAttachmentBytes?: number;
    maxRetries?: number;
    retryBaseDelayMs?: number;
}
export interface ReportSummary {
    reportDate: string;
    competitorsAnalyzed: number;
    totalAdsDetected: number;
    newCampaignsLaunched: number;
    healthScoreLeader: {
        name: string;
        score: number;
    } | null;
    alertCounts: {
        critical: number;
        warning: number;
        info: number;
    };
    totalAlerts: number;
    pdfPath: string;
    generatedAt: Date;
    pipelineDurationMs?: number;
}
export declare class EmailDelivery {
    private resend;
    private config;
    constructor(apiKey: string, config: DeliveryConfig);
    sendReport(pdfPath: string, summary: ReportSummary): Promise<boolean>;
    sendCriticalAlert(alert: Alert): Promise<boolean>;
    testEmail(recipientOverride?: string): Promise<boolean>;
    private readAttachment;
    private sendWithRetry;
    private buildReportEmailHtml;
    private buildReportEmailText;
    private buildAlertEmailHtml;
    private buildAlertEmailText;
}
//# sourceMappingURL=email.d.ts.map