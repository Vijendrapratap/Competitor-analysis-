// =============================================================================
// Delivery Service — sends reports and critical alerts via email
// =============================================================================

import { createLogger } from '../utils/logger.js';
import { EmailDelivery } from '../delivery/email.js';
import { settings } from '../config/settings.js';
import { AlertSeverity } from '../types/index.js';
import {
    getUnsentAlerts,
    markAlertSent,
    markReportDelivered,
} from '../db/queries.js';
import type { ReportSummary } from '../delivery/email.js';

const log = createLogger('DeliveryService');

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

export class DeliveryService {
    private email: EmailDelivery;

    constructor() {
        this.email = new EmailDelivery(settings.email.resendApiKey, {
            from: settings.email.from,
            to: settings.email.recipients,
        });
    }

    /**
     * Deliver the latest report + unsent critical alerts.
     */
    async run(opts: DeliveryOptions = {}): Promise<DeliveryResult> {
        const { dryRun = false } = opts;
        log.info('DeliveryService.run starting', { dryRun });

        const result: DeliveryResult = {
            reportSent: false,
            alertsSent: 0,
            errors: [],
        };

        if (dryRun) {
            log.info('Dry run — skipping email delivery');
            return result;
        }

        // 1. Send critical alerts
        try {
            const unsentAlerts = await getUnsentAlerts();
            const criticalAlerts = unsentAlerts.filter(
                (a) => a.severity === AlertSeverity.Critical,
            );

            for (const alert of criticalAlerts) {
                const sent = await this.email.sendCriticalAlert(alert);
                if (sent) {
                    await markAlertSent(alert.id);
                    result.alertsSent++;
                }
            }
            log.info(`  Sent ${result.alertsSent} critical alerts`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error('Alert delivery failed', { error: msg });
            result.errors.push(`AlertDelivery: ${msg}`);
        }

        log.info('DeliveryService.run complete', result);
        return result;
    }

    /**
     * Send a report PDF via email.
     */
    async deliverReport(pdfPath: string, summary: ReportSummary): Promise<boolean> {
        log.info('Delivering report', { pdfPath });
        const sent = await this.email.sendReport(pdfPath, summary);
        if (sent) {
            await markReportDelivered(new Date(), settings.email.recipients);
        }
        return sent;
    }

    /**
     * Send a test email to verify configuration.
     */
    async testEmail(recipientOverride?: string): Promise<boolean> {
        log.info('Sending test email', { recipientOverride });
        return this.email.testEmail(recipientOverride);
    }
}
