import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

/**
 * GET /stats/public — live platform counts for the landing page.
 * Real database counts only; the frontend hides the section when they are zero.
 */
const statsRouter = Router();

statsRouter.get('/public', async (_req, res, next) => {
  try {
    const [activeListings, cities, acceptedMatches] = await Promise.all([
      prisma.listing.count({ where: { status: 'ACTIVE' } }),
      prisma.listing.groupBy({ by: ['location'], where: { status: 'ACTIVE' } }).then((r) => r.length),
      prisma.interestRequest.count({ where: { status: 'ACCEPTED' } }),
    ]);
    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.json({ status: 'success', data: { activeListings, cities, acceptedMatches } });
  } catch (err) {
    next(err);
  }
});

export { statsRouter };
