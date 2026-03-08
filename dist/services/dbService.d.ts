import type { Report, ReportListItem, ReportCompetitor, CreateReportInput, ListReportsFilters } from '../types/index.js';
/**
 * Save a complete report + all competitor snapshots in a single transaction.
 */
export declare function saveReport(input: CreateReportInput): Promise<Report>;
/**
 * List reports with optional filters. Excludes htmlContent for performance.
 */
export declare function listReports(filters?: ListReportsFilters): Promise<ReportListItem[]>;
/**
 * Retrieve a full report by its UUID. Returns null if not found or soft-deleted.
 */
export declare function getReportByUuid(uuid: string): Promise<Report | null>;
/**
 * Retrieve a full report by its numeric ID. Returns null if not found.
 */
export declare function getReportById(id: number): Promise<Report | null>;
/**
 * Get all competitor snapshots for a given report ID.
 */
export declare function getReportCompetitors(reportId: number): Promise<ReportCompetitor[]>;
/**
 * Get competitor performance trend across the last N months.
 */
export declare function getCompetitorTrend(name: string, months?: number): Promise<(ReportCompetitor & {
    reportDate: Date;
    reportMonth: number;
    reportYear: number;
})[]>;
/**
 * Update the status of a report (active | archived | deleted).
 */
export declare function updateStatus(id: number, status: 'active' | 'archived' | 'deleted'): Promise<void>;
export declare const softDeleteReport: (id: number) => Promise<void>;
export declare const archiveReport: (id: number) => Promise<void>;
export declare const restoreReport: (id: number) => Promise<void>;
/**
 * Permanently delete a report and all associated data (CASCADE).
 */
export declare function hardDeleteReport(id: number): Promise<void>;
/**
 * Log an access event for audit purposes.
 */
export declare function logAccess(reportId: number, reportUuid: string, type: 'pdf_download' | 'pdf_view' | 'metadata', accessedBy?: string, ip?: string): Promise<void>;
//# sourceMappingURL=dbService.d.ts.map