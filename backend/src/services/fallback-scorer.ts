import type { Listing, TenantProfile } from '@prisma/client';

/**
 * Deterministic, explainable compatibility scorer.
 *
 * Used (a) for instant scores while browsing, (b) as the fallback whenever the
 * AI provider is unavailable, and (c) as a transparent breakdown shown next to
 * AI scores.
 *
 * Weights (max points):
 *   budget 35 · location 25 · move-in timing 15
 *   smoking 5 · pets 5 · food 5 · sleep 5 · cleanliness 5 · room type 5
 *
 * Honesty rule: a factor is only scored when BOTH sides provided the data.
 * Unknown factors are excluded and the final score is normalised over the
 * factors that were actually assessed — nothing is guessed.
 */

export type FactorStatus = 'match' | 'partial' | 'conflict';

export interface FactorResult {
  key: string;
  label: string;
  points: number;
  max: number;
  status: FactorStatus;
  detail: string;
}

export interface CompatibilityFactors {
  breakdown: FactorResult[];
  notAssessed: string[];
  positives: string[];
  conflicts: string[];
  recommendations: string[];
}

export interface ScoringResult {
  score: number;
  explanation: string;
  factors?: CompatibilityFactors;
}

const WEIGHTS = { budget: 35, location: 25, timing: 15, lifestyle: 5 } as const;

// ── Core sub-scores (stable scales, covered by unit tests) ───────────────────

/** Budget score on a 0–50 scale. */
export function computeBudgetScore(rent: number, budgetMin: number, budgetMax: number): number {
  if (budgetMax <= 0) return 0;

  if (rent >= budgetMin && rent <= budgetMax) {
    const range = budgetMax - budgetMin;
    if (range === 0) return 50;
    const position = (rent - budgetMin) / range;
    return Math.round(50 - position * 15);
  }

  const distance = rent < budgetMin ? budgetMin - rent : rent - budgetMax;
  const midpoint = (budgetMin + budgetMax) / 2 || 1;
  const ratio = distance / midpoint;

  if (ratio <= 0.1) return 30;
  if (ratio <= 0.25) return 20;
  if (ratio <= 0.5) return 10;
  return 0;
}

/** Location score on a 0–35 scale (case-insensitive, partial matching). */
export function computeLocationScore(listingLocation: string, preferredLocation: string): number {
  const a = listingLocation.toLowerCase().trim();
  const b = preferredLocation.toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 35;
  if (a.includes(b) || b.includes(a)) return 20;
  return 0;
}

/** Timing score on a 0–15 scale. */
export function computeTimingScore(availableFrom: Date, moveInDate: Date): number {
  const diffDays = (new Date(availableFrom).getTime() - new Date(moveInDate).getTime()) / 86_400_000;
  if (diffDays <= 0) return 15;
  if (diffDays <= 14) return 10;
  if (diffDays <= 30) return 5;
  return 0;
}

// ── Household policy helpers (explicit field wins, then free-text rules) ─────

const hasRule = (rules: string[], ...needles: string[]) =>
  rules.some((r) => needles.some((n) => r.toLowerCase().includes(n)));

export function resolveSmokingAllowed(listing: Pick<Listing, 'smokingAllowed' | 'rules'>): boolean | null {
  if (listing.smokingAllowed !== null && listing.smokingAllowed !== undefined) return listing.smokingAllowed;
  if (hasRule(listing.rules, 'no-smoking', 'no smoking', 'non-smoking')) return false;
  return null;
}

export function resolvePetsAllowed(listing: Pick<Listing, 'petsAllowed' | 'rules'>): boolean | null {
  if (listing.petsAllowed !== null && listing.petsAllowed !== undefined) return listing.petsAllowed;
  if (hasRule(listing.rules, 'no-pets', 'no pets')) return false;
  if (hasRule(listing.rules, 'pet-friendly', 'pets-allowed', 'pets allowed')) return true;
  return null;
}

export function resolveVegOnly(listing: Pick<Listing, 'foodPolicy' | 'rules'>): boolean | null {
  if (listing.foodPolicy) return listing.foodPolicy === 'VEGETARIAN' || listing.foodPolicy === 'VEGAN';
  if (hasRule(listing.rules, 'vegetarian')) return true;
  return null;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function factor(
  key: string,
  label: string,
  points: number,
  max: number,
  detail: string,
): FactorResult {
  const ratio = max === 0 ? 0 : points / max;
  const status: FactorStatus = ratio >= 0.8 ? 'match' : ratio >= 0.4 ? 'partial' : 'conflict';
  return { key, label, points: Math.round(points * 10) / 10, max, status, detail };
}

// ── Main scorer ──────────────────────────────────────────────────────────────

export function scoreFallback(listing: Listing, profile: TenantProfile): ScoringResult {
  const breakdown: FactorResult[] = [];
  const notAssessed: string[] = [];
  const recommendations: string[] = [];

  // Budget
  const budget = computeBudgetScore(listing.rent, profile.budgetMin, profile.budgetMax);
  breakdown.push(
    factor(
      'budget',
      'Budget',
      (budget / 50) * WEIGHTS.budget,
      WEIGHTS.budget,
      listing.rent <= profile.budgetMax && listing.rent >= profile.budgetMin
        ? `Rent ${fmt(listing.rent)} is within your ${fmt(profile.budgetMin)}–${fmt(profile.budgetMax)} budget`
        : listing.rent > profile.budgetMax
          ? `Rent ${fmt(listing.rent)} is ${fmt(listing.rent - profile.budgetMax)} above your maximum budget`
          : `Rent ${fmt(listing.rent)} is below your minimum budget`,
    ),
  );
  if (listing.rent > profile.budgetMax && budget > 0) {
    recommendations.push('Rent is slightly above budget — consider asking the owner whether it is negotiable.');
  }

  // Location (city or locality)
  const location = Math.max(
    computeLocationScore(listing.location, profile.preferredLocation),
    listing.locality ? computeLocationScore(listing.locality, profile.preferredLocation) : 0,
  );
  const place = [listing.locality, listing.location].filter(Boolean).join(', ');
  breakdown.push(
    factor(
      'location',
      'Location',
      (location / 35) * WEIGHTS.location,
      WEIGHTS.location,
      location >= 35
        ? `${place} matches your preferred location`
        : location > 0
          ? `${place} partially matches “${profile.preferredLocation}”`
          : `${place} is outside your preferred location “${profile.preferredLocation}”`,
    ),
  );

  // Timing
  const timing = computeTimingScore(listing.availableFrom, profile.moveInDate);
  const availDate = new Date(listing.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  breakdown.push(
    factor(
      'timing',
      'Move-in date',
      timing,
      WEIGHTS.timing,
      timing === 15
        ? `Available from ${availDate}, on or before your move-in date`
        : timing > 0
          ? `Available from ${availDate}, shortly after your move-in date`
          : `Available from ${availDate}, well after your move-in date`,
    ),
  );
  if (timing > 0 && timing < 15) recommendations.push('Ask the owner whether an earlier move-in is possible.');

  // Smoking
  const smokingAllowed = resolveSmokingAllowed(listing);
  if (profile.smoking && smokingAllowed !== null) {
    if (profile.smoking === 'NON_SMOKER') {
      breakdown.push(
        factor('smoking', 'Smoking', smokingAllowed ? 3 : 5, 5, smokingAllowed
          ? 'Smoking is permitted in this household; you are a non-smoker'
          : 'Smoke-free household suits a non-smoker'),
      );
    } else {
      breakdown.push(
        factor('smoking', 'Smoking', smokingAllowed ? 5 : 0, 5, smokingAllowed
          ? 'Smoking is permitted'
          : 'This household does not allow smoking'),
      );
    }
  } else {
    notAssessed.push('Smoking');
  }

  // Pets (only relevant when the tenant has pets)
  if (profile.hasPets === true) {
    const petsAllowed = resolvePetsAllowed(listing);
    if (petsAllowed === null) {
      notAssessed.push('Pets');
      recommendations.push('The pet policy is not specified — confirm with the owner before moving in.');
    } else {
      breakdown.push(
        factor('pets', 'Pets', petsAllowed ? 5 : 0, 5, petsAllowed ? 'Pets are welcome' : 'Pets are not allowed here'),
      );
    }
  } else if (profile.hasPets === null || profile.hasPets === undefined) {
    notAssessed.push('Pets');
  }

  // Food
  const vegOnly = resolveVegOnly(listing);
  if (profile.foodPreference && profile.foodPreference !== 'NO_PREFERENCE' && vegOnly !== null) {
    const tenantVeg = profile.foodPreference === 'VEGETARIAN' || profile.foodPreference === 'VEGAN';
    if (vegOnly && !tenantVeg) {
      breakdown.push(factor('food', 'Food', 0, 5, 'Household kitchen is vegetarian-only'));
    } else {
      breakdown.push(factor('food', 'Food', 5, 5, vegOnly ? 'Vegetarian household suits your diet' : 'No food restrictions in this household'));
    }
  } else {
    notAssessed.push('Food');
  }

  // Sleep schedule
  if (profile.sleepSchedule && listing.householdSleepSchedule) {
    const same =
      profile.sleepSchedule === listing.householdSleepSchedule ||
      profile.sleepSchedule === 'FLEXIBLE' ||
      listing.householdSleepSchedule === 'FLEXIBLE';
    breakdown.push(
      factor('sleep', 'Sleep schedule', same ? 5 : 1, 5, same
        ? 'Sleep schedules are compatible'
        : 'Household keeps a different sleep schedule'),
    );
    if (!same) recommendations.push('Discuss quiet hours with the household before committing.');
  } else {
    notAssessed.push('Sleep schedule');
  }

  // Cleanliness
  if (profile.cleanliness && listing.householdCleanliness) {
    const diff = Math.abs(profile.cleanliness - listing.householdCleanliness);
    const pts = [5, 4, 2, 0, 0][diff] ?? 0;
    breakdown.push(
      factor('cleanliness', 'Cleanliness', pts, 5, diff === 0
        ? 'Same cleanliness standards'
        : diff === 1
          ? 'Similar cleanliness standards'
          : 'Noticeably different cleanliness standards'),
    );
    if (diff >= 2) recommendations.push('Agree on a cleaning rota early to avoid friction.');
  } else {
    notAssessed.push('Cleanliness');
  }

  // Room-sharing preference vs room type
  if (profile.roomSharing) {
    const rt = listing.roomType;
    const table: Record<string, Record<string, number>> = {
      PRIVATE_ROOM: { SINGLE: 5, STUDIO: 5, APARTMENT: 5, DOUBLE: 3, SHARED: 0 },
      SHARED_ROOM: { SHARED: 5, DOUBLE: 5, SINGLE: 3, STUDIO: 3, APARTMENT: 3 },
      ENTIRE_PLACE: { APARTMENT: 5, STUDIO: 5, SINGLE: 2, DOUBLE: 1, SHARED: 0 },
      NO_PREFERENCE: { SINGLE: 5, DOUBLE: 5, SHARED: 5, STUDIO: 5, APARTMENT: 5 },
    };
    const pts = table[profile.roomSharing]?.[rt] ?? 3;
    breakdown.push(
      factor('room', 'Room type', pts, 5, pts >= 4
        ? 'Room type fits your sharing preference'
        : 'Room type differs from your sharing preference'),
    );
  } else {
    notAssessed.push('Room type');
  }

  if ((profile.workSchedule === 'REMOTE' || profile.workSchedule === 'HYBRID') && listing.roomType === 'SHARED') {
    recommendations.push('You work from home — check whether a shared room leaves you a quiet place to work.');
  }

  const totalMax = breakdown.reduce((s, f) => s + f.max, 0);
  const totalPts = breakdown.reduce((s, f) => s + f.points, 0);
  const score = Math.round(Math.min(100, Math.max(0, totalMax ? (totalPts / totalMax) * 100 : 0)));

  const positives = breakdown.filter((f) => f.status === 'match').map((f) => f.detail);
  const conflicts = breakdown.filter((f) => f.status === 'conflict').map((f) => f.detail);
  if (notAssessed.length >= 4) {
    recommendations.push('Complete the lifestyle section of your profile for a more accurate match.');
  }

  const summary =
    score >= 75
      ? 'Strong match on the factors we could assess.'
      : score >= 50
        ? 'Reasonable match with a few trade-offs.'
        : 'Weak match on the factors we could assess.';

  const highlights = [...positives.slice(0, 2), ...conflicts.slice(0, 2)];
  return {
    score,
    explanation: highlights.length ? `${summary} ${highlights.join('. ')}.` : summary,
    factors: { breakdown, notAssessed, positives, conflicts, recommendations },
  };
}
