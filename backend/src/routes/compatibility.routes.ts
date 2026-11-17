import type { Request } from 'express';
import { Router } from 'express';

import { NotFoundError, ValidationError } from '../errors/index.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { requireRole } from '../middleware/requireRole.js';
import { analyzeCompatibility, batchGetScores } from '../services/compatibility.service.js';
import { aiModelName, isAIConfigured } from '../services/llm.service.js';

const compatibilityRouter = Router();
const param = (req: Request, key: string) => req.params[key] as string;

compatibilityRouter.use(authenticate, requireRole('TENANT'));

async function requireProfile(userId: string) {
  const profile = await prisma.tenantProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new ValidationError('Complete your tenant profile to see compatibility scores', {
      profile: ['Profile required'],
    });
  }
  return profile;
}

// ── GET /compatibility/status — is AI analysis available? ───────────────────
compatibilityRouter.get('/status', (_req, res) => {
  res.json({ status: 'success', data: { aiAvailable: isAIConfigured(), model: isAIConfigured() ? aiModelName() : null } });
});

// ── GET /compatibility/matches — top active listings for this tenant ────────
compatibilityRouter.get('/matches', async (req, res, next) => {
  try {
    const profile = await requireProfile(req.user!.id);
    const firstWord = profile.preferredLocation.split(/[ ,]/)[0] ?? profile.preferredLocation;

    // Candidate pool: active listings in/near the preferred location and roughly in budget.
    const pool = await prisma.listing.findMany({
      where: {
        status: 'ACTIVE',
        rent: { lte: Math.ceil(profile.budgetMax * 1.25) },
        OR: [
          { location: { contains: firstWord, mode: 'insensitive' } },
          { locality: { contains: firstWord, mode: 'insensitive' } },
        ],
      },
      include: {
        photos: { orderBy: { order: 'asc' }, take: 3, select: { id: true, url: true, altText: true, order: true } },
        owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    const scores = await batchGetScores(req.user!.id, pool, profile);
    const saved = await prisma.savedListing.findMany({
      where: { userId: req.user!.id, listingId: { in: pool.map((l) => l.id) } },
      select: { listingId: true },
    });
    const savedSet = new Set(saved.map((s) => s.listingId));

    const matches = pool
      .map((l) => ({ ...l, isSaved: savedSet.has(l.id), compatibility: scores.get(l.id) ?? null }))
      .sort((a, b) => (b.compatibility?.score ?? 0) - (a.compatibility?.score ?? 0))
      .slice(0, 20);

    res.json({ status: 'success', data: { matches, aiAvailable: isAIConfigured() } });
  } catch (err) {
    next(err);
  }
});

// ── GET /compatibility/:listingId — cached / rule-based score (no AI call) ──
compatibilityRouter.get('/:listingId', async (req, res, next) => {
  try {
    const profile = await requireProfile(req.user!.id);
    const listing = await prisma.listing.findUnique({ where: { id: param(req, 'listingId') } });
    if (!listing) throw new NotFoundError('Listing');
    const scores = await batchGetScores(req.user!.id, [listing], profile);
    res.json({ status: 'success', data: { compatibility: scores.get(listing.id) ?? null, aiAvailable: isAIConfigured() } });
  } catch (err) {
    next(err);
  }
});

// ── POST /compatibility/:listingId/analyze — AI analysis (rate-limited) ─────
compatibilityRouter.post('/:listingId/analyze', aiLimiter, async (req, res, next) => {
  try {
    const profile = await requireProfile(req.user!.id);
    const listing = await prisma.listing.findUnique({ where: { id: param(req, 'listingId') } });
    if (!listing) throw new NotFoundError('Listing');

    const { view, aiUsed, aiAvailable } = await analyzeCompatibility(req.user!.id, listing, profile);
    res.json({ status: 'success', data: { compatibility: view, aiUsed, aiAvailable } });
  } catch (err) {
    next(err);
  }
});

export { compatibilityRouter };
