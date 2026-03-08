#!/usr/bin/env node
// =============================================================================
// Scheduler — PM2-compatible daily pipeline runner with node-cron
// =============================================================================
import cron from 'node-cron';
import { createServer } from 'node:http';
import { settings } from './config/settings.js';
import { createLogger, logStageStart, logStageEnd, logStageError } from './utils/logger.js';
import { timed, formatDuration, toErrorMessage, sleep } from './utils/helpers.js';
import { closeConnection } from './db/index.js';
const log = createLogger('Scheduler');
let lastRun = null;
let isRunning = false;
let totalRuns = 0;
let successfulRuns = 0;
const startedAt = new Date();
// ─────────────────────────────────────────────────────────────────────────────
// Pipeline stages — lazy imports to keep scheduler startup fast
// ─────────────────────────────────────────────────────────────────────────────
async function runScrapeStage() {
    log.info('Scrape stage — executing scrapers via ScrapeService');
    const { ScrapeService } = await import('./services/scrape.js');
    const svc = new ScrapeService();
    const result = await svc.run({});
    log.info('Scrape stage complete', { result });
}
async function runAnalysisStage() {
    log.info('Analysis stage — computing scores & insights via AnalysisService');
    const { AnalysisService } = await import('./services/analysis.js');
    const svc = new AnalysisService();
    const result = await svc.run({});
    log.info('Analysis stage complete', { result });
}
async function runGenerateStage() {
    log.info('Generate stage — building PDF report via ReportService');
    const { ReportService } = await import('./services/report.js');
    const svc = new ReportService();
    const result = await svc.run({});
    log.info('Generate stage complete', { result });
}
async function runDeliverStage() {
    log.info('Deliver stage — sending email via DeliveryService');
    const { DeliveryService } = await import('./services/delivery.js');
    const svc = new DeliveryService();
    const result = await svc.run({});
    log.info('Deliver stage complete', { result });
}
async function sendErrorNotification(error, stage) {
    try {
        const { EmailDelivery } = await import('./delivery/email.js');
        const delivery = new EmailDelivery(settings.email.resendApiKey, {
            from: settings.email.from,
            to: settings.email.recipients,
        });
        // Reuse the test-email mechanism for error notifications
        const { Resend } = await import('resend');
        const resend = new Resend(settings.email.resendApiKey);
        await resend.emails.send({
            from: settings.email.from,
            to: settings.email.recipients,
            subject: `⚠️ Competitor Intel Pipeline FAILED — ${stage}`,
            html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <div style="background:#e53e3e;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
            <h1 style="margin:0;font-size:20px;">Pipeline Failure</h1>
            <p style="margin:6px 0 0;opacity:.9;">Stage: ${stage}</p>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
            <p><strong>Error:</strong></p>
            <pre style="background:#f7fafc;padding:12px;border-radius:4px;font-size:13px;overflow-x:auto;">${escapeHtml(error)}</pre>
            <p style="font-size:13px;color:#718096;">Timestamp: ${new Date().toISOString()}</p>
            <p style="font-size:13px;color:#718096;">The scheduler will retry on the next scheduled run.</p>
          </div>
        </div>
      `,
            text: `Pipeline Failure\n\nStage: ${stage}\nError: ${error}\nTimestamp: ${new Date().toISOString()}`,
        });
        log.info('Error notification sent to admins');
    }
    catch (notifyErr) {
        log.error('Failed to send error notification', { error: toErrorMessage(notifyErr) });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Main pipeline runner
// ─────────────────────────────────────────────────────────────────────────────
async function runPipeline() {
    if (isRunning) {
        log.warn('Pipeline already running — skipping this invocation');
        return;
    }
    isRunning = true;
    totalRuns++;
    const run = {
        startedAt: new Date(),
        finishedAt: null,
        durationMs: null,
        status: 'running',
        stages: [],
    };
    lastRun = run;
    log.info('═'.repeat(70));
    log.info('  DAILY PIPELINE STARTED');
    log.info(`  Time: ${run.startedAt.toISOString()}`);
    log.info('═'.repeat(70));
    const stages = [
        { name: 'scrape', fn: runScrapeStage },
        { name: 'analyze', fn: runAnalysisStage },
        { name: 'generate', fn: runGenerateStage },
        { name: 'deliver', fn: runDeliverStage },
    ];
    let failed = false;
    for (const stage of stages) {
        logStageStart(stage.name);
        try {
            const [, duration] = await timed(stage.fn);
            logStageEnd(stage.name, duration);
            run.stages.push({ name: stage.name, status: 'success', durationMs: duration });
        }
        catch (err) {
            const errorMsg = toErrorMessage(err);
            const stack = err instanceof Error ? err.stack : undefined;
            logStageError(stage.name, err);
            log.error(`Full stack trace for ${stage.name}`, { stack });
            run.stages.push({ name: stage.name, status: 'failed', durationMs: 0, error: errorMsg });
            run.error = `Stage "${stage.name}" failed: ${errorMsg}`;
            failed = true;
            // Send error notification but don't crash the scheduler
            await sendErrorNotification(stack ?? errorMsg, stage.name);
            // Skip remaining stages after failure
            for (const remaining of stages.slice(stages.indexOf(stage) + 1)) {
                run.stages.push({ name: remaining.name, status: 'skipped', durationMs: 0 });
            }
            break;
        }
    }
    const finishedAt = new Date();
    const totalDuration = finishedAt.getTime() - run.startedAt.getTime();
    run.finishedAt = finishedAt;
    run.durationMs = totalDuration;
    run.status = failed ? 'failed' : 'success';
    if (!failed)
        successfulRuns++;
    log.info('═'.repeat(70));
    log.info(`  DAILY PIPELINE ${failed ? 'FAILED' : 'COMPLETE'}`);
    log.info(`  Duration: ${formatDuration(totalDuration)}`);
    log.info(`  Stages: ${run.stages.map((s) => `${s.name}:${s.status}`).join(' → ')}`);
    log.info('═'.repeat(70));
    isRunning = false;
}
// ─────────────────────────────────────────────────────────────────────────────
// Health check HTTP server
// ─────────────────────────────────────────────────────────────────────────────
function startHealthServer(port) {
    const server = createServer((req, res) => {
        const url = req.url ?? '/';
        if (url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                uptime: formatDuration(Date.now() - startedAt.getTime()),
                startedAt: startedAt.toISOString(),
                isRunning,
                totalRuns,
                successfulRuns,
                failedRuns: totalRuns - successfulRuns,
            }));
            return;
        }
        if (url === '/last-run') {
            if (!lastRun) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'No runs yet' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                startedAt: lastRun.startedAt.toISOString(),
                finishedAt: lastRun.finishedAt?.toISOString() ?? null,
                duration: lastRun.durationMs ? formatDuration(lastRun.durationMs) : null,
                status: lastRun.status,
                stages: lastRun.stages,
                error: lastRun.error ?? null,
            }));
            return;
        }
        if (url === '/trigger' && req.method === 'POST') {
            if (isRunning) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Pipeline already running' }));
                return;
            }
            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Pipeline triggered' }));
            // Fire and forget
            runPipeline().catch((err) => {
                log.error('Manually triggered pipeline failed', { error: toErrorMessage(err) });
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Not found',
            routes: ['GET /health', 'GET /last-run', 'POST /trigger'],
        }));
    });
    server.listen(port, '0.0.0.0', () => {
        log.info(`Health check server listening on port ${port}`);
        log.info(`  GET  http://localhost:${port}/health`);
        log.info(`  GET  http://localhost:${port}/last-run`);
        log.info(`  POST http://localhost:${port}/trigger`);
    });
    server.on('error', (err) => {
        log.warn(`Health server failed to start: ${err.message}. Continuing without health endpoint.`);
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Cron schedule
// ─────────────────────────────────────────────────────────────────────────────
// 6:00 AM Bangkok time (ICT = UTC+7) → 23:00 UTC previous day
const CRON_EXPRESSION = '0 23 * * *';
function startScheduler() {
    log.info('═'.repeat(70));
    log.info('  COMPETITOR INTELLIGENCE SCHEDULER');
    log.info(`  Schedule: ${CRON_EXPRESSION} (23:00 UTC = 06:00 Bangkok time)`);
    log.info(`  Started at: ${startedAt.toISOString()}`);
    log.info(`  Environment: ${settings.env}`);
    log.info('═'.repeat(70));
    // Validate cron expression
    if (!cron.validate(CRON_EXPRESSION)) {
        log.error('Invalid cron expression', { expression: CRON_EXPRESSION });
        process.exit(1);
    }
    // Schedule the daily pipeline
    const task = cron.schedule(CRON_EXPRESSION, () => {
        log.info('Cron trigger fired — starting daily pipeline');
        runPipeline().catch((err) => {
            log.error('Pipeline crashed unexpectedly', { error: toErrorMessage(err) });
        });
    }, {
        timezone: 'UTC',
    });
    log.info('Cron job scheduled. Waiting for next trigger...');
    // Start health check endpoint
    const healthPort = parseInt(process.env['HEALTH_PORT'] ?? '3000', 10);
    startHealthServer(healthPort);
    // Graceful shutdown
    const shutdown = async (signal) => {
        log.info(`Received ${signal} — shutting down gracefully`);
        task.stop();
        // Wait for running pipeline to finish (up to 5 minutes)
        if (isRunning) {
            log.info('Waiting for running pipeline to complete...');
            const maxWait = 5 * 60 * 1_000;
            const start = Date.now();
            while (isRunning && Date.now() - start < maxWait) {
                await sleep(1_000);
            }
            if (isRunning) {
                log.warn('Pipeline still running after 5min — forcing shutdown');
            }
        }
        try {
            await closeConnection();
            log.info('Database connections closed');
        }
        catch {
            // ignore
        }
        log.info('Scheduler stopped');
        process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
        log.error('Uncaught exception in scheduler', { error: err.message, stack: err.stack });
        // Don't crash — let PM2 handle restart if needed
    });
    process.on('unhandledRejection', (reason) => {
        log.error('Unhandled rejection in scheduler', {
            reason: reason instanceof Error ? reason.message : String(reason),
        });
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// HTML escape utility
// ─────────────────────────────────────────────────────────────────────────────
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
// Allow running directly: node --import tsx/esm src/scheduler.ts
// Or triggered from CLI: competitor-intel schedule
const isDirectRun = process.argv[1]?.endsWith('scheduler.ts') ||
    process.argv[1]?.endsWith('scheduler.js');
if (isDirectRun) {
    startScheduler();
}
export { startScheduler, runPipeline };
//# sourceMappingURL=scheduler.js.map