import { ForbiddenError, NotFoundError } from '../errors/index.js';
import { prisma } from '../lib/prisma.js';

/**
 * Single source of truth for chat authorization — used by both the REST
 * routes and the Socket.IO handlers.
 *
 * A user may access a conversation only if they are the tenant or the listing
 * owner of the underlying interest request AND that request was accepted.
 */
export async function getAuthorizedConversation(conversationId: string, userId: string) {
  if (typeof conversationId !== 'string' || conversationId.length === 0 || conversationId.length > 64) {
    throw new NotFoundError('Conversation');
  }
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      interestRequest: {
        select: {
          status: true,
          tenantId: true,
          listing: { select: { id: true, title: true, ownerId: true } },
        },
      },
    },
  });
  if (!conversation) throw new NotFoundError('Conversation');

  const ir = conversation.interestRequest;
  if (userId !== ir.tenantId && userId !== ir.listing.ownerId) throw new ForbiddenError('Not a participant');
  if (ir.status !== 'ACCEPTED') throw new ForbiddenError('This conversation is not active');

  const otherUserId = userId === ir.tenantId ? ir.listing.ownerId : ir.tenantId;
  return { conversation, otherUserId, listing: ir.listing };
}

export const MAX_MESSAGE_LENGTH = 2000;

export async function markConversationRead(conversationId: string, userId: string) {
  const now = new Date();
  const result = await prisma.chatMessage.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: now },
  });
  return { count: result.count, readAt: now };
}
