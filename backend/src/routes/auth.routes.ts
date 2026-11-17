import type { User } from '@prisma/client';
import bcrypt from 'bcrypt';
import type { Request } from 'express';
import { Router } from 'express';

import { ConflictError, UnauthorizedError, ValidationError } from '../errors/index.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter, loginAccountLimiter, refreshLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  issueSession,
  readCookie,
  revokeAllForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  setRefreshCookie,
} from '../services/token.service.js';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateMeSchema,
  type LoginInput,
  type RegisterInput,
} from '../validators/auth.validators.js';

const authRouter = Router();

const BCRYPT_SALT_ROUNDS = 12;
// Pre-computed hash used to equalise timing when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', BCRYPT_SALT_ROUNDS);

/** Public user shape — never includes the password hash. */
export function sanitizeUser(user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'avatarUrl' | 'phone'>) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
  };
}

/**
 * CSRF hardening for cookie-authenticated endpoints: browsers cannot attach a
 * custom header to a cross-site form post, and SameSite=Lax blocks the cookie.
 */
function requireCsrfHeader(req: Request) {
  if (req.get('x-requested-with') !== 'fetch') {
    throw new UnauthorizedError('Missing X-Requested-With header');
  }
}

// ── POST /auth/register ──────────────────────────────────────────────────────
authRouter.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role, phone } = req.body as RegisterInput;

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictError('An account with this email already exists');

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, hashedPassword, firstName, lastName, role, phone, lastLoginAt: new Date() },
    });

    const { accessToken, refreshToken } = await issueSession(user, req);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ status: 'success', data: { accessToken, user: sanitizeUser(user) } });
  } catch (err) {
    next(err);
  }
});

// ── POST /auth/login ─────────────────────────────────────────────────────────
authRouter.post('/login', authLimiter, loginAccountLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as LoginInput;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always run bcrypt so response time does not reveal whether the email exists.
    const passwordMatch = await bcrypt.compare(password, user?.hashedPassword ?? DUMMY_HASH);
    if (!user || !passwordMatch) throw new UnauthorizedError('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedError('This account has been deactivated');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const { accessToken, refreshToken } = await issueSession(user, req);
    setRefreshCookie(res, refreshToken);
    res.json({ status: 'success', data: { accessToken, user: sanitizeUser(user) } });
  } catch (err) {
    next(err);
  }
});

// ── POST /auth/refresh — rotate the httpOnly refresh cookie ──────────────────
authRouter.post('/refresh', refreshLimiter, async (req, res, next) => {
  try {
    requireCsrfHeader(req);
    const token = readCookie(req, REFRESH_COOKIE);
    if (!token) throw new UnauthorizedError('No active session');

    try {
      const { user, accessToken, refreshToken } = await rotateRefreshToken(token, req);
      setRefreshCookie(res, refreshToken);
      res.json({ status: 'success', data: { accessToken, user: sanitizeUser(user) } });
    } catch (err) {
      clearRefreshCookie(res);
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// ── POST /auth/logout ────────────────────────────────────────────────────────
authRouter.post('/logout', async (req, res, next) => {
  try {
    await revokeRefreshToken(readCookie(req, REFRESH_COOKIE));
    clearRefreshCookie(res);
    res.json({ status: 'success', data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────
authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true,
        phone: true, createdAt: true, tenantProfile: true,
      },
    });
    if (!user) throw new UnauthorizedError('User not found');
    res.json({ status: 'success', data: { user } });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /auth/me — update basic account details ───────────────────────────
authRouter.patch('/me', authenticate, validate(updateMeSchema), async (req, res, next) => {
  try {
    const data = req.body as { firstName?: string; lastName?: string; phone?: string | null };
    const user = await prisma.user.update({ where: { id: req.user!.id }, data });
    res.json({ status: 'success', data: { user: sanitizeUser(user) } });
  } catch (err) {
    next(err);
  }
});

// ── POST /auth/change-password — revokes all other sessions ─────────────────
authRouter.post('/change-password', authLimiter, authenticate, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    const ok = await bcrypt.compare(currentPassword, req.user!.hashedPassword);
    if (!ok) throw new ValidationError('Current password is incorrect', { currentPassword: ['Incorrect password'] });

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { hashedPassword: await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS) },
    });
    await revokeAllForUser(req.user!.id);

    const { accessToken, refreshToken } = await issueSession(req.user!, req);
    setRefreshCookie(res, refreshToken);
    res.json({ status: 'success', data: { accessToken, message: 'Password updated' } });
  } catch (err) {
    next(err);
  }
});

export { authRouter };
