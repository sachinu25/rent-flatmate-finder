import { z } from 'zod';

/**
 * Listing validators. Create/update arrive as multipart/form-data, so every
 * field may be a string: values are coerced and empty strings normalised.
 */

const ROOM_TYPES = ['SINGLE', 'DOUBLE', 'SHARED', 'STUDIO', 'APARTMENT'] as const;
const FURNISHING = ['FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED'] as const;
const FOOD = ['VEGETARIAN', 'NON_VEGETARIAN', 'VEGAN', 'EGGETARIAN', 'NO_PREFERENCE'] as const;
const SLEEP = ['EARLY_BIRD', 'NIGHT_OWL', 'FLEXIBLE'] as const;
const GENDER = ['ANY', 'MALE', 'FEMALE'] as const;

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' || v === 'null' ? null : v);

/** Accepts a JSON array string, a comma list, or an array. Never throws. */
const stringList = (max: number) =>
  z.preprocess((v) => {
    if (Array.isArray(v)) return v as unknown[];
    if (typeof v !== 'string' || v.trim() === '') return [];
    try {
      const parsed = JSON.parse(v) as unknown;
      return Array.isArray(parsed) ? (parsed as unknown[]) : [String(parsed)];
    } catch {
      return v.split(',');
    }
  }, z.array(z.string().trim().min(1).max(60)).max(max).transform((a) => [...new Set(a.map((s) => s.toLowerCase()))]));

const nullableBool = z.preprocess(
  (v) => (v === '' || v === 'null' || v === undefined ? null : v === true || v === 'true' ? true : v === false || v === 'false' ? false : v),
  z.boolean().nullable(),
);

const listingFields = {
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20, 'Description must be at least 20 characters').max(5000),
  location: z.string().trim().min(2).max(80),
  locality: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
  address: z.preprocess(emptyToNull, z.string().trim().max(300).nullable()),
  rent: z.coerce.number().int().min(500, 'Rent looks too low').max(10_000_000),
  deposit: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(100_000_000).nullable()),
  availableFrom: z.coerce.date(),
  roomType: z.enum(ROOM_TYPES),
  furnishingStatus: z.enum(FURNISHING),
  amenities: stringList(30),
  rules: stringList(20),
  maxOccupants: z.coerce.number().int().min(1).max(20),
  genderPreference: z.preprocess(emptyToUndefined, z.enum(GENDER)),
  petsAllowed: nullableBool,
  smokingAllowed: nullableBool,
  foodPolicy: z.preprocess(emptyToNull, z.enum(FOOD).nullable()),
  householdSleepSchedule: z.preprocess(emptyToNull, z.enum(SLEEP).nullable()),
  householdCleanliness: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(5).nullable()),
};

export const createListingSchema = z.object({
  ...listingFields,
  locality: listingFields.locality.optional(),
  address: listingFields.address.optional(),
  deposit: listingFields.deposit.optional(),
  amenities: listingFields.amenities.default([]),
  rules: listingFields.rules.default([]),
  maxOccupants: listingFields.maxOccupants.default(1),
  genderPreference: z.preprocess(emptyToUndefined, z.enum(GENDER).default('ANY')),
  petsAllowed: nullableBool.optional(),
  smokingAllowed: nullableBool.optional(),
  foodPolicy: listingFields.foodPolicy.optional(),
  householdSleepSchedule: listingFields.householdSleepSchedule.optional(),
  householdCleanliness: listingFields.householdCleanliness.optional(),
});

export const updateListingSchema = z
  .object(listingFields)
  .partial()
  .extend({
    /** Comma/JSON list of photo ids in the desired display order. */
    photoOrder: stringList(20).optional(),
  });

export const listingStatusSchema = z.object({ status: z.enum(['ACTIVE', 'FILLED']) });

const SORTS = ['newest', 'rent_asc', 'rent_desc', 'available_soonest', 'match'] as const;

export const listingQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  location: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  city: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  locality: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  minRent: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  maxRent: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  roomType: z.preprocess(emptyToUndefined, z.enum(ROOM_TYPES).optional()),
  furnishingStatus: z.preprocess(emptyToUndefined, z.enum(FURNISHING).optional()),
  genderPreference: z.preprocess(emptyToUndefined, z.enum(GENDER).optional()),
  amenities: z.preprocess(
    (v) => (typeof v === 'string' && v ? v.split(',') : Array.isArray(v) ? v : undefined),
    z.array(z.string().trim().toLowerCase().min(1).max(60)).max(10).optional(),
  ),
  availableBy: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  sort: z.preprocess(emptyToUndefined, z.enum(SORTS).default('newest')),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  includeFilled: z.preprocess((v) => v === 'true', z.boolean().default(false)),
});

export type ListingQuery = z.infer<typeof listingQuerySchema>;
