// =============================================================================
// Alerts Routes — list, filter, and acknowledge alerts
// =============================================================================
import { Router } from 'express';
import { getTodayAlerts, getUnsentAlerts, markAlertSent, } from '../../db/queries.js';
export const alertsRouter = Router();
// GET /api/alerts — list today's alerts
alertsRouter.get('/', async (req, res) => {
    try {
        const filter = req.query['filter'];
        let alerts = await getTodayAlerts();
        if (filter === 'unsent') {
            alerts = await getUnsentAlerts();
        }
        else if (filter === 'critical') {
            alerts = alerts.filter((a) => a.severity === 'critical');
        }
        res.json({ data: alerts, total: alerts.length });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});
// POST /api/alerts/:id/acknowledge — mark an alert as sent/acknowledged
alertsRouter.post('/:id/acknowledge', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid alert ID' });
            return;
        }
        await markAlertSent(id);
        res.json({ message: 'Alert acknowledged' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
});
//# sourceMappingURL=alerts.js.map