import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Centralised, validated environment configuration.
 *
 * Fails fast at boot when a required production secret is missing or weak,
 * instead of failing on the first request.
 */

const isProd = process.env['NODE_ENV'] === 'production';
const isTest = process.env['NODE_ENV'] === 'test';

const secret = (name: string) =>
  z
    .string({ required_error: `${name} is required` })
    .min(32, `${name} must be at least 32 characters`);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  LOG_LEVEL: z.string().optional(),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: secret('JWT_SECRET'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),

  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  /** Number of reverse proxies in front of the API (Render = 1). */
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  /** Cookie SameSite policy. "lax" works when the frontend proxies /api (recommended). */
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // AI
  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'claude', 'none']).default('openai'),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(45000),
  HIGH_SCORE_THRESHOLD: z.coerce.number().int().min(0).max(100).default(80),

  // Email
  EMAIL_PROVIDER: z.enum(['resend', 'nodemailer', 'none']).default('none'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Rent & Flatmate Finder <onboarding@resend.dev>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** Public URL of the frontend, used for links in emails. */
  APP_URL: z.string().default('http://localhost:3000'),

  // Image storage
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('rent-flatmate-finder'),
  /** Public base URL of this API — used to build absolute URLs for locally stored uploads. */
  PUBLIC_API_URL: z.string().optional(),
});

const parsed = schema.safeParse({
  ...process.env,
  // Backward compatibility with the previous variable name.
  CORS_ORIGIN: process.env['CORS_ORIGIN'] ?? process.env['FRONTEND_URL'],
  JWT_SECRET:
    process.env['JWT_SECRET'] ??
    (isTest ? 'test-only-jwt-secret-not-for-production-use-0123456789' : undefined),
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

const data = parsed.data;

if (isProd && data.JWT_SECRET.includes('change')) {
  // eslint-disable-next-line no-console
  console.error('❌ JWT_SECRET still contains the placeholder value. Generate a random secret.');
  process.exit(1);
}

// Without an explicit origin the browser's Socket.IO connection is rejected by
// CORS in production — fail at boot instead of failing silently at runtime.
if (isProd && !process.env['CORS_ORIGIN'] && !process.env['FRONTEND_URL']) {
  // eslint-disable-next-line no-console
  console.error('❌ CORS_ORIGIN is required in production (your frontend URL, e.g. https://your-app.vercel.app).');
  process.exit(1);
}

const cloudinaryConfigured = Boolean(
  data.CLOUDINARY_CLOUD_NAME && data.CLOUDINARY_API_KEY && data.CLOUDINARY_API_SECRET,
);

export const env = {
  ...data,
  isProd,
  isTest,
  corsOrigins: data.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean),
  llmProvider: data.LLM_PROVIDER === 'claude' ? 'anthropic' : data.LLM_PROVIDER,
  cloudinaryConfigured,
};

export type Env = typeof env;
