// =============================================================================
// Health Routes — system health, market overview, leaderboard
// =============================================================================
import { Router } from 'express';
import { getMarketOverview, getHealthLeaderboard, getShareOfVoice, getRecentTrends, } from '../../db/queries.js';
import reportPool from '../../db/client.js';
export const healthRouter = Router();
// GET /api/health — system health check (with DB connectivity)
healthRouter.get('/', async (_req, res) => {
    try {
        const result = await reportPool.query('SELECT NOW() as now');
        res.json({
            status: 'ok',
            db: 'connected',
            dbTime: result.rows[0]?.now,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    }
    catch {
        res.status(503).json({
            status: 'error',
            db: 'disconnected',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    }
});
// GET /api/health/market — market overview (aggregated stats)
healthRouter.get('/market', async (_req, res) => {
    try {
        const overview = await getMarketOverview();
        res.json({ data: overview });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch market overview' });
    }
});
// GET /api/health/leaderboard — competitor health score rankings
healthRouter.get('/leaderboard', async (_req, res) => {
    try {
        const leaderboard = await getHealthLeaderboard();
        res.json({ data: leaderboard });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});
// GET /api/health/sov — share of voice data
healthRouter.get('/sov', async (_req, res) => {
    try {
        const sov = await getShareOfVoice();
        res.json({ data: sov });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch share of voice' });
    }
});
// GET /api/health/trends — recent Google Trends data
healthRouter.get('/trends', async (req, res) => {
    try {
        const days = parseInt(req.query['days'], 10) || 30;
        const trends = await getRecentTrends(days);
        res.json({ data: trends });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch trends' });
    }
});
//# sourceMappingURL=health.js.map