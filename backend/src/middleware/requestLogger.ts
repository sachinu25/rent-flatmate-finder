import pinoHttp from 'pino-http';

import { logger } from '../lib/logger.js';

/**
 * HTTP request/response logging middleware using pino-http.
 * Logs method, url, status code and response time.
 *
 * `clientIp` is Express's `req.ip` after applying TRUST_PROXY — check it in the
 * production logs to confirm rate limiting sees real visitor IPs (not the
 * Vercel/Render proxy address).
 */
export const requestLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/api/health',
  },
  customProps: (req) => ({ clientIp: (req as unknown as { ip?: string }).ip }),
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
});
