import type { Request } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateQuery } from '../middleware/validate.js';

const notificationRouter = Router();
const param = (req: Request, key: string) => req.params[key] as string;

notificationRouter.use(authenticate);

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(64).optional(),
  unread: z.preprocess((v) => v === 'true', z.boolean().default(false)),
});

// ── GET /notifications — cursor-paginated, newest first ─────────────────────
notificationRouter.get('/', validateQuery(listQuery), async (req, res, next) => {
  try {
    const { limit, cursor, unread } = res.locals['query'] as z.infer<typeof listQuery>;
    const userId = req.user!.id;
    const where = { userId, ...(unread && { read: false }) };

    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

    const hasMore = rows.length > limit;
    const notifications = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      status: 'success',
      data: { notifications, unreadCount, nextCursor: hasMore ? notifications.at(-1)?.id ?? null : null },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /notifications/unread-count ─────────────────────────────────────────
notificationRouter.get('/unread-count', async (req, res, next) => {
  try {
    const unreadCount = await prisma.notification.count({ where: { userId: req.user!.id, read: false } });
    res.json({ status: 'success', data: { unreadCount } });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /notifications/read-all (registered before /:id) ──────────────────
notificationRouter.patch('/read-all', async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
    res.json({ status: 'success', data: { message: 'All marked as read' } });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /notifications/:id/read ───────────────────────────────────────────
notificationRouter.patch('/:id/read', async (req, res, next) => {
  try {
    // Scoped by userId: users can only mark their own notifications.
    await prisma.notification.updateMany({ where: { id: param(req, 'id'), userId: req.user!.id }, data: { read: true } });
    res.json({ status: 'success', data: { message: 'Marked as read' } });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /notifications/:id ───────────────────────────────────────────────
notificationRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.notification.deleteMany({ where: { id: param(req, 'id'), userId: req.user!.id } });
    res.json({ status: 'success', data: { message: 'Deleted' } });
  } catch (err) {
    next(err);
  }
});

export { notificationRouter };
