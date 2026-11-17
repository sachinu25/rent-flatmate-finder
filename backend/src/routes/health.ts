import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

const healthRouter = Router();

/**
 * GET /api/health — liveness + database connectivity for load balancers.
 * Intentionally exposes no configuration details.
 */
healthRouter.get('/', async (_req, res) => {
  let database = 'connected';
  let statusCode = 200;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'disconnected';
    statusCode = 503;
  }
  res.set('Cache-Control', 'no-store');
  res.status(statusCode).json({
    status: statusCode === 200 ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    database: { status: database },
  });
});

export { healthRouter };
