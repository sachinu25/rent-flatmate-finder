import { z } from 'zod';

/**
 * ≥ 8 chars with upper, lower and a digit. Capped at 72 characters because
 * bcrypt silently ignores bytes beyond 72.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const name = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(50).regex(/^[^<>]*$/, `${label} contains invalid characters`);

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Invalid phone number');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address').max(254),
  password: passwordSchema,
  firstName: name('First name'),
  lastName: name('Last name'),
  role: z.enum(['TENANT', 'OWNER'], { errorMap: () => ({ message: 'Role must be TENANT or OWNER' }) }),
  phone: z.preprocess((v) => (v === '' ? undefined : v), phone.optional()),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address').max(254),
  password: z.string().min(1, 'Password is required').max(200),
});

export const updateMeSchema = z.object({
  firstName: name('First name').optional(),
  lastName: name('Last name').optional(),
  phone: z.preprocess((v) => (v === '' ? null : v), phone.nullable().optional()),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
