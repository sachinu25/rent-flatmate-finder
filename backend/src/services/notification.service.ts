import type { NotificationType, Prisma } from '@prisma/client';

import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { emitToUser } from '../lib/realtime.js';

interface CreateNotification {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Persist an in-app notification and push it over Socket.IO.
 * Never throws — notification failures must not break the main action.
 */
export async function createNotification(data: CreateNotification): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
    emitToUser(data.userId, 'notification:new', notification);
  } catch (err) {
    logger.error({ err, userId: data.userId, type: data.type }, 'Failed to create notification');
  }
}

export async function createNotifications(items: CreateNotification[]): Promise<void> {
  await Promise.all(items.map((i) => createNotification(i)));
}
