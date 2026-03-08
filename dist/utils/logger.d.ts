import winston from 'winston';
export declare const logger: winston.Logger;
export declare function createLogger(context: string): winston.Logger;
export declare function logStageStart(stage: string): void;
export declare function logStageEnd(stage: string, durationMs: number): void;
export declare function logStageError(stage: string, err: unknown): void;
//# sourceMappingURL=logger.d.ts.map