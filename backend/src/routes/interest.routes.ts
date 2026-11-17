import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { Router } from 'express';

import { env } from '../config/env.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/index.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { writeLimiter } from '../middleware/rateLimiter.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  sendHighScoreInterestEmail,
  sendInterestDecisionEmail,
  sendInterestReceivedEmail,
} from '../services/email.service.js';
import { createNotification } from '../services/notification.service.js';
import { expressInterestSchema, resolveInterestSchema } from '../validators/interest.validators.js';

const interestRouter = Router();
const param = (req: Request, key: string) => req.params[key] as string;

// ── POST /interests — tenant expresses interest ─────────────────────────────
interestRouter.post('/', authenticate, requireRole('TENANT'), writeLimiter, validate(expressInterestSchema), async (req, res, next) => {
  try {
    const { listingId, message } = req.body as { listingId: string; message?: string };
    const tenant = req.user!;

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { owner: { select: { id: true, email: true, isActive: true } } },
    });
    if (!listing) throw new NotFoundError('Listing');
    if (listing.status !== 'ACTIVE') throw new ConflictError('This listing is no longer accepting requests');
    if (!listing.owner.isActive) throw new ConflictError('This listing is not available');

    let interest;
    try {
      interest = await prisma.interestRequest.create({
        data: { tenantId: tenant.id, listingId, message },
        include: { listing: { select: { id: true, title: true, location: true, rent: true, status: true } } },
      });
    } catch (err) {
      // Unique (tenant, listing) — also covers double-clicks racing each other.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('You have already sent a request for this listing');
      }
      throw err;
    }

    const tenantName = `${tenant.firstName} ${tenant.lastName}`;
    void createNotification({
      userId: listing.ownerId,
      type: 'INTEREST_RECEIVED',
      title: 'New interest request',
      message: `${tenantName} is interested in “${listing.title}”.`,
      metadata: { interestRequestId: interest.id, listingId },
    });

    const score = await prisma.compatibilityScore.findUnique({
      where: { tenantId_listingId: { tenantId: tenant.id, listingId } },
      select: { score: true },
    });
    if (score && score.score >= env.HIGH_SCORE_THRESHOLD) {
      sendHighScoreInterestEmail(listing.owner.email, tenantName, listing.title, score.score);
    } else {
      sendInterestReceivedEmail(listing.owner.email, tenantName, listing.title);
    }

    res.status(201).json({ status: 'success', data: { interest } });
  } catch (err) {
    next(err);
  }
});

// ── GET /interests/mine — tenant's sent requests ────────────────────────────
interestRouter.get('/mine', authenticate, requireRole('TENANT'), async (req, res, next) => {
  try {
    const interests = await prisma.interestRequest.findMany({
      where: { tenantId: req.user!.id },
      include: {
        listing: {
          select: {
            id: true, title: true, location: true, locality: true, rent: true, status: true,
            photos: { orderBy: { order: 'asc' }, take: 1, select: { url: true } },
            owner: { select: { firstName: true, lastName: true } },
          },
        },
        conversation: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: { interests } });
  } catch (err) {
    next(err);
  }
});

// ── GET /interests/received — owner's incoming requests ─────────────────────
interestRouter.get('/received', authenticate, requireRole('OWNER'), async (req, res, next) => {
  try {
    const interests = await prisma.interestRequest.findMany({
      where: { listing: { ownerId: req.user!.id } },
      include: {
        tenant: {
          select: {
            id: true, firstName: true, lastName: true, avatarUrl: true,
            tenantProfile: { select: { occupation: true, moveInDate: true, budgetMin: true, budgetMax: true } },
          },
        },
        listing: { select: { id: true, title: true } },
        conversation: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Attach the tenant's cached compatibility with the listing, when available.
    const scores = await prisma.compatibilityScore.findMany({
      where: { OR: interests.map((i) => ({ tenantId: i.tenantId, listingId: i.listingId })) },
      select: { tenantId: true, listingId: true, score: true, computedVia: true },
    });
    const key = (t: string, l: string) => `${t}:${l}`;
    const byPair = new Map(scores.map((s) => [key(s.tenantId, s.listingId), s]));

    res.json({
      status: 'success',
      data: {
        interests: interests.map((i) => {
          const s = byPair.get(key(i.tenantId, i.listingId));
          return { ...i, compatibility: s ? { score: s.score, computedVia: s.computedVia } : null };
        }),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /interests/:id — owner accepts / declines (transactional) ─────────
interestRouter.patch('/:id', authenticate, requireRole('OWNER'), validate(resolveInterestSchema), async (req, res, next) => {
  try {
    const { status } = req.body as { status: 'ACCEPTED' | 'DECLINED' };
    const interest = await prisma.interestRequest.findUnique({
      where: { id: param(req, 'id') },
      include: {
        listing: { select: { ownerId: true, title: true } },
        tenant: { select: { id: true, email: true } },
      },
    });
    if (!interest) throw new NotFoundError('Interest request');
    if (interest.listing.ownerId !== req.user!.id) throw new ForbiddenError('Not your listing');

    const result = await prisma.$transaction(async (tx) => {
      // Conditional update: only one concurrent resolution can win.
      const claimed = await tx.interestRequest.updateMany({
        where: { id: interest.id, status: 'PENDING' },
        data: { status, resolvedAt: new Date() },
      });
      if (claimed.count === 0) throw new ConflictError('This request has already been resolved');

      const conversation =
        status === 'ACCEPTED' ? await tx.conversation.create({ data: { interestRequestId: interest.id } }) : null;
      const updated = await tx.interestRequest.findUniqueOrThrow({ where: { id: interest.id } });
      return { updated, conversationId: conversation?.id ?? null };
    });

    void createNotification({
      userId: interest.tenant.id,
      type: status === 'ACCEPTED' ? 'INTEREST_ACCEPTED' : 'INTEREST_DECLINED',
      title: status === 'ACCEPTED' ? 'Your request was accepted' : 'Your request was declined',
      message:
        status === 'ACCEPTED'
          ? `The owner of “${interest.listing.title}” accepted your request. You can now chat.`
          : `The owner of “${interest.listing.title}” declined your request.`,
      metadata: { interestRequestId: interest.id, listingId: interest.listingId, conversationId: result.conversationId },
    });
    sendInterestDecisionEmail(interest.tenant.email, interest.listing.title, status);

    res.json({ status: 'success', data: { interest: result.updated, conversationId: result.conversationId } });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /interests/:id — tenant withdraws a PENDING request ──────────────
interestRouter.delete('/:id', authenticate, requireRole('TENANT'), async (req, res, next) => {
  try {
    const deleted = await prisma.interestRequest.deleteMany({
      where: { id: param(req, 'id'), tenantId: req.user!.id, status: 'PENDING' },
    });
    if (deleted.count === 0) throw new NotFoundError('Pending interest request');
    res.json({ status: 'success', data: { message: 'Request withdrawn' } });
  } catch (err) {
    next(err);
  }
});

export { interestRouter };
