import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

import { AppError, ValidationError } from '../errors/index.js';
import { logger } from '../lib/logger.js';

function send(res: Response, statusCode: number, message: string, extra: Record<string, unknown> = {}) {
  res.status(statusCode).json({ status: 'error', statusCode, message, ...extra });
}

export function zodToFieldErrors(err: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const field = issue.path.join('.') || '_';
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/**
 * Centralized error handler.
 *
 * Operational errors map to precise status codes; anything unexpected is
 * logged with the request id and returned as a generic 500 (no stack traces
 * or internals are ever sent to the client).
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    const extra = err instanceof ValidationError && err.errors ? { errors: err.errors } : {};
    send(res, err.statusCode, err.message, extra);
    return;
  }

  if (err instanceof ZodError) {
    send(res, 400, 'Validation failed', { errors: zodToFieldErrors(err) });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Each image must be 5 MB or smaller'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Too many images (maximum 8 per upload)'
          : 'Invalid upload';
    send(res, 400, message);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return send(res, 409, 'Resource already exists');
    if (err.code === 'P2025') return send(res, 404, 'Resource not found');
    if (err.code === 'P2003') return send(res, 409, 'Related resource constraint failed');
  }

  // body-parser errors (malformed JSON, payload too large)
  const httpErr = err as { type?: string; status?: number };
  if (httpErr.type === 'entity.parse.failed') return send(res, 400, 'Malformed JSON body');
  if (httpErr.type === 'entity.too.large') return send(res, 413, 'Request body too large');

  logger.error({ err, reqId: req.id, url: req.originalUrl }, 'Unhandled error');
  send(res, 500, 'Internal server error');
}
