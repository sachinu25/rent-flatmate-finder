import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { NotFoundError } from './errors/index.js';
import { LOCAL_UPLOAD_ROOT } from './lib/storage.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiRouter } from './routes/index.js';

/**
 * Express application (no network listener) — imported by the server entry
 * point and by the integration tests.
 */
export function createApp() {
  const app = express();

  // Correct client IPs behind Render/Vercel proxies (rate limiting, logs).
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // JSON API: lock everything down; the frontend sets its own CSP.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      strictTransportSecurity: env.isProd ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  app.use(
    cors({
      origin(origin, cb) {
        // Same-origin / server-to-server requests have no Origin header.
        if (!origin || env.corsOrigins.includes(origin.replace(/\/$/, ''))) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(requestLogger);

  // Locally stored uploads (development fallback when Cloudinary is not configured).
  // Content is verified as an image at upload time; nosniff prevents MIME confusion.
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
      next();
    },
    express.static(LOCAL_UPLOAD_ROOT, { dotfiles: 'deny', index: false, maxAge: '7d', immutable: true }),
  );

  // API responses are per-user by default and must never be stored by a CDN or
  // proxy cache (Vercel caches external-rewrite responses that look cacheable).
  // Public endpoints (featured, cities, stats) opt in with their own header.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  });

  app.use('/api', apiLimiter, apiRouter);

  app.get('/', (_req, res) => {
    res.json({ name: 'Rent & Flatmate Finder API', health: '/api/health' });
  });

  app.use((_req, _res, next) => next(new NotFoundError('Route')));
  app.use(errorHandler);

  return app;
}

export const app = createApp();
