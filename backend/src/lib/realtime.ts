import type { Server } from 'socket.io';

/**
 * Thin indirection over the Socket.IO server so services can emit events
 * without importing the socket module (avoids circular imports and lets the
 * HTTP app run without sockets in tests).
 */

let io: Server | null = null;

/** userId → number of open sockets. Accurate for a single API instance. */
const connections = new Map<string, number>();

export function setIO(server: Server | null) {
  io = server;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function markOnline(userId: string): boolean {
  const n = (connections.get(userId) ?? 0) + 1;
  connections.set(userId, n);
  return n === 1;
}

export function markOffline(userId: string): boolean {
  const n = (connections.get(userId) ?? 1) - 1;
  if (n <= 0) {
    connections.delete(userId);
    return true;
  }
  connections.set(userId, n);
  return false;
}

export function isOnline(userId: string): boolean {
  return connections.has(userId);
}

/** True when the user currently has a socket inside the conversation room. */
export async function isViewingConversation(userId: string, conversationId: string): Promise<boolean> {
  if (!io) return false;
  const sockets = await io.in(`conversation:${conversationId}`).fetchSockets();
  return sockets.some((s) => (s.data as { userId?: string }).userId === userId);
}
