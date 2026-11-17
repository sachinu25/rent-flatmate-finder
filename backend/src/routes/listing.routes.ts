import type { Listing, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { Router } from 'express';

import { env } from '../config/env.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors/index.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { deleteImage, storeImages, type StoredImage } from '../lib/storage.js';
import { MAX_PHOTOS_PER_LISTING, MAX_PHOTOS_PER_UPLOAD, upload } from '../lib/upload.js';
import { authenticate, optionalAuth } from '../middleware/authenticate.js';
import { writeLimiter } from '../middleware/rateLimiter.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { batchGetScores, quickScore, type CompatibilityView } from '../services/compatibility.service.js';
import { createNotifications } from '../services/notification.service.js';
import {
  createListingSchema,
  listingQuerySchema,
  listingStatusSchema,
  updateListingSchema,
  type ListingQuery,
} from '../validators/listing.validators.js';

const listingRouter = Router();

const param = (req: Request, key: string) => req.params[key] as string;

/** Upper bound of listings ranked when sorting by compatibility. */
const MATCH_SORT_CAP = 300;

const ownerPublicSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const photoSelect = { id: true, url: true, altText: true, order: true } satisfies Prisma.ListingPhotoSelect;

async function loadOwnListing(req: Request) {
  const listing = await prisma.listing.findUnique({ where: { id: param(req, 'id') }, include: { photos: true } });
  if (!listing) throw new NotFoundError('Listing');
  if (listing.ownerId !== req.user!.id) throw new ForbiddenError('You can only manage your own listings');
  return listing;
}

function buildWhere(q: ListingQuery): Prisma.ListingWhereInput {
  const and: Prisma.ListingWhereInput[] = [];
  if (!q.includeFilled) and.push({ status: 'ACTIVE' });

  const city = q.city ?? q.location;
  if (city) and.push({ location: { contains: city, mode: 'insensitive' } });
  if (q.locality) and.push({ locality: { contains: q.locality, mode: 'insensitive' } });
  if (q.q) {
    and.push({
      OR: [
        { title: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
        { location: { contains: q.q, mode: 'insensitive' } },
        { locality: { contains: q.q, mode: 'insensitive' } },
        { address: { contains: q.q, mode: 'insensitive' } },
      ],
    });
  }
  if (q.minRent !== undefined || q.maxRent !== undefined) {
    and.push({ rent: { ...(q.minRent !== undefined && { gte: q.minRent }), ...(q.maxRent !== undefined && { lte: q.maxRent }) } });
  }
  if (q.roomType) and.push({ roomType: q.roomType });
  if (q.furnishingStatus) and.push({ furnishingStatus: q.furnishingStatus });
  if (q.genderPreference && q.genderPreference !== 'ANY') {
    and.push({ genderPreference: { in: [q.genderPreference, 'ANY'] } });
  }
  if (q.amenities?.length) and.push({ amenities: { hasEvery: q.amenities } });
  if (q.availableBy) and.push({ availableFrom: { lte: q.availableBy } });
  return { AND: and };
}

function orderFor(sort: ListingQuery['sort']): Prisma.ListingOrderByWithRelationInput[] {
  switch (sort) {
    case 'rent_asc':
      return [{ rent: 'asc' }, { createdAt: 'desc' }];
    case 'rent_desc':
      return [{ rent: 'desc' }, { createdAt: 'desc' }];
    case 'available_soonest':
      return [{ availableFrom: 'asc' }, { createdAt: 'desc' }];
    default:
      return [{ createdAt: 'desc' }, { id: 'asc' }];
  }
}

async function savedIdsFor(userId: string | undefined, listingIds: string[]) {
  if (!userId || listingIds.length === 0) return new Set<string>();
  const rows = await prisma.savedListing.findMany({
    where: { userId, listingId: { in: listingIds } },
    select: { listingId: true },
  });
  return new Set(rows.map((r) => r.listingId));
}

/** Tenants whose stated preferences plausibly fit a listing (cheap pre-filter). */
async function candidateProfiles(listing: Listing, take = 100) {
  const places = [listing.location, listing.locality].filter((p): p is string => Boolean(p));
  return prisma.tenantProfile.findMany({
    where: {
      user: { isActive: true, role: 'TENANT' },
      budgetMax: { gte: Math.floor(listing.rent * 0.8) },
      OR: places.map((p) => ({ preferredLocation: { contains: p.split(/[ ,]/)[0] ?? p, mode: 'insensitive' as const } })),
    },
    include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    take,
    orderBy: { updatedAt: 'desc' },
  });
}

/** Fire-and-forget: tell strongly matching tenants about a new listing. */
async function notifyNewMatches(listing: Listing) {
  try {
    const profiles = await candidateProfiles(listing, 200);
    const matches = profiles
      .map((p) => ({ p, s: quickScore(listing, p).score }))
      .filter((m) => m.s >= env.HIGH_SCORE_THRESHOLD)
      .slice(0, 50);
    await createNotifications(
      matches.map(({ p, s }) => ({
        userId: p.userId,
        type: 'NEW_MATCH' as const,
        title: 'New listing that matches you',
        message: `“${listing.title}” in ${listing.location} scores ${s}/100 on your preferences.`,
        metadata: { listingId: listing.id, score: s },
      })),
    );
  } catch (err) {
    logger.warn({ err, listingId: listing.id }, 'New-match notification failed');
  }
}

/** Tenants who saved or asked about a listing — notified about meaningful updates. */
async function interestedTenantIds(listingId: string, statuses: ('PENDING' | 'ACCEPTED')[] = ['PENDING', 'ACCEPTED']) {
  const [saved, interests] = await Promise.all([
    prisma.savedListing.findMany({ where: { listingId }, select: { userId: true } }),
    prisma.interestRequest.findMany({ where: { listingId, status: { in: statuses } }, select: { tenantId: true } }),
  ]);
  return [...new Set([...saved.map((s) => s.userId), ...interests.map((i) => i.tenantId)])];
}

// ── GET /listings — browse with filters, sort, pagination, optional scores ──
listingRouter.get('/', optionalAuth, validateQuery(listingQuerySchema), async (req, res, next) => {
  try {
    const q = res.locals['query'] as ListingQuery;
    const where = buildWhere(q);

    const user = req.user;
    const profile =
      user?.role === 'TENANT' ? await prisma.tenantProfile.findUnique({ where: { userId: user.id } }) : null;
    const include = {
      photos: { orderBy: { order: 'asc' as const }, select: photoSelect, take: 5 },
      owner: { select: ownerPublicSelect },
    };

    let listings;
    let total: number;
    let scores = new Map<string, CompatibilityView>();

    if (q.sort === 'match' && profile) {
      // Rank the whole filtered set (capped) so "best match" is correct across
      // pages. Rule-based scoring is pure CPU — no AI calls are made here.
      const pool = await prisma.listing.findMany({ where, include, orderBy: orderFor('newest'), take: MATCH_SORT_CAP });
      scores = await batchGetScores(user!.id, pool, profile);
      pool.sort((a, b) => (scores.get(b.id)?.score ?? -1) - (scores.get(a.id)?.score ?? -1));
      total = Math.min(await prisma.listing.count({ where }), MATCH_SORT_CAP);
      listings = pool.slice((q.page - 1) * q.limit, q.page * q.limit);
    } else {
      [listings, total] = await Promise.all([
        prisma.listing.findMany({
          where,
          include,
          orderBy: orderFor(q.sort),
          skip: (q.page - 1) * q.limit,
          take: q.limit,
        }),
        prisma.listing.count({ where }),
      ]);
      if (profile) scores = await batchGetScores(user!.id, listings, profile);
    }

    const saved = await savedIdsFor(user?.id, listings.map((l) => l.id));
    const items = listings.map((l) => {
      const c = scores.get(l.id);
      return {
        ...l,
        isSaved: saved.has(l.id),
        compatibility: c ? { score: c.score, explanation: c.explanation, computedVia: c.computedVia } : null,
      };
    });

    res.json({
      status: 'success',
      data: {
        listings: items,
        pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
        scored: Boolean(profile),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /listings/featured — newest active listings with photos (public) ────
listingRouter.get('/featured', async (_req, res, next) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { status: 'ACTIVE', photos: { some: {} } },
      include: { photos: { orderBy: { order: 'asc' }, select: photoSelect, take: 3 }, owner: { select: ownerPublicSelect } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.json({ status: 'success', data: { listings } });
  } catch (err) {
    next(err);
  }
});

// ── GET /listings/cities — cities with active listings (for search UI) ──────
listingRouter.get('/cities', async (_req, res, next) => {
  try {
    const rows = await prisma.listing.groupBy({
      by: ['location'],
      where: { status: 'ACTIVE' },
      _count: { _all: true },
      orderBy: { _count: { location: 'desc' } },
      take: 30,
    });
    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.json({ status: 'success', data: { cities: rows.map((r) => ({ city: r.location, count: r._count._all })) } });
  } catch (err) {
    next(err);
  }
});

// ── GET /listings/mine — owner's listings with engagement counts ────────────
listingRouter.get('/mine', authenticate, requireRole('OWNER'), async (req, res, next) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { ownerId: req.user!.id },
      include: {
        photos: { orderBy: { order: 'asc' }, select: photoSelect },
        _count: { select: { interestRequests: true, savedBy: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const pending = await prisma.interestRequest.groupBy({
      by: ['listingId'],
      where: { listing: { ownerId: req.user!.id }, status: 'PENDING' },
      _count: { _all: true },
    });
    const pendingBy = new Map(pending.map((p) => [p.listingId, p._count._all]));
    res.json({
      status: 'success',
      data: { listings: listings.map((l) => ({ ...l, pendingInterests: pendingBy.get(l.id) ?? 0 })) },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /listings/:id — single listing ──────────────────────────────────────
listingRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: param(req, 'id') },
      include: {
        photos: { orderBy: { order: 'asc' }, select: photoSelect },
        owner: { select: ownerPublicSelect },
      },
    });
    if (!listing) throw new NotFoundError('Listing');

    const user = req.user;
    const isOwner = user?.id === listing.ownerId;

    let viewer: Record<string, unknown> | null = null;
    if (user) {
      const [savedRow, interest, profile] = await Promise.all([
        prisma.savedListing.findUnique({ where: { userId_listingId: { userId: user.id, listingId: listing.id } } }),
        user.role === 'TENANT'
          ? prisma.interestRequest.findUnique({
              where: { tenantId_listingId: { tenantId: user.id, listingId: listing.id } },
              select: { id: true, status: true, createdAt: true, conversation: { select: { id: true } } },
            })
          : null,
        user.role === 'TENANT' ? prisma.tenantProfile.findUnique({ where: { userId: user.id } }) : null,
      ]);
      const scores = profile ? await batchGetScores(user.id, [listing], profile) : null;
      viewer = {
        isOwner,
        isSaved: Boolean(savedRow),
        hasProfile: Boolean(profile),
        interest: interest
          ? { id: interest.id, status: interest.status, createdAt: interest.createdAt, conversationId: interest.conversation?.id ?? null }
          : null,
        compatibility: scores?.get(listing.id) ?? null,
      };
    }

    res.json({ status: 'success', data: { listing, viewer } });
  } catch (err) {
    next(err);
  }
});

// ── POST /listings/:id/view — record a detail-page view ─────────────────────
// Called once per browser session by the listing page. Owners viewing their
// own listing are not counted. Rate-limited by the global API limiter.
listingRouter.post('/:id/view', optionalAuth, async (req, res, next) => {
  try {
    const result = await prisma.listing.updateMany({
      where: { id: param(req, 'id'), ...(req.user && { ownerId: { not: req.user.id } }) },
      data: { viewCount: { increment: 1 } },
    });
    res.json({ status: 'success', data: { counted: result.count > 0 } });
  } catch (err) {
    next(err);
  }
});

// ── POST /listings — create (OWNER) ─────────────────────────────────────────
listingRouter.post(
  '/',
  authenticate,
  requireRole('OWNER'),
  writeLimiter,
  upload.array('photos', MAX_PHOTOS_PER_UPLOAD),
  validate(createListingSchema),
  async (req, res, next) => {
    let stored: StoredImage[] = [];
    try {
      const data = req.body as Prisma.ListingUncheckedCreateInput;
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      stored = await storeImages(files);

      const listing = await prisma.listing.create({
        data: {
          ...data,
          ownerId: req.user!.id,
          photos: stored.length
            ? { create: stored.map((s, i) => ({ url: s.url, publicId: s.publicId, order: i, altText: `${data.title} — photo ${i + 1}` })) }
            : undefined,
        },
        include: { photos: { orderBy: { order: 'asc' }, select: photoSelect } },
      });

      void notifyNewMatches(listing);
      res.status(201).json({ status: 'success', data: { listing } });
    } catch (err) {
      // Roll back uploaded images if the DB write failed.
      await Promise.all(stored.map((s) => deleteImage(s.publicId)));
      next(err);
    }
  },
);

// ── PUT /listings/:id — update (OWNER, own only) ────────────────────────────
listingRouter.put(
  '/:id',
  authenticate,
  requireRole('OWNER'),
  writeLimiter,
  upload.array('photos', MAX_PHOTOS_PER_UPLOAD),
  validate(updateListingSchema),
  async (req, res, next) => {
    let stored: StoredImage[] = [];
    try {
      const existing = await loadOwnListing(req);
      const { photoOrder, ...data } = req.body as Prisma.ListingUpdateInput & { photoOrder?: string[] };
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];

      if (existing.photos.length + files.length > MAX_PHOTOS_PER_LISTING) {
        throw new ValidationError(`A listing can have at most ${MAX_PHOTOS_PER_LISTING} photos`, {
          photos: [`Remove some photos first (currently ${existing.photos.length})`],
        });
      }
      stored = await storeImages(files);

      const ops: Prisma.PrismaPromise<unknown>[] = [];
      if (photoOrder?.length) {
        const ids = new Set(existing.photos.map((p) => p.id));
        photoOrder
          .filter((id) => ids.has(id))
          .forEach((id, idx) => ops.push(prisma.listingPhoto.update({ where: { id }, data: { order: idx } })));
      }
      const startOrder = Math.max(-1, ...existing.photos.map((p) => p.order)) + 1;
      if (stored.length) {
        ops.push(
          prisma.listingPhoto.createMany({
            data: stored.map((s, i) => ({ listingId: existing.id, url: s.url, publicId: s.publicId, order: startOrder + i })),
          }),
        );
      }
      ops.push(prisma.listing.update({ where: { id: existing.id }, data }));
      await prisma.$transaction(ops);

      const listing = await prisma.listing.findUniqueOrThrow({
        where: { id: existing.id },
        include: { photos: { orderBy: { order: 'asc' }, select: photoSelect } },
      });

      // Notify interested tenants about changes that matter to them.
      const changes: string[] = [];
      if (listing.rent !== existing.rent) changes.push(`rent is now ₹${listing.rent.toLocaleString('en-IN')}`);
      if (listing.availableFrom.getTime() !== existing.availableFrom.getTime()) {
        changes.push(`available from ${listing.availableFrom.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`);
      }
      if (changes.length) {
        void interestedTenantIds(listing.id).then((ids) =>
          createNotifications(
            ids.map((userId) => ({
              userId,
              type: 'LISTING_UPDATED' as const,
              title: 'A listing you follow was updated',
              message: `“${listing.title}”: ${changes.join(', ')}.`,
              metadata: { listingId: listing.id },
            })),
          ),
        );
      }

      res.json({ status: 'success', data: { listing } });
    } catch (err) {
      await Promise.all(stored.map((s) => deleteImage(s.publicId)));
      next(err);
    }
  },
);

// ── PATCH /listings/:id/status — mark FILLED / ACTIVE ───────────────────────
listingRouter.patch('/:id/status', authenticate, requireRole('OWNER'), validate(listingStatusSchema), async (req, res, next) => {
  try {
    const existing = await loadOwnListing(req);
    const { status } = req.body as { status: 'ACTIVE' | 'FILLED' };

    const listing = await prisma.listing.update({
      where: { id: existing.id },
      data: { status },
      include: { photos: { orderBy: { order: 'asc' }, select: photoSelect } },
    });

    if (status === 'FILLED' && existing.status !== 'FILLED') {
      void interestedTenantIds(listing.id, ['PENDING']).then((ids) =>
        createNotifications(
          ids.map((userId) => ({
            userId,
            type: 'LISTING_FILLED' as const,
            title: 'Listing no longer available',
            message: `“${listing.title}” has been marked as filled.`,
            metadata: { listingId: listing.id },
          })),
        ),
      );
    }
    res.json({ status: 'success', data: { listing } });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /listings/:id ────────────────────────────────────────────────────
listingRouter.delete('/:id', authenticate, requireRole('OWNER'), async (req, res, next) => {
  try {
    const existing = await loadOwnListing(req);
    await prisma.listing.delete({ where: { id: existing.id } });
    void Promise.all(existing.photos.map((p) => deleteImage(p.publicId)));
    res.json({ status: 'success', data: { message: 'Listing deleted' } });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /listings/:id/photos/:photoId ────────────────────────────────────
listingRouter.delete('/:id/photos/:photoId', authenticate, requireRole('OWNER'), async (req, res, next) => {
  try {
    const listing = await loadOwnListing(req);
    const photo = listing.photos.find((p) => p.id === param(req, 'photoId'));
    if (!photo) throw new NotFoundError('Photo');
    await prisma.listingPhoto.delete({ where: { id: photo.id } });
    void deleteImage(photo.publicId);
    res.json({ status: 'success', data: { message: 'Photo deleted' } });
  } catch (err) {
    next(err);
  }
});

// ── GET /listings/:id/candidates — potential tenants (OWNER, rule-based) ────
listingRouter.get('/:id/candidates', authenticate, requireRole('OWNER'), async (req, res, next) => {
  try {
    const listing = await loadOwnListing(req);
    const profiles = await candidateProfiles(listing);
    const ranked = profiles
      .map((p) => {
        const r = quickScore(listing, p);
        return {
          // Privacy: first name + initial only; no contact details.
          tenant: { id: p.user.id, name: `${p.user.firstName} ${p.user.lastName.charAt(0)}.`, avatarUrl: p.user.avatarUrl },
          occupation: p.occupation,
          budgetMin: p.budgetMin,
          budgetMax: p.budgetMax,
          moveInDate: p.moveInDate,
          score: r.score,
          highlights: r.factors?.positives.slice(0, 3) ?? [],
          conflicts: r.factors?.conflicts.slice(0, 2) ?? [],
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    res.json({ status: 'success', data: { candidates: ranked, method: 'rule-based' } });
  } catch (err) {
    next(err);
  }
});

export { listingRouter };
