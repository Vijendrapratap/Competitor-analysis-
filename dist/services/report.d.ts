export interface ReportOptions {
    dryRun?: boolean;
}
export interface ReportResult {
    pdfPath: string | null;
    htmlPath?: string;
    reportDate: string;
}
export declare class ReportService {
    run(opts?: ReportOptions): Promise<ReportResult>;
}
//# sourceMappingURL=report.d.ts.map