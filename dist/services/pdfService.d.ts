/**
 * Convert full report HTML to a PDF Buffer.
 */
export declare function htmlToPdfBuffer(htmlContent: string): Promise<Buffer>;
/**
 * Single competitor page → standalone PDF.
 */
export declare function competitorToPdfBuffer(competitorHtml: string, reportTitle: string): Promise<Buffer>;
/**
 * Cleanup — call on graceful server shutdown.
 */
export declare function closeBrowser(): Promise<void>;
//# sourceMappingURL=pdfService.d.ts.map