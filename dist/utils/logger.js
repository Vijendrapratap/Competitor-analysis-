// =============================================================================
// Logger — Winston with daily-rotate-file transport
// =============================================================================
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = resolve(__dirname, '../../logs');
// Ensure log directory exists before transports are created
mkdirSync(LOG_DIR, { recursive: true });
// ─────────────────────────────────────────────────────────────────────────────
// Custom formats
// ─────────────────────────────────────────────────────────────────────────────
/** Pretty console output: timestamp  LEVEL  [context]  message  { meta } */
const consoleFormat = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.colorize({ all: true }), winston.format.errors({ stack: true }), winston.format.printf(({ timestamp, level, message, context, stack, ...meta }) => {
    const ctx = context ? ` [${String(context)}]` : '';
    const metaStr = Object.keys(meta).length > 0
        ? `  ${JSON.stringify(meta, null, 0)}`
        : '';
    const errorStack = stack ? `\n${String(stack)}` : '';
    return `${String(timestamp)}  ${level}${ctx}  ${String(message)}${metaStr}${errorStack}`;
}));
/** Machine-readable JSON for log files */
const fileFormat = winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json());
// ─────────────────────────────────────────────────────────────────────────────
// Transports
// ─────────────────────────────────────────────────────────────────────────────
const consoleTransport = new winston.transports.Console({
    format: consoleFormat,
});
const combinedRotateTransport = new DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: fileFormat,
});
const errorRotateTransport = new DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '10m',
    maxFiles: '30d',
    level: 'error',
    format: fileFormat,
});
// ─────────────────────────────────────────────────────────────────────────────
// Root logger instance
// ─────────────────────────────────────────────────────────────────────────────
const logLevel = process.env['LOG_LEVEL'] ?? 'info';
export const logger = winston.createLogger({
    level: logLevel,
    transports: [consoleTransport, combinedRotateTransport, errorRotateTransport],
    exitOnError: false,
});
// ─────────────────────────────────────────────────────────────────────────────
// Child logger factory
// Usage:  const log = createLogger('ScraperService');
//         log.info('started');   // → ... [ScraperService] started
// ─────────────────────────────────────────────────────────────────────────────
export function createLogger(context) {
    return logger.child({ context });
}
// ─────────────────────────────────────────────────────────────────────────────
// Convenience helpers for top-level pipeline stages
// ─────────────────────────────────────────────────────────────────────────────
export function logStageStart(stage) {
    logger.info(`${'═'.repeat(60)}`);
    logger.info(`  STAGE START: ${stage.toUpperCase()}`);
    logger.info(`${'═'.repeat(60)}`);
}
export function logStageEnd(stage, durationMs) {
    logger.info(`${'─'.repeat(60)}`);
    logger.info(`  STAGE DONE:  ${stage.toUpperCase()}  (${(durationMs / 1_000).toFixed(2)}s)`);
    logger.info(`${'─'.repeat(60)}`);
}
export function logStageError(stage, err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error(`STAGE FAILED: ${stage.toUpperCase()} — ${message}`, { stack });
}
//# sourceMappingURL=logger.js.map