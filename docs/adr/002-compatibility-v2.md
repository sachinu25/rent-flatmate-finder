# ADR-002: Compatibility engine v2 — rule-based first, AI on request

**Status**: Accepted (supersedes the "score on browse with the LLM" part of ADR-001)
**Date**: 2026-11-16
**Author**: Anumodit Shukla

## Context

ADR-001 cached scores but still called the LLM for every uncached listing on every
browse request. In practice that meant up to 50 parallel LLM calls per page, high
latency, cost spikes, and a timestamp-based staleness check that missed some input
changes. Scores also covered only budget, location and timing — not the lifestyle
factors that decide whether flatmates get along.

## Decision

1. **Two tiers of scoring**
   - *Rule-based* (`FALLBACK`): deterministic, explainable, pure CPU. Used for browse
     pages, "best match" sorting, owner-side candidate ranking and new-match
     notifications. Never calls an external service.
   - *AI analysis* (`LLM`): runs only when a tenant clicks **Run AI analysis**,
     is rate-limited per user (30/hour) and de-duplicated while in flight.
2. **Honest factors.** The rule-based scorer assesses budget (35), location (25),
   move-in timing (15) and five lifestyle factors (5 each: smoking, pets, food,
   sleep, cleanliness) plus room-type preference (5). A factor is scored only if
   *both* sides supplied the data; otherwise it is reported as "not assessed" and the
   score is normalised over assessed factors. Nothing is guessed.
3. **Content-hash cache.** `CompatibilityScore.inputHash` is a SHA-256 of every input
   the scorers read (plus a scorer version). A score is fresh iff the hash matches —
   this catches every relevant change and ignores irrelevant ones (e.g. view counts).
4. **Validated AI output.** OpenAI uses a strict JSON-schema response format; Anthropic
   uses `output_config.format` JSON-schema structured output on the Messages API.
   Every response is validated with Zod; refusals, truncation, timeouts and schema
   failures return `null` and the rule-based result is stored and labelled instead.
5. **Prompt-injection hardening.** Listing and profile data are passed inside
   delimited `<listing>` / `<tenant_profile>` blocks with an instruction to treat them
   as untrusted data. The deterministic breakdown is always stored alongside the AI
   score so the UI can show both.
6. **No protected characteristics.** Gender, religion etc. are never scoring inputs.
   Flatmate gender preference exists only as a listing search filter.

## Consequences

- Browsing costs zero AI calls; AI spend is bounded by explicit user actions.
- Scores are reproducible and explainable; AI scores are clearly labelled with the model.
- `computedVia` + `factors.ruleBasedScore` allow comparing AI and rule-based results.
- Bumping `SCORER_VERSION` in `compatibility.service.ts` invalidates all cached scores.
