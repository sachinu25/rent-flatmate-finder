import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';

import { ValidationError } from '../errors/index.js';

import { zodToFieldErrors } from './errorHandler.js';

/**
 * Validates and replaces req.body with the parsed (coerced, stripped) value.
 * Unknown keys are stripped by Zod's default object behaviour, which prevents
 * mass-assignment of fields such as `ownerId` or `status`.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body) as unknown;
      next();
    } catch (err) {
      next(err instanceof ZodError ? new ValidationError('Validation failed', zodToFieldErrors(err)) : err);
    }
  };
}

/** Parse query parameters; the result is stored on res.locals.query. */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.locals['query'] = schema.parse(req.query) as unknown;
      next();
    } catch (err) {
      next(err instanceof ZodError ? new ValidationError('Invalid query parameters', zodToFieldErrors(err)) : err);
    }
  };
}
