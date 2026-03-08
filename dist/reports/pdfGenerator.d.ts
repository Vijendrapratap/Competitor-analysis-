import type { ReportData } from '../types/index.js';
export declare class PDFReportGenerator {
    private templates;
    private chartGen;
    constructor();
    private ensureTemplates;
    generateHtml(data: ReportData): Promise<string>;
    generatePdf(data: ReportData): Promise<{
        pdfPath: string;
        htmlPath: string;
    }>;
    generate(data: ReportData): Promise<ReportData>;
}
export declare const pdfGenerator: PDFReportGenerator;
//# sourceMappingURL=pdfGenerator.d.ts.map