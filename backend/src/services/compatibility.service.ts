import { createHash } from 'node:crypto';

import type { CompatibilityScore, Listing, Prisma, TenantProfile } from '@prisma/client';

import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

import { scoreFallback, type CompatibilityFactors } from './fallback-scorer.js';
import { aiModelName, analyzeWithLLM, isAIConfigured } from './llm.service.js';

/**
 * Compatibility orchestration.
 *
 *  Browsing (`batchGetScores`)  → cached score if inputs unchanged, otherwise an
 *                                 instant rule-based score. Never calls the AI,
 *                                 so a page of 12 listings costs zero AI calls.
 *  Deep analysis (`analyzeCompatibility`) → AI, on explicit user request, cached
 *                                 until listing or profile inputs change.
 */

/** Bump when the scoring logic changes so cached scores are recomputed. */
const SCORER_VERSION = 'v2';

export interface CompatibilityView {
  score: number;
  explanation: string;
  computedVia: 'LLM' | 'FALLBACK';
  computedAt: Date;
  factors: (CompatibilityFactors & { ruleBasedScore?: number; model?: string }) | null;
}

const LISTING_KEYS = [
  'rent', 'location', 'locality', 'availableFrom', 'roomType', 'furnishingStatus', 'amenities', 'rules',
  'smokingAllowed', 'petsAllowed', 'foodPolicy', 'householdSleepSchedule', 'householdCleanliness',
  'description', 'title', 'maxOccupants', 'deposit',
] as const;
const PROFILE_KEYS = [
  'preferredLocation', 'budgetMin', 'budgetMax', 'moveInDate', 'occupation', 'lifestyle', 'bio',
  'cleanliness', 'sleepSchedule', 'workSchedule', 'foodPreference', 'smoking', 'hasPets', 'roomSharing',
] as const;

export function inputHash(listing: Listing, profile: TenantProfile): string {
  const pick = <T extends object>(o: T, keys: readonly string[]) =>
    keys.map((k) => {
      const v = (o as Record<string, unknown>)[k];
      return v instanceof Date ? v.toISOString() : v ?? null;
    });
  return createHash('sha256')
    .update(JSON.stringify([SCORER_VERSION, pick(listing, LISTING_KEYS), pick(profile, PROFILE_KEYS)]))
    .digest('hex')
    .slice(0, 32);
}

export function toView(row: CompatibilityScore): CompatibilityView {
  return {
    score: row.score,
    explanation: row.explanation,
    computedVia: row.computedVia,
    computedAt: row.computedAt,
    factors: (row.factors as CompatibilityView['factors']) ?? null,
  };
}

function ruleBased(listing: Listing, profile: TenantProfile) {
  const r = scoreFallback(listing, profile);
  return {
    score: r.score,
    explanation: r.explanation,
    factors: { ...(r.factors as CompatibilityFactors), ruleBasedScore: r.score },
  };
}

async function save(
  tenantId: string,
  listingId: string,
  hash: string,
  data: { score: number; explanation: string; factors: object; computedVia: 'LLM' | 'FALLBACK' },
) {
  const payload = {
    score: data.score,
    explanation: data.explanation,
    factors: data.factors as Prisma.InputJsonValue,
    computedVia: data.computedVia,
    inputHash: hash,
    computedAt: new Date(),
  };
  return prisma.compatibilityScore.upsert({
    where: { tenantId_listingId: { tenantId, listingId } },
    create: { tenantId, listingId, ...payload },
    update: payload,
  });
}

/**
 * Scores for a page of listings. One read query for cached rows, rule-based
 * scoring (pure CPU) for anything missing or stale, then a single write
 * transaction.
 */
export async function batchGetScores(
  tenantId: string,
  listings: Listing[],
  profile: TenantProfile,
): Promise<Map<string, CompatibilityView>> {
  const results = new Map<string, CompatibilityView>();
  if (listings.length === 0) return results;

  const cached = await prisma.compatibilityScore.findMany({
    where: { tenantId, listingId: { in: listings.map((l) => l.id) } },
  });
  const byListing = new Map(cached.map((c) => [c.listingId, c]));

  const writes: Prisma.PrismaPromise<CompatibilityScore>[] = [];
  for (const listing of listings) {
    const hash = inputHash(listing, profile);
    const existing = byListing.get(listing.id);
    if (existing && existing.inputHash === hash) {
      results.set(listing.id, toView(existing));
      continue;
    }
    const r = ruleBased(listing, profile);
    results.set(listing.id, {
      score: r.score,
      explanation: r.explanation,
      computedVia: 'FALLBACK',
      computedAt: new Date(),
      factors: r.factors,
    });
    const payload = {
      score: r.score,
      explanation: r.explanation,
      factors: r.factors as unknown as Prisma.InputJsonValue,
      computedVia: 'FALLBACK' as const,
      inputHash: hash,
      computedAt: new Date(),
    };
    writes.push(
      prisma.compatibilityScore.upsert({
        where: { tenantId_listingId: { tenantId, listingId: listing.id } },
        create: { tenantId, listingId: listing.id, ...payload },
        update: payload,
      }),
    );
  }

  if (writes.length) {
    try {
      await prisma.$transaction(writes);
    } catch (err) {
      // Caching is an optimisation — never fail the browse request because of it.
      logger.warn({ err, tenantId }, 'Failed to cache compatibility scores');
    }
  }
  return results;
}

const inFlight = new Map<string, Promise<{ view: CompatibilityView; aiUsed: boolean }>>();

/**
 * Full AI analysis for one pair. Uses the cached AI result when inputs are
 * unchanged. Falls back to the rule-based score when AI is unavailable.
 */
export async function analyzeCompatibility(
  tenantId: string,
  listing: Listing,
  profile: TenantProfile,
): Promise<{ view: CompatibilityView; aiUsed: boolean; aiAvailable: boolean }> {
  const hash = inputHash(listing, profile);
  const aiAvailable = isAIConfigured();

  const existing = await prisma.compatibilityScore.findUnique({
    where: { tenantId_listingId: { tenantId, listingId: listing.id } },
  });
  if (existing && existing.inputHash === hash && (existing.computedVia === 'LLM' || !aiAvailable)) {
    return { view: toView(existing), aiUsed: existing.computedVia === 'LLM', aiAvailable };
  }

  const key = `${tenantId}:${listing.id}:${hash}`;
  let job = inFlight.get(key);
  if (!job) {
    job = (async () => {
      const rb = ruleBased(listing, profile);
      const ai = await analyzeWithLLM(listing, profile, rb.score);
      const row = ai
        ? await save(tenantId, listing.id, hash, {
            score: ai.score,
            explanation: ai.summary,
            computedVia: 'LLM',
            factors: {
              breakdown: rb.factors.breakdown,
              notAssessed: rb.factors.notAssessed,
              positives: ai.positives,
              conflicts: ai.conflicts,
              recommendations: ai.recommendations,
              ruleBasedScore: rb.score,
              model: aiModelName(),
            },
          })
        : await save(tenantId, listing.id, hash, { ...rb, computedVia: 'FALLBACK' });
      return { view: toView(row), aiUsed: Boolean(ai) };
    })().finally(() => inFlight.delete(key));
    inFlight.set(key, job);
  }

  const result = await job;
  return { ...result, aiAvailable };
}

/**
 * Rule-based score for a (tenant profile, listing) pair without persisting —
 * used for owner-side candidate ranking and new-match notifications.
 */
export function quickScore(listing: Listing, profile: TenantProfile) {
  return scoreFallback(listing, profile);
}
