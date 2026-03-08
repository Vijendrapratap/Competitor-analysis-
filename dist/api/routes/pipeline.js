// =============================================================================
// Pipeline Routes — trigger and monitor pipeline runs
// =============================================================================
import { Router } from 'express';
import { createLogger } from '../../utils/logger.js';
import { pipelineRuns } from '../../db/schema.js';
import { db } from '../../db/index.js';
import { eq, desc } from 'drizzle-orm';
const log = createLogger('PipelineAPI');
export const pipelineRouter = Router();
// POST /api/pipeline/run — trigger full pipeline
pipelineRouter.post('/run', async (req, res) => {
    const { stages = ['scrape', 'analyze', 'generate'], competitorIds, dryRun = false } = req.body;
    const runId = `run_${Date.now()}`;
    try {
        await db.insert(pipelineRuns).values({
            id: runId,
            status: 'running',
            stage: stages[0] ?? 'idle',
            startedAt: new Date(),
            results: {},
            dryRun,
        });
        // Return immediately, execute in background
        res.status(202).json({ data: { runId, status: 'running' } });
        // Execute pipeline stages in background
        (async () => {
            try {
                for (const stage of stages) {
                    await db.update(pipelineRuns)
                        .set({ stage })
                        .where(eq(pipelineRuns.id, runId));
                    log.info(`Pipeline ${runId}: starting ${stage}`);
                    let stageResult = {};
                    if (stage === 'scrape') {
                        const { ScrapeService } = await import('../../services/scrape.js');
                        const svc = new ScrapeService();
                        stageResult = await svc.run({ competitorIds, dryRun });
                    }
                    else if (stage === 'analyze') {
                        const { AnalysisService } = await import('../../services/analysis.js');
                        const svc = new AnalysisService();
                        stageResult = await svc.run({ competitorIds, dryRun });
                    }
                    else if (stage === 'generate') {
                        const { ReportService } = await import('../../services/report.js');
                        const svc = new ReportService();
                        stageResult = await svc.run({ dryRun });
                    }
                    else if (stage === 'deliver') {
                        const { DeliveryService } = await import('../../services/delivery.js');
                        const svc = new DeliveryService();
                        stageResult = await svc.run({ dryRun });
                    }
                    // Append stage result to the record
                    const [currentRun] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId));
                    if (currentRun) {
                        const updatedResults = { ...currentRun.results, [stage]: stageResult };
                        await db.update(pipelineRuns)
                            .set({ results: updatedResults })
                            .where(eq(pipelineRuns.id, runId));
                    }
                }
                await db.update(pipelineRuns)
                    .set({
                    status: 'completed',
                    completedAt: new Date()
                })
                    .where(eq(pipelineRuns.id, runId));
                log.info(`Pipeline ${runId}: completed`);
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                await db.update(pipelineRuns)
                    .set({
                    status: 'failed',
                    completedAt: new Date(),
                    error: errorMessage
                })
                    .where(eq(pipelineRuns.id, runId));
                log.error(`Pipeline ${runId}: failed`, { error: errorMessage });
            }
        })();
    }
    catch (err) {
        log.error('Failed to initialize pipeline run in database', err);
        res.status(500).json({ error: 'Failed' });
    }
});
// GET /api/pipeline/status/:runId — check run status
pipelineRouter.get('/status/:runId', async (req, res) => {
    try {
        const [run] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, req.params.runId));
        if (!run) {
            res.status(404).json({ error: 'Run not found' });
            return;
        }
        res.json({ data: run });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});
// GET /api/pipeline/runs — list recent runs
pipelineRouter.get('/runs', async (_req, res) => {
    try {
        const allRuns = await db.select()
            .from(pipelineRuns)
            .orderBy(desc(pipelineRuns.startedAt))
            .limit(20);
        res.json({ data: allRuns });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});
// POST /api/pipeline/scrape — trigger scrape only
pipelineRouter.post('/scrape', async (req, res) => {
    const { competitorIds, dryRun = false } = req.body;
    try {
        const { ScrapeService } = await import('../../services/scrape.js');
        const svc = new ScrapeService();
        const result = await svc.run({ competitorIds, dryRun });
        res.json({ data: result });
    }
    catch (err) {
        res.status(500).json({ error: 'Scrape failed', details: err instanceof Error ? err.message : String(err) });
    }
});
// POST /api/pipeline/analyze — trigger analysis only
pipelineRouter.post('/analyze', async (req, res) => {
    const { competitorIds, dryRun = false } = req.body;
    try {
        const { AnalysisService } = await import('../../services/analysis.js');
        const svc = new AnalysisService();
        const result = await svc.run({ competitorIds, dryRun });
        res.json({ data: result });
    }
    catch (err) {
        res.status(500).json({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) });
    }
});
// POST /api/pipeline/generate — trigger report generation only
pipelineRouter.post('/generate', async (req, res) => {
    const { dryRun = false } = req.body;
    try {
        const { ReportService } = await import('../../services/report.js');
        const svc = new ReportService();
        const result = await svc.run({ dryRun });
        res.json({ data: result });
    }
    catch (err) {
        res.status(500).json({ error: 'Report generation failed', details: err instanceof Error ? err.message : String(err) });
    }
});
//# sourceMappingURL=pipeline.js.map