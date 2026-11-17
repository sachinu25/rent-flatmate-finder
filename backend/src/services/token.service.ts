import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { User } from '@prisma/client';
import type { Request, Response } from 'express';

import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/index.js';
import { generateAccessToken } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

/**
 * Refresh-token lifecycle with rotation and reuse detection.
 *
 *  - The raw token lives only in an httpOnly cookie; the DB stores its SHA-256.
 *  - Every refresh issues a new token and marks the old one as replaced.
 *  - Presenting a replaced/revoked token revokes the entire family (theft signal).
 */

export const REFRESH_COOKIE = 'rff_rt';
const COOKIE_PATH = '/api/auth';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

function ttlMs() {
  return env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
}

async function createRefreshToken(userId: string, familyId: string, userAgent?: string) {
  const token = randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + ttlMs()),
      userAgent: userAgent?.slice(0, 255),
    },
  });
  return token;
}

/** Issue an access token + a refresh token in a brand-new family (login/register). */
export async function issueSession(user: Pick<User, 'id' | 'role'>, req: Request) {
  const refreshToken = await createRefreshToken(user.id, randomUUID(), req.get('user-agent'));
  return { accessToken: generateAccessToken({ userId: user.id, role: user.role }), refreshToken };
}

/** Rotate a presented refresh token. Throws UnauthorizedError when invalid. */
export async function rotateRefreshToken(rawToken: string, req: Request) {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash(rawToken) },
    include: { user: true },
  });

  if (!record) throw new UnauthorizedError('Invalid refresh token');

  if (record.revokedAt || record.replacedAt) {
    // Reuse of a rotated token: someone else may hold this session.
    await prisma.refreshToken.updateMany({
      where: { familyId: record.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    logger.warn({ userId: record.userId, familyId: record.familyId }, 'Refresh token reuse detected — family revoked');
    throw new UnauthorizedError('Session expired, please sign in again');
  }

  if (record.expiresAt < new Date()) throw new UnauthorizedError('Session expired, please sign in again');
  if (!record.user.isActive) throw new UnauthorizedError('Account has been deactivated');

  // Conditional update guards against two concurrent refreshes of the same token.
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: record.id, replacedAt: null, revokedAt: null },
    data: { replacedAt: new Date() },
  });
  if (claimed.count === 0) throw new UnauthorizedError('Session expired, please sign in again');

  const refreshToken = await createRefreshToken(record.userId, record.familyId, req.get('user-agent'));
  return {
    user: record.user,
    accessToken: generateAccessToken({ userId: record.userId, role: record.user.role }),
    refreshToken,
  };
}

/** Revoke the family of the presented token (logout). Silently ignores unknown tokens. */
export async function revokeRefreshToken(rawToken: string | undefined) {
  if (!rawToken) return;
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(rawToken) } });
  if (!record) return;
  await prisma.refreshToken.updateMany({
    where: { familyId: record.familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoke every session of a user (e.g. account deactivated). */
export async function revokeAllForUser(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

// ── Cookie helpers (no cookie-parser dependency) ─────────────────────────────

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    path: COOKIE_PATH,
    maxAge: ttlMs(),
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.isProd || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    path: COOKIE_PATH,
  });
}
