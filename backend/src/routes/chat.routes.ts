import type { Request } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { emitToUser, isOnline } from '../lib/realtime.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateQuery } from '../middleware/validate.js';
import { getAuthorizedConversation, markConversationRead } from '../services/chat.service.js';

const chatRouter = Router();
const param = (req: Request, key: string) => req.params[key] as string;

chatRouter.use(authenticate);

const userSelect = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;

// ── GET /chat/conversations — list with last message + unread count ─────────
chatRouter.get('/conversations', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const conversations = await prisma.conversation.findMany({
      where: {
        interestRequest: {
          status: 'ACCEPTED',
          OR: [{ tenantId: userId }, { listing: { ownerId: userId } }],
        },
      },
      include: {
        interestRequest: {
          select: {
            tenantId: true,
            tenant: { select: userSelect },
            listing: {
              select: {
                id: true, title: true, ownerId: true,
                owner: { select: userSelect },
                photos: { orderBy: { order: 'asc' }, take: 1, select: { url: true } },
              },
            },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const unread = await prisma.chatMessage.groupBy({
      by: ['conversationId'],
      where: { conversationId: { in: conversations.map((c) => c.id) }, senderId: { not: userId }, readAt: null },
      _count: { _all: true },
    });
    const unreadBy = new Map(unread.map((u) => [u.conversationId, u._count._all]));

    const result = conversations.map((c) => {
      const ir = c.interestRequest;
      const otherUser = userId === ir.tenantId ? ir.listing.owner : ir.tenant;
      return {
        id: c.id,
        otherUser: { ...otherUser, online: isOnline(otherUser.id) },
        listing: { id: ir.listing.id, title: ir.listing.title, photoUrl: ir.listing.photos[0]?.url ?? null },
        lastMessage: c.messages[0] ?? null,
        unreadCount: unreadBy.get(c.id) ?? 0,
        updatedAt: c.messages[0]?.createdAt ?? c.updatedAt,
      };
    });
    result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    res.json({ status: 'success', data: { conversations: result } });
  } catch (err) {
    next(err);
  }
});

// ── GET /chat/unread-count — total unread messages ──────────────────────────
chatRouter.get('/unread-count', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const unreadCount = await prisma.chatMessage.count({
      where: {
        readAt: null,
        senderId: { not: userId },
        conversation: {
          interestRequest: { status: 'ACCEPTED', OR: [{ tenantId: userId }, { listing: { ownerId: userId } }] },
        },
      },
    });
    res.json({ status: 'success', data: { unreadCount } });
  } catch (err) {
    next(err);
  }
});

// ── GET /chat/:conversationId — conversation header info ────────────────────
chatRouter.get('/:conversationId', async (req, res, next) => {
  try {
    const { conversation, otherUserId, listing } = await getAuthorizedConversation(param(req, 'conversationId'), req.user!.id);
    const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: userSelect });
    res.json({
      status: 'success',
      data: {
        conversation: {
          id: conversation.id,
          listing: { id: listing.id, title: listing.title },
          otherUser: otherUser ? { ...otherUser, online: isOnline(otherUser.id) } : null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

const messagesQuery = z.object({
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

// ── GET /chat/:conversationId/messages — cursor pagination (older first) ────
chatRouter.get('/:conversationId/messages', validateQuery(messagesQuery), async (req, res, next) => {
  try {
    const conversationId = param(req, 'conversationId');
    await getAuthorizedConversation(conversationId, req.user!.id);
    const { cursor, limit } = res.locals['query'] as z.infer<typeof messagesQuery>;

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    res.json({
      status: 'success',
      data: { messages: messages.reverse(), hasMore, nextCursor: hasMore ? messages[0]?.id ?? null : null },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /chat/:conversationId/read — mark incoming messages as read ────────
chatRouter.post('/:conversationId/read', async (req, res, next) => {
  try {
    const conversationId = param(req, 'conversationId');
    const { otherUserId } = await getAuthorizedConversation(conversationId, req.user!.id);
    const { count, readAt } = await markConversationRead(conversationId, req.user!.id);
    if (count > 0) {
      emitToUser(otherUserId, 'messages:read', { conversationId, readBy: req.user!.id, readAt: readAt.toISOString() });
    }
    res.json({ status: 'success', data: { marked: count } });
  } catch (err) {
    next(err);
  }
});

export { chatRouter };
