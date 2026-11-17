import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { upsertProfileSchema, type UpsertProfileInput } from '../validators/profile.validators.js';

const profileRouter = Router();

/**
 * GET /profile — current tenant's profile. Returns `profile: null` (200) when
 * not yet created, so the UI can render an onboarding state without a 404.
 */
profileRouter.get('/', authenticate, requireRole('TENANT'), async (req, res, next) => {
  try {
    const profile = await prisma.tenantProfile.findUnique({ where: { userId: req.user!.id } });
    res.json({ status: 'success', data: { profile } });
  } catch (err) {
    next(err);
  }
});

// ── POST /profile — create or update tenant profile ─────────────────────────
profileRouter.post('/', authenticate, requireRole('TENANT'), validate(upsertProfileSchema), async (req, res, next) => {
  try {
    const data = req.body as UpsertProfileInput;
    const profile = await prisma.tenantProfile.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, ...data },
      update: data,
    });
    res.json({ status: 'success', data: { profile } });
  } catch (err) {
    next(err);
  }
});

export { profileRouter };
