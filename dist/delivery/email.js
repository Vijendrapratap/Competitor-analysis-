// =============================================================================
// Email Delivery — sends reports and critical alerts via Resend
// =============================================================================
import { Resend } from 'resend';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { createLogger } from '../utils/logger.js';
import { sleep, toErrorMessage, formatDate, formatDuration } from '../utils/helpers.js';
const log = createLogger('EmailDelivery');
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 2_000;
// ─────────────────────────────────────────────────────────────────────────────
// EmailDelivery
// ─────────────────────────────────────────────────────────────────────────────
export class EmailDelivery {
    resend;
    config;
    constructor(apiKey, config) {
        this.resend = new Resend(apiKey);
        this.config = {
            from: config.from,
            to: config.to,
            cc: config.cc ?? [],
            replyTo: config.replyTo ?? '',
            maxAttachmentBytes: config.maxAttachmentBytes ?? MAX_ATTACHMENT_BYTES,
            maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
            retryBaseDelayMs: config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
        };
        log.info('EmailDelivery initialised', {
            from: this.config.from,
            to: this.config.to,
            cc: this.config.cc,
        });
    }
    // ── Send daily report email ────────────────────────────────────────────────
    async sendReport(pdfPath, summary) {
        log.info('Preparing daily report email', {
            date: summary.reportDate,
            alerts: summary.totalAlerts,
        });
        // Read and validate PDF attachment
        const attachment = this.readAttachment(pdfPath);
        if (!attachment)
            return false;
        const subject = `🎯 Competitor Intelligence Report | ${summary.reportDate} | ${summary.totalAlerts} Alerts`;
        const html = this.buildReportEmailHtml(summary);
        const text = this.buildReportEmailText(summary);
        const result = await this.sendWithRetry({
            from: this.config.from,
            to: this.config.to,
            cc: this.config.cc.length > 0 ? this.config.cc : undefined,
            replyTo: this.config.replyTo || undefined,
            subject,
            html,
            text,
            attachments: [attachment],
        });
        if (result.success) {
            log.info('Report email sent successfully', {
                messageId: result.messageId,
                recipients: this.config.to,
            });
        }
        else {
            log.error('Failed to send report email', { error: result.error });
        }
        return result.success;
    }
    // ── Send critical alert email ──────────────────────────────────────────────
    async sendCriticalAlert(alert) {
        log.info('Sending critical alert email', {
            alertType: alert.alertType,
            competitor: alert.competitorName,
        });
        const subject = `🚨 CRITICAL: ${alert.title}`;
        const html = this.buildAlertEmailHtml(alert);
        const text = this.buildAlertEmailText(alert);
        const result = await this.sendWithRetry({
            from: this.config.from,
            to: this.config.to,
            cc: this.config.cc.length > 0 ? this.config.cc : undefined,
            subject,
            html,
            text,
        });
        if (result.success) {
            log.info('Critical alert email sent', { messageId: result.messageId });
        }
        else {
            log.error('Failed to send critical alert email', { error: result.error });
        }
        return result.success;
    }
    // ── Send test email ────────────────────────────────────────────────────────
    async testEmail(recipientOverride) {
        const to = recipientOverride ? [recipientOverride] : this.config.to;
        log.info('Sending test email', { to });
        const now = new Date();
        const subject = `✅ Competitor Intel — Test Email | ${formatDate(now)}`;
        const html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#1a365d;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:20px;">🎯 Competitor Intelligence System</h1>
          <p style="margin:4px 0 0;opacity:.8;">Test Email</p>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p>This is a test email from the Competitor Intelligence System.</p>
          <p>If you received this message, email delivery is working correctly.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
          <table style="width:100%;font-size:14px;color:#4a5568;">
            <tr><td style="padding:4px 0;"><strong>Timestamp:</strong></td><td>${now.toISOString()}</td></tr>
            <tr><td style="padding:4px 0;"><strong>From:</strong></td><td>${this.config.from}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Recipients:</strong></td><td>${to.join(', ')}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Status:</strong></td><td style="color:#38a169;font-weight:600;">Connected</td></tr>
          </table>
          <div style="margin-top:24px;padding:12px;background:#f7fafc;border-radius:6px;font-size:12px;color:#718096;">
            Competitor Intelligence System v1.0 | Powered by Resend
          </div>
        </div>
      </div>
    `;
        const result = await this.sendWithRetry({
            from: this.config.from,
            to,
            subject,
            html,
            text: `Competitor Intelligence System — Test Email\n\nEmail delivery is working correctly.\nTimestamp: ${now.toISOString()}`,
        });
        if (result.success) {
            log.info('Test email sent successfully', { messageId: result.messageId, to });
        }
        else {
            log.error('Test email failed', { error: result.error });
        }
        return result.success;
    }
    // ── Private: attachment reading ────────────────────────────────────────────
    readAttachment(filePath) {
        try {
            const stats = statSync(filePath);
            if (stats.size > this.config.maxAttachmentBytes) {
                log.error('PDF attachment too large', {
                    size: stats.size,
                    maxSize: this.config.maxAttachmentBytes,
                    path: filePath,
                });
                return null;
            }
            const content = readFileSync(filePath);
            const filename = basename(filePath);
            log.info('Attachment loaded', { filename, sizeKb: Math.round(stats.size / 1024) });
            return { filename, content };
        }
        catch (err) {
            log.error('Failed to read attachment', {
                path: filePath,
                error: toErrorMessage(err),
            });
            return null;
        }
    }
    // ── Private: send with retry ───────────────────────────────────────────────
    async sendWithRetry(payload) {
        let lastError;
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                log.info(`Email send attempt ${attempt}/${this.config.maxRetries}`, {
                    subject: payload.subject,
                    to: payload.to,
                });
                const { data, error } = await this.resend.emails.send({
                    from: payload.from,
                    to: payload.to,
                    cc: payload.cc,
                    replyTo: payload.replyTo,
                    subject: payload.subject,
                    html: payload.html,
                    text: payload.text,
                    attachments: payload.attachments?.map((a) => ({
                        filename: a.filename,
                        content: a.content,
                    })),
                });
                if (error) {
                    lastError = `Resend API error: ${error.message}`;
                    log.warn(`Send attempt ${attempt} failed`, { error: error.message });
                }
                else if (data?.id) {
                    return { success: true, messageId: data.id };
                }
                else {
                    lastError = 'Resend returned no data and no error';
                    log.warn(`Send attempt ${attempt} returned empty response`);
                }
            }
            catch (err) {
                lastError = toErrorMessage(err);
                log.warn(`Send attempt ${attempt} threw`, { error: lastError });
            }
            // Exponential backoff before retry
            if (attempt < this.config.maxRetries) {
                const delay = this.config.retryBaseDelayMs * 2 ** (attempt - 1);
                log.info(`Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
        return { success: false, error: lastError ?? 'Unknown error after all retries' };
    }
    // ── Private: report email HTML ─────────────────────────────────────────────
    buildReportEmailHtml(summary) {
        const alertBadge = (severity, count, color) => count > 0
            ? `<span style="display:inline-block;background:${color};color:#fff;padding:2px 10px;border-radius:12px;font-size:13px;margin-right:6px;">${severity}: ${count}</span>`
            : '';
        const durationStr = summary.pipelineDurationMs
            ? formatDuration(summary.pipelineDurationMs)
            : '—';
        return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#2d3748;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1a365d 0%,#2a4a7f 100%);color:#fff;padding:24px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">🎯 Competitor Intelligence Report</h1>
        <p style="margin:6px 0 0;opacity:.85;font-size:14px;">${summary.reportDate} | Hua Hin Hotel Market</p>
      </div>

      <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <!-- Greeting -->
        <p style="font-size:15px;">Good morning,</p>
        <p style="font-size:14px;color:#4a5568;">
          Your daily competitor intelligence report is ready. Here are today's highlights:
        </p>

        <!-- Highlights Grid -->
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr>
            <td style="padding:12px;background:#f7fafc;border-radius:6px;text-align:center;width:25%;">
              <div style="font-size:24px;font-weight:700;color:#1a365d;">${summary.competitorsAnalyzed}</div>
              <div style="font-size:11px;color:#718096;margin-top:4px;">Competitors<br/>Analyzed</div>
            </td>
            <td style="width:4%;"></td>
            <td style="padding:12px;background:#f7fafc;border-radius:6px;text-align:center;width:25%;">
              <div style="font-size:24px;font-weight:700;color:#1a365d;">${summary.totalAdsDetected}</div>
              <div style="font-size:11px;color:#718096;margin-top:4px;">Total Ads<br/>Detected</div>
            </td>
            <td style="width:4%;"></td>
            <td style="padding:12px;background:#f7fafc;border-radius:6px;text-align:center;width:25%;">
              <div style="font-size:24px;font-weight:700;color:#d69e2e;">${summary.newCampaignsLaunched}</div>
              <div style="font-size:11px;color:#718096;margin-top:4px;">New<br/>Campaigns</div>
            </td>
            <td style="width:4%;"></td>
            <td style="padding:12px;background:#f7fafc;border-radius:6px;text-align:center;width:25%;">
              <div style="font-size:24px;font-weight:700;color:#38a169;">${summary.healthScoreLeader?.score ?? '—'}</div>
              <div style="font-size:11px;color:#718096;margin-top:4px;">Leader Score<br/>${summary.healthScoreLeader?.name ?? '—'}</div>
            </td>
          </tr>
        </table>

        <!-- Alerts Summary -->
        <div style="margin:20px 0;padding:16px;background:${summary.alertCounts.critical > 0 ? '#fff5f5' : '#f7fafc'};border-radius:6px;border-left:4px solid ${summary.alertCounts.critical > 0 ? '#e53e3e' : '#1a365d'};">
          <strong style="font-size:14px;">Alert Summary</strong>
          <div style="margin-top:8px;">
            ${alertBadge('Critical', summary.alertCounts.critical, '#e53e3e')}
            ${alertBadge('Warning', summary.alertCounts.warning, '#d69e2e')}
            ${alertBadge('Info', summary.alertCounts.info, '#3182ce')}
            ${summary.totalAlerts === 0 ? '<span style="color:#38a169;font-size:13px;">No alerts — market is stable</span>' : ''}
          </div>
        </div>

        <!-- PDF Notice -->
        <div style="margin:20px 0;padding:16px;background:#ebf8ff;border-radius:6px;">
          <strong style="font-size:14px;">📎 Full Report Attached</strong>
          <p style="font-size:13px;color:#4a5568;margin:6px 0 0;">
            The complete PDF report with health scores, competitor profiles, share of voice analysis,
            and actionable recommendations is attached to this email.
          </p>
        </div>

        <!-- Footer -->
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px;" />
        <div style="font-size:11px;color:#a0aec0;line-height:1.6;">
          <div>Competitor Intelligence System v1.0</div>
          <div>Report generated: ${summary.generatedAt.toISOString()}</div>
          <div>Pipeline duration: ${durationStr}</div>
          <div style="margin-top:4px;">
            This is an automated report. Do not reply to this email.
          </div>
        </div>
      </div>
    </div>
    `;
    }
    // ── Private: report email plain text ───────────────────────────────────────
    buildReportEmailText(summary) {
        return [
            `COMPETITOR INTELLIGENCE REPORT — ${summary.reportDate}`,
            `${'='.repeat(50)}`,
            '',
            'Good morning,',
            '',
            'Your daily competitor intelligence report is ready.',
            '',
            'HIGHLIGHTS',
            `  Competitors Analyzed:  ${summary.competitorsAnalyzed}`,
            `  Total Ads Detected:    ${summary.totalAdsDetected}`,
            `  New Campaigns:         ${summary.newCampaignsLaunched}`,
            `  Health Score Leader:   ${summary.healthScoreLeader ? `${summary.healthScoreLeader.name} (${summary.healthScoreLeader.score})` : '—'}`,
            '',
            'ALERTS',
            `  Critical: ${summary.alertCounts.critical}`,
            `  Warning:  ${summary.alertCounts.warning}`,
            `  Info:     ${summary.alertCounts.info}`,
            '',
            'The full PDF report is attached to this email.',
            '',
            `${'─'.repeat(50)}`,
            'Competitor Intelligence System v1.0',
            `Generated: ${summary.generatedAt.toISOString()}`,
            summary.pipelineDurationMs ? `Duration: ${formatDuration(summary.pipelineDurationMs)}` : '',
            'This is an automated report. Do not reply.',
        ]
            .filter(Boolean)
            .join('\n');
    }
    // ── Private: alert email HTML ──────────────────────────────────────────────
    buildAlertEmailHtml(alert) {
        const severityColors = {
            critical: '#e53e3e',
            warning: '#d69e2e',
            info: '#3182ce',
        };
        const color = severityColors[alert.severity] ?? '#4a5568';
        return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#2d3748;">
      <!-- Header -->
      <div style="background:${color};color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:20px;">🚨 Critical Alert</h1>
        <p style="margin:6px 0 0;opacity:.9;font-size:14px;">${alert.title}</p>
      </div>

      <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#718096;width:140px;vertical-align:top;"><strong>Alert Type</strong></td>
            <td style="padding:8px 0;">${alert.alertType.replace(/_/g, ' ').toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#718096;vertical-align:top;"><strong>Severity</strong></td>
            <td style="padding:8px 0;">
              <span style="display:inline-block;background:${color};color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;">
                ${alert.severity.toUpperCase()}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#718096;vertical-align:top;"><strong>Competitor</strong></td>
            <td style="padding:8px 0;font-weight:600;">${alert.competitorName ?? `ID: ${alert.competitorId}`}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#718096;vertical-align:top;"><strong>Details</strong></td>
            <td style="padding:8px 0;">${alert.description}</td>
          </tr>
          ${alert.actionRequired ? `
          <tr>
            <td style="padding:8px 0;color:#718096;vertical-align:top;"><strong>Action Required</strong></td>
            <td style="padding:8px 0;color:${color};font-weight:600;">${alert.actionRequired}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding:8px 0;color:#718096;vertical-align:top;"><strong>Detected At</strong></td>
            <td style="padding:8px 0;">${alert.alertDate instanceof Date ? alert.alertDate.toISOString() : String(alert.alertDate)}</td>
          </tr>
        </table>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 16px;" />
        <div style="font-size:11px;color:#a0aec0;line-height:1.6;">
          <div>Competitor Intelligence System v1.0 — Critical Alert Notification</div>
          <div>This alert was triggered automatically. Review and take action promptly.</div>
        </div>
      </div>
    </div>
    `;
    }
    // ── Private: alert email plain text ────────────────────────────────────────
    buildAlertEmailText(alert) {
        return [
            `CRITICAL ALERT: ${alert.title}`,
            `${'='.repeat(50)}`,
            '',
            `Alert Type:     ${alert.alertType.replace(/_/g, ' ').toUpperCase()}`,
            `Severity:       ${alert.severity.toUpperCase()}`,
            `Competitor:     ${alert.competitorName ?? `ID: ${alert.competitorId}`}`,
            `Details:        ${alert.description}`,
            alert.actionRequired ? `Action Required: ${alert.actionRequired}` : '',
            `Detected At:    ${alert.alertDate instanceof Date ? alert.alertDate.toISOString() : String(alert.alertDate)}`,
            '',
            `${'─'.repeat(50)}`,
            'Competitor Intelligence System v1.0',
            'This alert was triggered automatically.',
        ]
            .filter(Boolean)
            .join('\n');
    }
}
//# sourceMappingURL=email.js.map