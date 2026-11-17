import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';

/**
 * Aggregated dashboard data. Every number here is a real count from the
 * database — nothing is estimated.
 */
const dashboardRouter = Router();

// ── GET /dashboard/owner ────────────────────────────────────────────────────
dashboardRouter.get('/owner', authenticate, requireRole('OWNER'), async (req, res, next) => {
  try {
    const ownerId = req.user!.id;
    const [byStatus, views, interestsByStatus, recentInterests, saves] = await Promise.all([
      prisma.listing.groupBy({ by: ['status'], where: { ownerId }, _count: { _all: true } }),
      prisma.listing.aggregate({ where: { ownerId }, _sum: { viewCount: true } }),
      prisma.interestRequest.groupBy({ by: ['status'], where: { listing: { ownerId } }, _count: { _all: true } }),
      prisma.interestRequest.findMany({
        where: { listing: { ownerId } },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          id: true, status: true, createdAt: true, updatedAt: true,
          tenant: { select: { firstName: true, lastName: true, avatarUrl: true } },
          listing: { select: { id: true, title: true } },
        },
      }),
      prisma.savedListing.count({ where: { listing: { ownerId } } }),
    ]);

    const countOf = (rows: { status: string; _count: { _all: number } }[], status: string) =>
      rows.find((r) => r.status === status)?._count._all ?? 0;
    const active = countOf(byStatus, 'ACTIVE');
    const filled = countOf(byStatus, 'FILLED');

    res.json({
      status: 'success',
      data: {
        stats: {
          totalListings: active + filled,
          activeListings: active,
          filledListings: filled,
          totalViews: views._sum.viewCount ?? 0,
          totalSaves: saves,
          interests: {
            pending: countOf(interestsByStatus, 'PENDING'),
            accepted: countOf(interestsByStatus, 'ACCEPTED'),
            declined: countOf(interestsByStatus, 'DECLINED'),
          },
        },
        recentActivity: recentInterests,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /dashboard/tenant ───────────────────────────────────────────────────
dashboardRouter.get('/tenant', authenticate, requireRole('TENANT'), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const [profile, interestsByStatus, savedCount] = await Promise.all([
      prisma.tenantProfile.findUnique({ where: { userId } }),
      prisma.interestRequest.groupBy({ by: ['status'], where: { tenantId: userId }, _count: { _all: true } }),
      prisma.savedListing.count({ where: { userId } }),
    ]);

    // Profile completeness — each answered field counts equally.
    const user = req.user!;
    const checks: [string, boolean][] = [
      ['Phone number', Boolean(user.phone)],
      ['Preferred location & budget', Boolean(profile)],
      ['Occupation', Boolean(profile?.occupation)],
      ['About you', Boolean(profile?.bio)],
      ['Cleanliness', profile?.cleanliness != null],
      ['Sleep schedule', profile?.sleepSchedule != null],
      ['Work schedule', profile?.workSchedule != null],
      ['Food preference', profile?.foodPreference != null],
      ['Smoking', profile?.smoking != null],
      ['Pets', profile?.hasPets != null],
      ['Room preference', profile?.roomSharing != null],
    ];
    const done = checks.filter(([, ok]) => ok).length;

    const by = (s: string) => interestsByStatus.find((r) => r.status === s)?._count._all ?? 0;
    res.json({
      status: 'success',
      data: {
        profileCompletion: {
          percent: Math.round((done / checks.length) * 100),
          missing: checks.filter(([, ok]) => !ok).map(([label]) => label),
        },
        hasProfile: Boolean(profile),
        stats: {
          saved: savedCount,
          interests: { pending: by('PENDING'), accepted: by('ACCEPTED'), declined: by('DECLINED') },
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export { dashboardRouter };
