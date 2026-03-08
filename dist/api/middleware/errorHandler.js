// =============================================================================
// Global Error Handler Middleware
// =============================================================================
import { createLogger } from '../../utils/logger.js';
const log = createLogger('error-handler');
export function errorHandler(err, req, res, _next) {
    log.error(`${req.method} ${req.path} — ${err.message}`, {
        stack: err.stack,
    });
    res.status(500).json({
        success: false,
        error: process.env['NODE_ENV'] === 'production'
            ? 'Internal server error'
            : err.message,
    });
}
//# sourceMappingURL=errorHandler.js.map