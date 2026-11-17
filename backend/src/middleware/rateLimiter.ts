import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { env } from '../config/env.js';

const message = (msg = 'Too many requests. Please try again later.') => ({
  status: 'error',
  statusCode: 429,
  message: msg,
});

// Limits are disabled under test so the integration suite can run many requests.
const skip = () => env.isTest;

/** Login / register — brute-force protection (per IP). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: message('Too many attempts. Please wait a few minutes and try again.'),
  skip,
});

/**
 * Login — per-ACCOUNT brute-force protection. Keyed by the target email, so it
 * holds even if an attacker rotates (or spoofs) IP addresses.
 */
export const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return `login:${typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : ''}`;
  },
  message: message('Too many failed sign-in attempts for this account. Please wait 15 minutes.'),
  skip,
});

/** Token refresh happens on every page load, so it gets a generous budget. */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message(),
  skip,
});

/** Baseline limit for the whole API. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message(),
  skip,
});

/** AI analysis is the most expensive endpoint — keyed per user, not per IP. */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? '0.0.0.0'),
  message: message('AI analysis limit reached. Please try again later.'),
  skip,
});

/** Write operations such as creating listings or interests. */
export const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? '0.0.0.0'),
  message: message(),
  skip,
});
