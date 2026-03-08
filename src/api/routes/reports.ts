// =============================================================================
// Reports Routes — list, view, download, manage intelligence reports
// =============================================================================

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as db from '../../services/dbService.js';
import {
    htmlToPdfBuffer,
    competitorToPdfBuffer,
} from '../../services/pdfService.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('routes:reports');
export const reportsRouter = Router();


// ─────────────────────────────────────────────────────────
// GET /api/reports
// List all reports (no HTML content — fast)
// Query: ?clientName= &status= &year= &month= &limit= &offset=
// ─────────────────────────────────────────────────────────
reportsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const reports = await db.listReports({
            clientName: req.query['clientName'] as string | undefined,
            status: req.query['status'] as string | undefined,
            year: req.query['year'] ? Number(req.query['year']) : undefined,
            month: req.query['month'] ? Number(req.query['month']) : undefined,
            limit: req.query['limit'] ? Number(req.query['limit']) : 50,
            offset: req.query['offset'] ? Number(req.query['offset']) : 0,
        });
        res.json({ success: true, count: reports.length, data: reports });
    } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────
// GET /api/reports/trends/:name
// Competitor performance across last N months
// Query: ?months=6
// NOTE: This must be registered BEFORE /:uuid to avoid conflicts
// ─────────────────────────────────────────────────────────
reportsRouter.get('/trends/:name', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const trend = await db.getCompetitorTrend(
            decodeURIComponent(String(req.params['name'])),
            req.query['months'] ? Number(req.query['months']) : 6,
        );
        res.json({ success: true, count: trend.length, data: trend });
    } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────
// GET /api/reports/:uuid
// Report metadata + intelligence summary (no raw HTML)
// ─────────────────────────────────────────────────────────
reportsRouter.get('/:uuid', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const report = await db.getReportByUuid(String(req.params['uuid']));
        if (!report) {
            res.status(404).json({ success: false, error: 'Report not found' });
            return;
        }

        await db.logAccess(report.id, report.reportUuid, 'metadata', undefined, req.ip);

        // Strip htmlContent from response — it can be 500KB+
        const { htmlContent: _html, ...safe } = report;
        res.json({ success: true, data: safe });
    } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────
// GET /api/reports/:uuid/pdf
// Download full report as a PDF file
// ─────────────────────────────────────────────────────────
reportsRouter.get('/:uuid/pdf', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const report = await db.getReportByUuid(String(req.params['uuid']));
        if (!report) {
            res.status(404).json({ success: false, error: 'Report not found' });
            return;
        }

        log.info(`Rendering PDF: "${report.title}"...`);
        const t0 = Date.now();
        const pdf = await htmlToPdfBuffer(report.htmlContent);
        const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
        const sizeKb = (pdf.length / 1024).toFixed(0);
        log.info(`  ✓ ${elapsedSec}s | ${sizeKb}KB`);

        await db.logAccess(report.id, report.reportUuid, 'pdf_download', undefined, req.ip);

        const filename = `Hua_Hin_Intelligence_${report.reportYear}-${String(report.reportMonth).padStart(2, '0')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdf.length);
        res.end(pdf);
    } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────
// GET /api/reports/:uuid/view
// View full report PDF inline in the browser
// ─────────────────────────────────────────────────────────
reportsRouter.get('/:uuid/view', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const report = await db.getReportByUuid(String(req.params['uuid']));
        if (!report) {
            res.status(404).json({ success: false, error: 'Report not found' });
            return;
        }

        const pdf = await htmlToPdfBuffer(report.htmlContent);
        await db.logAccess(report.id, report.reportUuid, 'pdf_view', undefined, req.ip);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Content-Length', pdf.length);
        res.end(pdf);
    } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────
// GET /api/reports/:uuid/competitors
// List all competitor snapshots for a report
// ─────────────────────────────────────────────────────────
reportsRouter.get('/:uuid/competitors', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const report = await db.getReportByUuid(String(req.params['uuid']));
        if (!report) {
            res.status(404).json({ success: false, error: 'Report not found' });
            return;
        }

        const competitors = await db.getReportCompetitors(report.id);

        // Strip competitorHtml from list (large field)
        const safe = competitors.map(({ competitorHtml: _html, ...c }) => c);
        res.json({ success: true, count: safe.length, data: safe });
    } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────
// GET /api/reports/:uuid/competitors/:name/pdf
// Single competitor page exported as standalone PDF
// ─────────────────────────────────────────────────────────
reportsRouter.get('/:uuid/competitors/:name/pdf', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const report = await db.getReportByUuid(String(req.params['uuid']));
        if (!report) {
            res.status(404).json({ success: false, error: 'Report not found' });
            return;
        }

        const competitors = await db.getReportCompetitors(report.id);
        const name = decodeURIComponent(String(req.params['name']));
        const comp = competitors.find(
            c => c.competitorName.toLowerCase() === name.toLowerCase(),
        );

        if (!comp?.competitorHtml) {
            res.status(404).json({ success: false, error: 'Competitor not found or no HTML stored' });
            return;
        }

        const pdf = await competitorToPdfBuffer(
            comp.competitorHtml,
            `${comp.competitorName} — ${report.title}`,
        );
        const filename = `${name.replace(/\s+/g, '_')}_${report.reportYear}-${String(report.reportMonth).padStart(2, '0')}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.end(pdf);
    } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────
// DELETE /api/reports/:id
// Soft delete — data stays in DB, status → 'deleted'
// ─────────────────────────────────────────────────────────
reportsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Number(req.params['id']);
        if (isNaN(id)) {
            res.status(400).json({ success: false, error: 'id must be a number' });
            return;
        }
        await db.softDeleteReport(id);
        res.json({ success: true, message: `Report ${id} deleted` });
    } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────
// PATCH /api/reports/:id/restore
// ─────────────────────────────────────────────────────────
reportsRouter.patch('/:id/restore', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Number(req.params['id']);
        await db.restoreReport(id);
        res.json({ success: true, message: `Report ${id} restored` });
    } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────
// PATCH /api/reports/:id/archive
// ─────────────────────────────────────────────────────────
reportsRouter.patch('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Number(req.params['id']);
        await db.archiveReport(id);
        res.json({ success: true, message: `Report ${id} archived` });
    } catch (err) { next(err); }
});
