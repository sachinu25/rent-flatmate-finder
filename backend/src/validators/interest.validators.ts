import { z } from 'zod';

export const expressInterestSchema = z.object({
  listingId: z.string().trim().min(1).max(64),
  message: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(1000).optional()),
});

export const resolveInterestSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED']),
});
