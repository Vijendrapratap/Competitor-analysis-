// =============================================================================
// Apify Configuration — validates and exports APIFY_* env vars
//
// Reads on startup and throws a clear user-facing error if the required
// APIFY_API_TOKEN is missing. All other vars have sensible defaults.
// =============================================================================

import { createLogger } from '../utils/logger.js';

const log = createLogger('ApifyConfig');

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
    maxItemsPerRun: 50,
    timeoutSeconds: 280,
    memoryMb: 512,
};

// ─────────────────────────────────────────────────────────────────────────────
// Build config
// ─────────────────────────────────────────────────────────────────────────────

function buildApifyConfig() {
    const token = process.env.APIFY_API_TOKEN ?? '';

    if (!token || token.startsWith('apify_api_xxxx')) {
        const msg =
            'APIFY_API_TOKEN is missing or invalid. ' +
            'Get your token at https://console.apify.com/settings/integrations';

        log.error(msg);

        // We don't throw immediately — modules that import this config should
        // check `apifyConfig.isValid` before calling Apify.
        return {
            isValid: false,
            token: '',
            maxItemsPerRun: DEFAULTS.maxItemsPerRun,
            timeoutSeconds: DEFAULTS.timeoutSeconds,
            memoryMb: DEFAULTS.memoryMb,
            validationError: msg,
        };
    }

    const maxItemsPerRun = parseInt(process.env.APIFY_MAX_ITEMS_PER_RUN, 10) || DEFAULTS.maxItemsPerRun;
    const timeoutSeconds = parseInt(process.env.APIFY_TIMEOUT_SECONDS, 10) || DEFAULTS.timeoutSeconds;
    const memoryMb = parseInt(process.env.APIFY_MEMORY_MB, 10) || DEFAULTS.memoryMb;

    log.info('Apify config loaded', { maxItemsPerRun, timeoutSeconds, memoryMb });

    return {
        isValid: true,
        token,
        maxItemsPerRun,
        timeoutSeconds,
        memoryMb,
        validationError: null,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported singleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @type {{
 *   isValid: boolean,
 *   token: string,
 *   maxItemsPerRun: number,
 *   timeoutSeconds: number,
 *   memoryMb: number,
 *   validationError: string | null,
 * }}
 */
export const apifyConfig = buildApifyConfig();

/**
 * Call this at startup to validate the Apify config.
 * Throws with a user-friendly message if the token is invalid.
 */
export function validateApifyConfig() {
    if (!apifyConfig.isValid) {
        throw new Error(apifyConfig.validationError);
    }
    return apifyConfig;
}
