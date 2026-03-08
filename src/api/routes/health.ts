// =============================================================================
// Health Routes — system health, market overview, leaderboard
// =============================================================================

import { Router } from 'express';
import {
    getMarketOverview,
    getHealthLeaderboard,
    getShareOfVoice,
    getRecentTrends,
} from '../../db/queries.js';
import reportPool from '../../db/client.js';

export const healthRouter = Router();

// GET /api/health — system health check (with DB connectivity)
healthRouter.get('/', async (_req, res) => {
    try {
        const result = await reportPool.query<{ now: Date }>('SELECT NOW() as now');
        res.json({
            status: 'ok',
            db: 'connected',
            dbTime: result.rows[0]?.now,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    } catch {
        res.status(503).json({
            status: 'error',
            db: 'disconnected',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    }
});


healthRouter.get('/market', async (_req, res, next) => {
    try {
        const overview = await getMarketOverview();
        res.json({ data: overview });
    } catch (err) {
        next(err);
    }
});

healthRouter.get('/leaderboard', async (_req, res, next) => {
    try {
        const leaderboard = await getHealthLeaderboard();
        res.json({ data: leaderboard });
    } catch (err) {
        next(err);
    }
});

healthRouter.get('/sov', async (_req, res, next) => {
    try {
        const sov = await getShareOfVoice();
        res.json({ data: sov });
    } catch (err) {
        next(err);
    }
});

healthRouter.get('/trends', async (req, res, next) => {
    try {
        const days = parseInt(req.query['days'] as string, 10) || 30;
        const trends = await getRecentTrends(days);
        res.json({ data: trends });
    } catch (err) {
        next(err);
    }
});
