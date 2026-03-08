export declare function generatePieChartSvg(active: number, inactive: number, width?: number, height?: number): string;
export declare function generateBarChartSvg(heavy: number, moderate: number, light: number, none: number, width?: number, height?: number): string;
export declare function generateStrategyChartSvg(strategies: Array<{
    name: string;
    count: number;
}>, width?: number, height?: number): string;
/**
 * Generate HTML for the executive summary (pages 1–3).
 */
export declare function generateExecutiveSummary(reportData: any): string;
//# sourceMappingURL=executiveSummaryGenerator.d.ts.map