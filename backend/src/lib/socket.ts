import type { Server as HttpServer } from 'node:http';

import { Server, type Socket } from 'socket.io';

import { env } from '../config/env.js';
import { getAuthorizedConversation, markConversationRead, MAX_MESSAGE_LENGTH } from '../services/chat.service.js';
import { createNotification } from '../services/notification.service.js';

import { verifyAccessToken } from './jwt.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';
import { emitToUser, isOnline, isViewingConversation, markOffline, markOnline, setIO } from './realtime.js';

interface SocketData {
  userId: string;
  name: string;
  /** Simple token bucket for message rate limiting. */
  bucket: { tokens: number; updatedAt: number };
}

type Ack = (response: { ok: boolean; error?: string; [k: string]: unknown }) => void;
const noopAck: Ack = () => undefined;
const asAck = (cb: unknown): Ack => (typeof cb === 'function' ? (cb as Ack) : noopAck);

const BUCKET_SIZE = 10;
const REFILL_PER_SEC = 2;

function takeToken(data: SocketData): boolean {
  const now = Date.now();
  const elapsed = (now - data.bucket.updatedAt) / 1000;
  data.bucket.tokens = Math.min(BUCKET_SIZE, data.bucket.tokens + elapsed * REFILL_PER_SEC);
  data.bucket.updatedAt = now;
  if (data.bucket.tokens < 1) return false;
  data.bucket.tokens -= 1;
  return true;
}

const room = (conversationId: string) => `conversation:${conversationId}`;

/** IDs of everyone this user has an active conversation with (for presence fan-out). */
async function partnerIds(userId: string): Promise<string[]> {
  const rows = await prisma.interestRequest.findMany({
    where: { status: 'ACCEPTED', OR: [{ tenantId: userId }, { listing: { ownerId: userId } }] },
    select: { tenantId: true, listing: { select: { ownerId: true } } },
  });
  return [...new Set(rows.map((r) => (r.tenantId === userId ? r.listing.ownerId : r.tenantId)))];
}

async function broadcastPresence(userId: string, online: boolean) {
  try {
    for (const id of await partnerIds(userId)) emitToUser(id, 'presence:update', { userId, online });
  } catch (err) {
    logger.debug({ err }, 'Presence broadcast failed');
  }
}

export function initSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
    pingTimeout: 30_000,
    maxHttpBufferSize: 16 * 1024, // messages are small; reject oversized frames
  });
  setIO(io);

  // ── Authentication ─────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown })['token'];
    if (typeof token !== 'string' || !token) return next(new Error('Authentication required'));
    void (async () => {
      try {
        const payload = verifyAccessToken(token);
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, isActive: true, firstName: true },
        });
        if (!user?.isActive) return next(new Error('Invalid or expired token'));
        const data: SocketData = {
          userId: user.id,
          name: user.firstName,
          bucket: { tokens: BUCKET_SIZE, updatedAt: Date.now() },
        };
        socket.data = data;
        next();
      } catch {
        next(new Error('Invalid or expired token'));
      }
    })();
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;
    const { userId } = data;
    void socket.join(`user:${userId}`);
    if (markOnline(userId)) void broadcastPresence(userId, true);
    logger.debug({ userId, socketId: socket.id }, 'Socket connected');

    // ── Join a conversation room (authorization enforced) ─────────────────
    socket.on('join:conversation', async (conversationId: unknown, cb?: unknown) => {
      const ack = asAck(cb);
      try {
        const { otherUserId } = await getAuthorizedConversation(String(conversationId), userId);
        const id = String(conversationId);
        await socket.join(room(id));

        const { count, readAt } = await markConversationRead(id, userId);
        if (count > 0) {
          const payload = { conversationId: id, readBy: userId, readAt: readAt.toISOString() };
          socket.to(room(id)).emit('messages:read', payload);
          emitToUser(otherUserId, 'messages:read', payload);
        }
        socket.emit('joined:conversation', { conversationId: id });
        ack({ ok: true, otherUserOnline: isOnline(otherUserId) });
      } catch {
        ack({ ok: false, error: 'Conversation not available' });
        socket.emit('error', { message: 'Conversation not available' });
      }
    });

    socket.on('leave:conversation', (conversationId: unknown) => {
      if (typeof conversationId === 'string') void socket.leave(room(conversationId));
    });

    // ── Send a message ────────────────────────────────────────────────────
    socket.on('message:send', async (payload: unknown, cb?: unknown) => {
      const ack = asAck(cb);
      try {
        const { conversationId, content, tempId } = (payload ?? {}) as {
          conversationId?: unknown;
          content?: unknown;
          tempId?: unknown;
        };
        if (typeof conversationId !== 'string' || typeof content !== 'string') {
          return ack({ ok: false, error: 'Invalid message' });
        }
        const text = content.trim();
        if (!text) return ack({ ok: false, error: 'Message is empty' });
        if (text.length > MAX_MESSAGE_LENGTH) {
          return ack({ ok: false, error: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters` });
        }
        if (!takeToken(data)) return ack({ ok: false, error: 'You are sending messages too quickly' });

        // Re-check authorization on every send (interest status can change).
        const { otherUserId, listing } = await getAuthorizedConversation(conversationId, userId);

        const [message] = await prisma.$transaction([
          prisma.chatMessage.create({ data: { conversationId, senderId: userId, content: text } }),
          prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
        ]);

        const out = {
          id: message.id,
          conversationId,
          senderId: userId,
          content: message.content,
          readAt: null,
          createdAt: message.createdAt.toISOString(),
          tempId: typeof tempId === 'string' ? tempId.slice(0, 64) : undefined,
        };
        io.to(room(conversationId)).emit('message:new', out);
        // Personal rooms keep conversation lists / unread badges fresh everywhere.
        emitToUser(otherUserId, 'chat:activity', out);
        emitToUser(userId, 'chat:activity', out);
        ack({ ok: true, message: out });

        // Notify the recipient only if they are not looking at this conversation,
        // and at most one unread "new message" notification per conversation.
        if (!(await isViewingConversation(otherUserId, conversationId))) {
          const pending = await prisma.notification.findFirst({
            where: { userId: otherUserId, type: 'NEW_MESSAGE', read: false, metadata: { path: ['conversationId'], equals: conversationId } },
            select: { id: true },
          });
          if (!pending) {
            void createNotification({
              userId: otherUserId,
              type: 'NEW_MESSAGE',
              title: `New message from ${data.name}`,
              message: `About “${listing.title}”: ${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`,
              metadata: { conversationId, listingId: listing.id },
            });
          }
        }
      } catch (err) {
        logger.warn({ err: err instanceof Error ? err.message : err, userId }, 'message:send failed');
        ack({ ok: false, error: 'Message could not be sent' });
      }
    });

    // ── Typing indicators (only inside rooms the socket has joined) ───────
    const relayTyping = (event: 'typing:start' | 'typing:stop') => (conversationId: unknown) => {
      if (typeof conversationId !== 'string' || !socket.rooms.has(room(conversationId))) return;
      socket.to(room(conversationId)).emit(event, { userId, conversationId });
    };
    socket.on('typing:start', relayTyping('typing:start'));
    socket.on('typing:stop', relayTyping('typing:stop'));

    // ── Mark read (only for joined, i.e. authorized, conversations) ───────
    socket.on('messages:markRead', async (conversationId: unknown) => {
      if (typeof conversationId !== 'string' || !socket.rooms.has(room(conversationId))) return;
      try {
        const { count, readAt } = await markConversationRead(conversationId, userId);
        if (count > 0) {
          socket
            .to(room(conversationId))
            .emit('messages:read', { conversationId, readBy: userId, readAt: readAt.toISOString() });
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to mark messages read');
      }
    });

    // ── Presence query ────────────────────────────────────────────────────
    socket.on('presence:query', (ids: unknown, cb?: unknown) => {
      const ack = asAck(cb);
      if (!Array.isArray(ids)) return ack({ ok: false });
      const online: Record<string, boolean> = {};
      for (const id of ids.slice(0, 100)) if (typeof id === 'string') online[id] = isOnline(id);
      ack({ ok: true, online });
    });

    socket.on('disconnect', () => {
      if (markOffline(userId)) void broadcastPresence(userId, false);
      logger.debug({ userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}
