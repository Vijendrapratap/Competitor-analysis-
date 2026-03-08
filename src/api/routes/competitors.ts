// =============================================================================
// Competitors Routes — CRUD for competitor management
// =============================================================================

import { Router } from 'express';
import {
    getCompetitors,
    getCompetitorById,
    insertCompetitor,
    updateCompetitor,
    deleteCompetitor,
    toggleCompetitorActive,
    getCompetitorAds,
    getLatestPageMetrics,
    getRecentPosts,
    getLatestAnalysis,
} from '../../db/queries.js';

export const competitorsRouter = Router();

// GET /api/competitors — list all competitors (?all=true includes inactive)
competitorsRouter.get('/', async (req, res, next) => {
    try {
        const competitors = await getCompetitors();
        res.json({ data: competitors });
    } catch (err) {
        next(err);
    }
});

// GET /api/competitors/:id — get single competitor with details
competitorsRouter.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id!, 10);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid competitor ID' });
            return;
        }

        const competitor = await getCompetitorById(id);
        if (!competitor) {
            res.status(404).json({ error: 'Competitor not found' });
            return;
        }

        const [ads, pageMetrics, posts, analysis] = await Promise.all([
            getCompetitorAds(id),
            getLatestPageMetrics(id),
            getRecentPosts(id),
            getLatestAnalysis(id),
        ]);

        res.json({
            data: {
                ...competitor,
                ads,
                pageMetrics,
                recentPosts: posts,
                latestAnalysis: analysis,
            },
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/competitors — add a new competitor
competitorsRouter.post('/', async (req, res, next) => {
    try {
        const { name, facebookPageId, facebookPageUrl, adsLibraryUrl, category, priceTier, isCustomer } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            return;
        }

        const id = await insertCompetitor({
            name,
            facebookPageId: facebookPageId || `temp_${Date.now()}`,
            facebookPageUrl: facebookPageUrl || '',
            adsLibraryUrl: adsLibraryUrl || '',
            category: category || 'hotel',
            priceTier: priceTier || 'mid-range',
            isCustomer: isCustomer ?? false,
            isActive: true,
        });

        res.status(201).json({ data: { id }, message: 'Competitor created' });
    } catch (err) {
        next(err);
    }
});

// PUT /api/competitors/:id — update a competitor
competitorsRouter.put('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id!, 10);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid competitor ID' });
            return;
        }

        const existing = await getCompetitorById(id);
        if (!existing) {
            res.status(404).json({ error: 'Competitor not found' });
            return;
        }

        const { name, facebookPageId, facebookPageUrl, adsLibraryUrl, category, priceTier, isCustomer, isActive } = req.body;

        await updateCompetitor(id, {
            ...(name !== undefined && { name }),
            ...(facebookPageId !== undefined && { facebookPageId }),
            ...(facebookPageUrl !== undefined && { facebookPageUrl }),
            ...(adsLibraryUrl !== undefined && { adsLibraryUrl }),
            ...(category !== undefined && { category }),
            ...(priceTier !== undefined && { priceTier }),
            ...(isCustomer !== undefined && { isCustomer }),
            ...(isActive !== undefined && { isActive }),
        });

        const updated = await getCompetitorById(id);
        res.json({ data: updated, message: 'Competitor updated' });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/competitors/:id — delete a competitor (cascades all data)
competitorsRouter.delete('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id!, 10);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid competitor ID' });
            return;
        }

        const existing = await getCompetitorById(id);
        if (!existing) {
            res.status(404).json({ error: 'Competitor not found' });
            return;
        }

        await deleteCompetitor(id);
        res.json({ message: `Competitor "${existing.name}" deleted` });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/competitors/:id/toggle — toggle active/inactive status
competitorsRouter.patch('/:id/toggle', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id!, 10);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid competitor ID' });
            return;
        }

        const newStatus = await toggleCompetitorActive(id);
        res.json({ data: { isActive: newStatus }, message: `Competitor ${newStatus ? 'activated' : 'deactivated'}` });
    } catch (err: any) {
        if (err.message?.includes('not found')) {
            res.status(404).json({ error: err.message });
        } else {
            next(err);
        }
    }
});
