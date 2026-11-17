import { createServer } from 'node:http';

import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { initSocketIO } from './lib/socket.js';
import { isAIConfigured } from './services/llm.service.js';

/**
 * Server entry point: one long-lived Node process serving the REST API and
 * the Socket.IO endpoint on the same port. Must run on a host that supports
 * persistent connections (Render, Railway, Fly.io) — not serverless functions.
 */

const httpServer = createServer(app);
const io = initSocketIO(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
  logger.info(`CORS origins: ${env.corsOrigins.join(', ')}`);
  logger.info(`AI analysis: ${isAIConfigured() ? env.llmProvider : 'disabled (rule-based scoring only)'}`);
  logger.info(`Email: ${env.EMAIL_PROVIDER}`);
  if (!env.cloudinaryConfigured) {
    const msg = 'Cloudinary not configured — uploads are stored on local disk';
    if (env.isProd) logger.warn(`${msg}. Most hosts use ephemeral disks: images WILL be lost on redeploy.`);
    else logger.info(msg);
  }
});

function gracefulShutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();

  void io.close(() => {
    // io.close() also closes the underlying HTTP server.
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled promise rejection'));
