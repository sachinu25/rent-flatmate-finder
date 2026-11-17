"use client";

import Link from "next/link";
import { Bot, Calculator, CircleHelp, MapPin, Sparkles } from "lucide-react";

import { ListingImage } from "@/components/listing/listing-image";
import { ScoreRing } from "@/components/listing/score-ring";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Skeleton, Surface } from "@/components/ui/primitives";
import { formatCurrency, ROOM_TYPE_LABEL } from "@/lib/format";
import type { Compatibility, Listing } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type Match = Listing & { compatibility: Compatibility | null };

export default function MatchesPage() {
  const { data, error, loading, reload } = useApi<{ matches: Match[]; aiAvailable: boolean }>("/compatibility/matches");
  const needsProfile = error?.toLowerCase().includes("profile");

  const matches = data?.matches ?? [];
  const tiers = {
    excellent: matches.filter((m) => (m.compatibility?.score ?? 0) >= 80).length,
    good: matches.filter((m) => {
      const s = m.compatibility?.score ?? 0;
      return s >= 60 && s < 80;
    }).length,
    other: matches.filter((m) => (m.compatibility?.score ?? 0) < 60).length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Compatibility"
        title="Your matches"
        description="Active homes near your preferred area, ranked by how well they fit your budget, timing and lifestyle."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/profile">Edit preferences</Link>
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : needsProfile ? (
        <EmptyState
          icon={Sparkles}
          title="Complete your profile first"
          description="We need your budget, preferred area and move-in date to calculate compatibility."
          action={<Button asChild><Link href="/dashboard/profile">Add preferences</Link></Button>}
        />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No active homes in your area yet"
          description="Try a broader preferred location (e.g. the city rather than a neighbourhood) or a higher budget."
          action={<Button asChild variant="outline"><Link href="/listings">Browse all homes</Link></Button>}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
            {[
              { label: "Excellent (80+)", value: tiers.excellent, tone: "text-success" },
              { label: "Good (60–79)", value: tiers.good, tone: "text-primary" },
              { label: "Below 60", value: tiers.other, tone: "text-muted-foreground" },
            ].map((t) => (
              <Surface key={t.label} className="p-4 text-center sm:p-5">
                <p className={cn("font-display text-2xl font-bold sm:text-3xl", t.tone)}>{t.value}</p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t.label}</p>
              </Surface>
            ))}
          </div>

          <p className="mb-4 flex items-start gap-2 text-xs text-muted-foreground">
            <CircleHelp className="mt-0.5 size-3.5 shrink-0" />
            Scores marked <Calculator className="inline size-3" /> are instant rule-based scores. Open a home and choose
            {data?.aiAvailable ? " “Run AI analysis”" : " AI analysis (when enabled)"} for a deeper read marked <Bot className="inline size-3" />.
          </p>

          <ol className="space-y-4">
            {matches.map((m, i) => {
              const c = m.compatibility;
              const breakdown = c?.factors?.breakdown ?? [];
              return (
                <li key={m.id}>
                  <Link href={`/listings/${m.id}`} className="group block">
                    <Surface className="flex flex-col overflow-hidden transition-shadow group-hover:shadow-lift sm:flex-row">
                      <div className="relative aspect-[16/9] w-full shrink-0 bg-muted sm:aspect-auto sm:w-64">
                        <ListingImage src={m.photos[0]?.url} alt={m.title} fill sizes="(min-width: 640px) 256px, 100vw" />
                        <span className="absolute left-3 top-3 grid size-8 place-items-center rounded-full bg-black/60 text-sm font-bold text-white backdrop-blur">
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-4 p-5 sm:flex-row">
                        <div className="min-w-0 flex-1">
                          <h2 className="font-semibold group-hover:text-primary">{m.title}</h2>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {[m.locality, m.location].filter(Boolean).join(", ")} · {ROOM_TYPE_LABEL[m.roomType]} ·{" "}
                            <span className="font-semibold text-foreground">{formatCurrency(m.rent)}/mo</span>
                          </p>
                          {c && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.explanation}</p>}
                          {breakdown.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {breakdown.map((f) => (
                                <span
                                  key={f.key}
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                    f.status === "match" && "bg-success/12 text-success",
                                    f.status === "partial" && "bg-warning/12 text-warning",
                                    f.status === "conflict" && "bg-destructive/10 text-destructive",
                                  )}
                                >
                                  {f.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {c && (
                          <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:justify-center">
                            <ScoreRing score={c.score} size={72} stroke={6} />
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                              {c.computedVia === "LLM" ? <Bot className="size-3" /> : <Calculator className="size-3" />}
                              {c.computedVia === "LLM" ? "AI" : "Rule-based"}
                            </span>
                          </div>
                        )}
                      </div>
                    </Surface>
                  </Link>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </>
  );
}
