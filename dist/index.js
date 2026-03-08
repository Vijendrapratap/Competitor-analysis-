#!/usr/bin/env node
// =============================================================================
// Competitor Intelligence System — CLI entry point
// =============================================================================
import { Command, Option } from 'commander';
import { createLogger, logStageEnd, logStageError, logStageStart } from './utils/logger.js';
import { formatDuration, timed } from './utils/helpers.js';
const log = createLogger('cli');
const pkg = { version: '1.0.0' }; // loaded inline to avoid top-level await issues
// ─────────────────────────────────────────────────────────────────────────────
// Lazy service imports — only loaded when the relevant command is invoked.
// This keeps startup time fast regardless of which sub-command is run.
// Replace each stub with a real import once the module is implemented.
// ─────────────────────────────────────────────────────────────────────────────
async function getScrapeService() {
    const { ScrapeService } = await import('./services/scrape.js');
    return new ScrapeService();
}
async function getAnalysisService() {
    const { AnalysisService } = await import('./services/analysis.js');
    return new AnalysisService();
}
async function getReportService() {
    const { ReportService } = await import('./services/report.js');
    return new ReportService();
}
async function getDeliveryService() {
    const { DeliveryService } = await import('./services/delivery.js');
    return new DeliveryService();
}
async function getMigrationsRunner() {
    const { runMigrations } = await import('./db/migrations/run.js');
    return runMigrations;
}
// ─────────────────────────────────────────────────────────────────────────────
// Shared option declarations (reused across commands)
// ─────────────────────────────────────────────────────────────────────────────
const competitorIdsOption = new Option('-c, --competitors <ids>', 'Comma-separated competitor IDs to target (default: all active)').argParser((v) => v.split(',').map((id) => {
    const n = parseInt(id.trim(), 10);
    if (isNaN(n))
        throw new Error(`Invalid competitor ID: "${id}"`);
    return n;
}));
const dryRunOption = new Option('--dry-run', 'Skip side-effects (email delivery, DB writes) and just log what would happen').default(false);
const forceOption = new Option('--force', 'Force execution even if fresh data already exists').default(false);
// ─────────────────────────────────────────────────────────────────────────────
// Shared error handler for all commands
// ─────────────────────────────────────────────────────────────────────────────
function handleCommandError(stage, err) {
    logStageError(stage, err);
    process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────
// Command implementations
// ─────────────────────────────────────────────────────────────────────────────
async function cmdRun(opts) {
    log.info('Starting full pipeline', { opts });
    const runOptions = {
        competitorIds: opts.competitors,
        dryRun: opts.dryRun,
        force: opts.force,
    };
    const stages = [
        { name: 'scrape', fn: cmdScrape },
        { name: 'analyze', fn: cmdAnalyze },
        { name: 'generate', fn: cmdGenerate },
        { name: 'deliver', fn: cmdDeliver },
    ];
    for (const stage of stages) {
        logStageStart(stage.name);
        try {
            const [, duration] = await timed(() => stage.fn({
                competitors: runOptions.competitorIds,
                dryRun: runOptions.dryRun ?? false,
                force: runOptions.force ?? false
            }));
            logStageEnd(stage.name, duration);
        }
        catch (err) {
            handleCommandError(stage.name, err);
        }
    }
    log.info('Full pipeline complete.');
}
async function cmdScrape(opts) {
    logStageStart('scrape');
    const [, duration] = await timed(async () => {
        const svc = await getScrapeService();
        const result = await svc.run({
            competitorIds: opts.competitors,
            dryRun: opts.dryRun,
            force: opts.force,
        });
        log.info('Scrape result', result);
    });
    logStageEnd('scrape', duration);
}
async function cmdAnalyze(opts) {
    logStageStart('analyze');
    const [, duration] = await timed(async () => {
        const svc = await getAnalysisService();
        const result = await svc.run({
            competitorIds: opts.competitors,
            dryRun: opts.dryRun,
            force: opts.force,
        });
        log.info('Analysis result', result);
    });
    logStageEnd('analyze', duration);
}
async function cmdGenerate(opts) {
    logStageStart('generate');
    const [, duration] = await timed(async () => {
        const svc = await getReportService();
        const result = await svc.run({ dryRun: opts.dryRun });
        log.info('Report result', result);
    });
    logStageEnd('generate', duration);
}
async function cmdDeliver(opts) {
    logStageStart('deliver');
    const [, duration] = await timed(async () => {
        const svc = await getDeliveryService();
        const result = await svc.run({ dryRun: opts.dryRun });
        log.info('Delivery result', result);
    });
    logStageEnd('deliver', duration);
}
async function cmdTestEmail(opts) {
    logStageStart('test-email');
    const [, duration] = await timed(async () => {
        const svc = await getDeliveryService();
        log.info('Sending test email...', { to: opts.to });
        return svc;
    });
    logStageEnd('test-email', duration);
}
async function cmdMigrate() {
    logStageStart('migrate');
    const [, duration] = await timed(async () => {
        const runMigrations = await getMigrationsRunner();
        await runMigrations();
    });
    logStageEnd('migrate', duration);
}
// ─────────────────────────────────────────────────────────────────────────────
// Program definition
// ─────────────────────────────────────────────────────────────────────────────
const program = new Command();
program
    .name('competitor-intel')
    .description('Automated competitor intelligence: scraping, analysis & reporting')
    .version(pkg.version, '-v, --version', 'Print version and exit')
    .addHelpText('after', `
Examples:
  $ competitor-intel run                        # Full pipeline (all competitors)
  $ competitor-intel run -c 1,3 --dry-run       # Dry-run for competitors 1 & 3
  $ competitor-intel scrape --force             # Force re-scrape all
  $ competitor-intel analyze -c 2               # Analyse competitor 2 only
  $ competitor-intel generate                   # Generate PDF report
  $ competitor-intel deliver --dry-run          # Preview email without sending
  $ competitor-intel test-email --to me@x.com  # Send a test email
  $ competitor-intel migrate                    # Run DB migrations
`);
// ── run ───────────────────────────────────────────────────────────────────────
program
    .command('run')
    .description('Execute the full pipeline: scrape → analyze → generate → deliver')
    .addOption(competitorIdsOption)
    .addOption(dryRunOption)
    .addOption(forceOption)
    .action(async (opts) => {
    try {
        const [, duration] = await timed(() => cmdRun(opts));
        log.info(`Pipeline finished in ${formatDuration(duration)}`);
    }
    catch (err) {
        handleCommandError('run', err);
    }
});
// ── scrape ────────────────────────────────────────────────────────────────────
program
    .command('scrape')
    .description('Scrape Facebook pages and Meta Ads Library for all active competitors')
    .addOption(competitorIdsOption)
    .addOption(dryRunOption)
    .addOption(forceOption)
    .action(async (opts) => {
    try {
        await cmdScrape(opts);
    }
    catch (err) {
        handleCommandError('scrape', err);
    }
});
// ── analyze ───────────────────────────────────────────────────────────────────
program
    .command('analyze')
    .description('Run analysis and compute health scores from the latest scraped data')
    .addOption(competitorIdsOption)
    .addOption(dryRunOption)
    .addOption(forceOption)
    .action(async (opts) => {
    try {
        await cmdAnalyze(opts);
    }
    catch (err) {
        handleCommandError('analyze', err);
    }
});
// ── generate ──────────────────────────────────────────────────────────────────
program
    .command('generate')
    .description('Generate the weekly PDF intelligence report')
    .addOption(competitorIdsOption)
    .addOption(dryRunOption)
    .addOption(forceOption)
    .option('-o, --output <path>', 'Override output file path for the generated PDF')
    .action(async (opts) => {
    try {
        await cmdGenerate(opts);
    }
    catch (err) {
        handleCommandError('generate', err);
    }
});
// ── deliver ───────────────────────────────────────────────────────────────────
program
    .command('deliver')
    .description('Email the latest generated report to all configured recipients')
    .addOption(dryRunOption)
    .option('--recipients <emails>', 'Override recipient list (comma-separated)', (v) => v.split(',').map((e) => e.trim()))
    .action(async (opts) => {
    try {
        await cmdDeliver({ dryRun: opts.dryRun });
    }
    catch (err) {
        handleCommandError('deliver', err);
    }
});
// ── test-email ────────────────────────────────────────────────────────────────
program
    .command('test-email')
    .description('Send a test email to verify Resend configuration')
    .option('--to <email>', 'Recipient address (defaults to EMAIL_TEST_RECIPIENT in .env)')
    .action(async (opts) => {
    try {
        await cmdTestEmail(opts);
    }
    catch (err) {
        handleCommandError('test-email', err);
    }
});
// ── migrate ───────────────────────────────────────────────────────────────────
program
    .command('migrate')
    .description('Apply pending Drizzle ORM database migrations')
    .action(async () => {
    try {
        await cmdMigrate();
    }
    catch (err) {
        handleCommandError('migrate', err);
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// Global error hooks
// ─────────────────────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
    });
    process.exit(1);
});
// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
program.parseAsync(process.argv).catch((err) => {
    log.error('Fatal CLI error', {
        error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
});
//# sourceMappingURL=index.js.map