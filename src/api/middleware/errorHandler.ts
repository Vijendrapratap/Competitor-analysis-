// =============================================================================
// Global Error Handler Middleware
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('error-handler');

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction,
): void {
    log.error(`${req.method} ${req.path} — ${err.message}`, {
        stack: err.stack,
    });
    res.status(500).json({
        success: false,
        error: err.message,
        stack: err.stack,
    });
}
