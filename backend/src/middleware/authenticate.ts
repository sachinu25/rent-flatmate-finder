import type { NextFunction, Request, Response } from 'express';

import { UnauthorizedError } from '../errors/index.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/**
 * Requires a valid access token. Loads the user from the DB on every request so
 * deactivated accounts and role changes take effect immediately.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = bearer(req);
    if (!token) throw new UnauthorizedError('Missing or invalid authorization header');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) throw new UnauthorizedError('Invalid or expired access token');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Attaches req.user when a valid token is present; otherwise continues
 * anonymously. Never rejects the request.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = bearer(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.isActive) req.user = user;
  } catch {
    // invalid/expired token → treat as anonymous
  }
  next();
}
