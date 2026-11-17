import { z } from 'zod';

const optionalText = (max: number) =>
  z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(max).nullable().optional());

export const upsertProfileSchema = z
  .object({
    preferredLocation: z.string().trim().min(2).max(120),
    budgetMin: z.coerce.number().int().min(0).max(10_000_000),
    budgetMax: z.coerce.number().int().min(500).max(10_000_000),
    moveInDate: z.coerce.date(),
    occupation: optionalText(120),
    lifestyle: optionalText(500),
    bio: optionalText(2000),
    cleanliness: z.coerce.number().int().min(1).max(5).nullable().optional(),
    sleepSchedule: z.enum(['EARLY_BIRD', 'NIGHT_OWL', 'FLEXIBLE']).nullable().optional(),
    workSchedule: z.enum(['OFFICE', 'REMOTE', 'HYBRID', 'SHIFTS', 'STUDENT']).nullable().optional(),
    foodPreference: z.enum(['VEGETARIAN', 'NON_VEGETARIAN', 'VEGAN', 'EGGETARIAN', 'NO_PREFERENCE']).nullable().optional(),
    smoking: z.enum(['NON_SMOKER', 'OCCASIONAL', 'SMOKER']).nullable().optional(),
    hasPets: z.boolean().nullable().optional(),
    roomSharing: z.enum(['PRIVATE_ROOM', 'SHARED_ROOM', 'ENTIRE_PLACE', 'NO_PREFERENCE']).nullable().optional(),
  })
  .refine((d) => d.budgetMax >= d.budgetMin, {
    message: 'Maximum budget must be greater than or equal to the minimum',
    path: ['budgetMax'],
  });

export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;
