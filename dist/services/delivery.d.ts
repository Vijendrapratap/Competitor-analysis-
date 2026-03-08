import type { ReportSummary } from '../delivery/email.js';
export interface DeliveryOptions {
    dryRun?: boolean;
    recipients?: string[];
    testRecipient?: string;
}
export interface DeliveryResult {
    reportSent: boolean;
    alertsSent: number;
    errors: string[];
}
export declare class DeliveryService {
    private email;
    constructor();
    /**
     * Deliver the latest report + unsent critical alerts.
     */
    run(opts?: DeliveryOptions): Promise<DeliveryResult>;
    /**
     * Send a report PDF via email.
     */
    deliverReport(pdfPath: string, summary: ReportSummary): Promise<boolean>;
    /**
     * Send a test email to verify configuration.
     */
    testEmail(recipientOverride?: string): Promise<boolean>;
}
//# sourceMappingURL=delivery.d.ts.map