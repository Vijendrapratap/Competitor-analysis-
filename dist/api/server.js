// =============================================================================
// Express API Server — REST endpoints for the Competitor Intel System
// =============================================================================
import express from 'express';
import cors from 'cors';
import { createLogger } from '../utils/logger.js';
import { competitorsRouter } from './routes/competitors.js';
import { pipelineRouter } from './routes/pipeline.js';
import { reportsRouter } from './routes/reports.js';
import { alertsRouter } from './routes/alerts.js';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';
import { closeBrowser } from '../services/pdfService.js';
const log = createLogger('API');
export function createApp() {
    const app = express();
    // ── Middleware ──────────────────────────────────────────────────────────────
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    // ── Request logging ────────────────────────────────────────────────────────
    app.use((req, _res, next) => {
        log.info(`${req.method} ${req.path}`);
        next();
    });
    // ── Routes ─────────────────────────────────────────────────────────────────
    app.use('/api/competitors', competitorsRouter);
    app.use('/api/pipeline', pipelineRouter);
    app.use('/api/reports', reportsRouter);
    app.use('/api/alerts', alertsRouter);
    app.use('/api/health', healthRouter);
    // ── Global error handler (must be after all routes) ────────────────────────
    app.use(errorHandler);
    return app;
}
// ── Standalone entry point ───────────────────────────────────────────────────
const PORT = parseInt(process.env['API_PORT'] ?? process.env['PORT'] ?? '3000', 10);
if (process.argv[1]?.includes('server')) {
    const app = createApp();
    const server = app.listen(PORT, () => {
        log.info(`🚀 Report API running → http://localhost:${PORT}`);
        log.info(`   GET  /api/reports                — list all reports`);
        log.info(`   GET  /api/reports/:uuid/pdf      — download PDF`);
        log.info(`   GET  /api/reports/:uuid/view     — view PDF in browser`);
        log.info(`   GET  /api/health                 — server + DB status`);
    });
    process.on('SIGTERM', async () => {
        log.info('Shutting down gracefully...');
        await closeBrowser();
        server.close(() => process.exit(0));
    });
    process.on('SIGINT', async () => {
        log.info('Shutting down...');
        await closeBrowser();
        server.close(() => process.exit(0));
    });
}
//# sourceMappingURL=server.js.map