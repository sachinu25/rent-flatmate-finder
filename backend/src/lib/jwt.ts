import type { UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

/**
 * Short-lived access tokens (JWT, HS256).
 *
 * Refresh tokens are NOT JWTs — they are opaque random strings persisted as
 * hashes (see services/token.service.ts) so they can be rotated and revoked.
 */

export interface TokenPayload {
  userId: string;
  role: UserRole;
}

const ISSUER = 'rent-flatmate-finder';
const AUDIENCE = 'rent-flatmate-finder-api';

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign({ role: payload.role, typ: 'access' }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: payload.userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  if (typeof decoded === 'string' || decoded['typ'] !== 'access' || typeof decoded.sub !== 'string') {
    throw new Error('Invalid token type');
  }

  return { userId: decoded.sub, role: decoded['role'] as UserRole };
}
