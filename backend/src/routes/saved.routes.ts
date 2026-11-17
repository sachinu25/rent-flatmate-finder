import type { Request } from 'express';
import { Router } from 'express';

import { NotFoundError } from '../errors/index.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';

/** Wishlist — available to every signed-in user. */
const savedRouter = Router();
const param = (req: Request, key: string) => req.params[key] as string;

savedRouter.use(authenticate);

// GET /saved — saved listings, newest first
savedRouter.get('/', async (req, res, next) => {
  try {
    const rows = await prisma.savedListing.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        listing: {
          include: {
            photos: { orderBy: { order: 'asc' }, take: 3, select: { id: true, url: true, altText: true, order: true } },
            owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
    res.json({
      status: 'success',
      data: { listings: rows.map((r) => ({ ...r.listing, isSaved: true, savedAt: r.createdAt })) },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /saved/:listingId — idempotent save
savedRouter.put('/:listingId', async (req, res, next) => {
  try {
    const listingId = param(req, 'listingId');
    const exists = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true } });
    if (!exists) throw new NotFoundError('Listing');
    await prisma.savedListing.upsert({
      where: { userId_listingId: { userId: req.user!.id, listingId } },
      create: { userId: req.user!.id, listingId },
      update: {},
    });
    res.json({ status: 'success', data: { saved: true } });
  } catch (err) {
    next(err);
  }
});

// DELETE /saved/:listingId — idempotent unsave
savedRouter.delete('/:listingId', async (req, res, next) => {
  try {
    await prisma.savedListing.deleteMany({ where: { userId: req.user!.id, listingId: param(req, 'listingId') } });
    res.json({ status: 'success', data: { saved: false } });
  } catch (err) {
    next(err);
  }
});

export { savedRouter };
