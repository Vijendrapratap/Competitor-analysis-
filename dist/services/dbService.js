// =============================================================================
// DB Service — All report-related database operations
//
// Uses Drizzle ORM for the report tables.
// =============================================================================
import { db, schema } from '../db/index.js';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
// ─── CREATE ──────────────────────────────────────────────
/**
 * Save a complete report + all competitor snapshots in a single transaction.
 */
export async function saveReport(input) {
    return await db.transaction(async (tx) => {
        // 1. Insert the main report row
        const [report] = await tx.insert(schema.reports).values({
            title: input.title,
            clientName: input.clientName ?? null,
            marketLocation: input.marketLocation ?? 'Hua Hin, Thailand',
            reportMonth: input.reportMonth,
            reportYear: input.reportYear,
            reportDate: input.reportDate ?? new Date(),
            competitorsCount: input.competitorsCount,
            activeAdvertisers: input.activeAdvertisers,
            totalActiveAds: input.totalActiveAds,
            htmlContent: input.htmlContent,
            metadata: input.metadata,
            generatedBy: input.generatedBy ?? 'system',
            llmModelUsed: input.llmModelUsed ?? 'anthropic/claude-sonnet-4-5',
            generationTimeSec: input.generationTimeSec ? String(input.generationTimeSec) : null,
        }).returning();
        // 2. Batch-insert all competitor rows
        if (input.competitors?.length && report) {
            const vals = input.competitors.map(c => ({
                reportId: report.id,
                competitorName: c.competitorName,
                facebookPageId: c.facebookPageId ?? null,
                facebookPageUrl: c.facebookPageUrl ?? null,
                totalActiveAds: c.totalActiveAds,
                healthScore: c.healthScore !== undefined && c.healthScore !== null ? String(c.healthScore) : null,
                budgetTier: c.budgetTier ?? null,
                threatLevel: c.threatLevel ?? null,
                isNewEntrant: c.isNewEntrant ?? false,
                isMarketLeader: c.isMarketLeader ?? false,
                newestAdDate: c.newestAdDate ?? null,
                adTypes: c.adTypes ?? [],
                targetSegments: c.targetSegments ?? [],
                keyUspEn: c.keyUspEn ?? null,
                marketingStrategyEn: c.marketingStrategyEn ?? null,
                pricingInfo: c.pricingInfo ?? null,
                languageSplit: c.languageSplit ?? null,
                estimatedAdSpend: c.estimatedAdSpend ?? null,
                competitorHtml: c.competitorHtml ?? null,
            }));
            await tx.insert(schema.reportCompetitors).values(vals);
        }
        return report;
    });
}
// ─── LIST ────────────────────────────────────────────────
/**
 * List reports with optional filters. Excludes htmlContent for performance.
 */
export async function listReports(filters = {}) {
    const conditions = [sql `${schema.reports.status} != 'deleted'`];
    if (filters.clientName) {
        conditions.push(eq(schema.reports.clientName, filters.clientName));
    }
    if (filters.status) {
        conditions.push(eq(schema.reports.status, filters.status));
    }
    if (filters.year) {
        conditions.push(eq(schema.reports.reportYear, filters.year));
    }
    if (filters.month) {
        conditions.push(eq(schema.reports.reportMonth, filters.month));
    }
    const rows = await db.select({
        id: schema.reports.id,
        reportUuid: schema.reports.reportUuid,
        title: schema.reports.title,
        clientName: schema.reports.clientName,
        reportMonth: schema.reports.reportMonth,
        reportYear: schema.reports.reportYear,
        reportDate: schema.reports.reportDate,
        competitorsCount: schema.reports.competitorsCount,
        activeAdvertisers: schema.reports.activeAdvertisers,
        totalActiveAds: schema.reports.totalActiveAds,
        status: schema.reports.status,
        createdAt: schema.reports.createdAt,
        marketStatus: sql `${schema.reports.metadata}->>'marketStatus'`,
        biggestOpportunity: sql `${schema.reports.metadata}->>'biggestOpportunity'`,
        biggestThreat: sql `${schema.reports.metadata}->>'biggestThreat'`,
    })
        .from(schema.reports)
        .where(and(...conditions))
        .orderBy(desc(schema.reports.reportDate))
        .limit(filters.limit ?? 50)
        .offset(filters.offset ?? 0);
    return rows;
}
// ─── GET ONE ─────────────────────────────────────────────
/**
 * Retrieve a full report by its UUID. Returns null if not found or soft-deleted.
 */
export async function getReportByUuid(uuid) {
    const [report] = await db
        .select()
        .from(schema.reports)
        .where(and(eq(schema.reports.reportUuid, uuid), sql `${schema.reports.status} != 'deleted'`))
        .limit(1);
    return report ?? null;
}
/**
 * Retrieve a full report by its numeric ID. Returns null if not found.
 */
export async function getReportById(id) {
    const [report] = await db
        .select()
        .from(schema.reports)
        .where(and(eq(schema.reports.id, id), sql `${schema.reports.status} != 'deleted'`))
        .limit(1);
    return report ?? null;
}
// ─── COMPETITORS ─────────────────────────────────────────
/**
 * Get all competitor snapshots for a given report ID.
 */
export async function getReportCompetitors(reportId) {
    const rows = await db
        .select()
        .from(schema.reportCompetitors)
        .where(eq(schema.reportCompetitors.reportId, reportId))
        .orderBy(desc(schema.reportCompetitors.totalActiveAds));
    return rows;
}
/**
 * Get competitor performance trend across the last N months.
 */
export async function getCompetitorTrend(name, months = 6) {
    const rows = await db
        .select({
        rc: schema.reportCompetitors,
        reportDate: schema.reports.reportDate,
        reportMonth: schema.reports.reportMonth,
        reportYear: schema.reports.reportYear,
    })
        .from(schema.reportCompetitors)
        .innerJoin(schema.reports, eq(schema.reportCompetitors.reportId, schema.reports.id))
        .where(and(ilike(schema.reportCompetitors.competitorName, name), eq(schema.reports.status, 'active')))
        .orderBy(desc(schema.reports.reportDate))
        .limit(months);
    return rows.map(r => ({
        ...r.rc,
        reportDate: r.reportDate,
        reportMonth: r.reportMonth,
        reportYear: r.reportYear,
    }));
}
// ─── STATUS CHANGES ──────────────────────────────────────
/**
 * Update the status of a report (active | archived | deleted).
 */
export async function updateStatus(id, status) {
    await db
        .update(schema.reports)
        .set({
        status,
        deletedAt: status === 'deleted' ? new Date() : null,
    })
        .where(eq(schema.reports.id, id));
}
export const softDeleteReport = (id) => updateStatus(id, 'deleted');
export const archiveReport = (id) => updateStatus(id, 'archived');
export const restoreReport = (id) => updateStatus(id, 'active');
/**
 * Permanently delete a report and all associated data (CASCADE).
 */
export async function hardDeleteReport(id) {
    await db.delete(schema.reports).where(eq(schema.reports.id, id));
}
// ─── ACCESS LOG ──────────────────────────────────────────
/**
 * Log an access event for audit purposes.
 */
export async function logAccess(reportId, reportUuid, type, accessedBy, ip) {
    await db.insert(schema.reportAccessLog).values({
        reportId,
        reportUuid,
        accessedBy: accessedBy ?? 'anonymous',
        accessType: type,
        ipAddress: ip ?? null,
    });
}
//# sourceMappingURL=dbService.js.map