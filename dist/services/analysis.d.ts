export interface AnalysisOptions {
    competitorIds?: number[];
    dryRun?: boolean;
    force?: boolean;
}
export interface AnalysisResult {
    competitorsAnalyzed: number;
    healthScoresCalculated: number;
    strategiesClassified: number;
    alertsGenerated: number;
    recommendationsGenerated: number;
    errors: string[];
}
export declare class AnalysisService {
    /**
     * Run all analysis engines for all (or filtered) competitors.
     */
    run(opts?: AnalysisOptions): Promise<AnalysisResult>;
}
//# sourceMappingURL=analysis.d.ts.map