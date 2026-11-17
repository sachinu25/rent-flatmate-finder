"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Bot, Calculator, CheckCircle2, CircleHelp, Lightbulb, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import { scoreTone, timeAgo } from "@/lib/format";
import type { Compatibility, FactorResult } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ScoreRing } from "./score-ring";

export function FactorBar({ f }: { f: FactorResult }) {
  const pct = f.max ? Math.round((f.points / f.max) * 100) : 0;
  const color = f.status === "match" ? "bg-success" : f.status === "partial" ? "bg-warning" : "bg-destructive";
  return (
    <li>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{f.label}</span>
        <span className="tabular-nums text-muted-foreground">
          {f.points}/{f.max}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${f.label} ${pct}%`}>
        <div className={cn("h-full rounded-full transition-[width] duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
    </li>
  );
}

function ListBlock({ title, items, icon: Icon, tone }: { title: string; items: string[]; icon: typeof CheckCircle2; tone: string }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t} className="flex gap-2 text-sm leading-snug">
            <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Compatibility dashboard for one listing. Shows the cached/rule-based score
 * immediately and lets the tenant request an AI analysis explicitly — keeping
 * AI calls (and cost) to deliberate user actions.
 */
export function CompatibilityPanel({
  listingId,
  initial,
  hasProfile,
  role,
}: {
  listingId: string;
  initial: Compatibility | null;
  hasProfile: boolean;
  role: "TENANT" | "OWNER" | "ADMIN" | null;
}) {
  const [data, setData] = useState<Compatibility | null>(initial);
  const [loading, setLoading] = useState(false);

  if (role !== "TENANT") {
    return (
      <Surface className="p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-highlight-soft text-highlight">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h3 className="font-semibold">See how well you&apos;d fit here</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {role ? "Compatibility scores are available to tenant accounts." : "Sign in as a tenant to get a personalised compatibility score and AI analysis."}
            </p>
            {!role && (
              <Button asChild size="sm" className="mt-4">
                <Link href={`/register?role=TENANT&next=/listings/${listingId}`}>Get my score</Link>
              </Button>
            )}
          </div>
        </div>
      </Surface>
    );
  }

  if (!hasProfile) {
    return (
      <Surface className="p-6">
        <h3 className="font-semibold">Your compatibility score</h3>
        <p className="mt-1 text-sm text-muted-foreground">Add your budget, preferred area and lifestyle to see how well this home fits you.</p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/dashboard/profile">Complete profile</Link>
        </Button>
      </Surface>
    );
  }

  const runAI = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ compatibility: Compatibility; aiUsed: boolean; aiAvailable: boolean }>(`/compatibility/${listingId}/analyze`);
      if (res.data) {
        setData(res.data.compatibility);
        if (!res.data.aiAvailable) toast.info("AI analysis isn't configured on this server — showing the rule-based analysis.");
        else if (!res.data.aiUsed) toast.warning("The AI service didn't respond — showing the rule-based analysis instead.");
        else toast.success("AI analysis complete");
      }
    } catch (err) {
      toast.error(errorMessage(err, "Analysis failed"));
    } finally {
      setLoading(false);
    }
  };

  if (!data) return null;
  const isAI = data.computedVia === "LLM";
  const f = data.factors;
  const tone = scoreTone(data.score);

  return (
    <Surface className="overflow-hidden">
      <div className="flex flex-col gap-5 border-b border-border p-6 sm:flex-row sm:items-center">
        <ScoreRing score={data.score} size={88} stroke={7} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("font-display text-xl font-bold", tone.className)}>{tone.label}</h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                isAI ? "bg-highlight-soft text-highlight" : "bg-secondary text-muted-foreground",
              )}
            >
              {isAI ? <Bot className="size-3" /> : <Calculator className="size-3" />}
              {isAI ? `AI analysis${f?.model ? ` · ${f.model}` : ""}` : "Rule-based score"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.explanation}</p>
          <p className="mt-2 text-xs text-muted-foreground/80">
            Updated {timeAgo(data.computedAt)}
            {isAI && f?.ruleBasedScore !== undefined && ` · rule-based check: ${f.ruleBasedScore}/100`}
          </p>
        </div>
      </div>

      <div className="grid gap-8 p-6 md:grid-cols-2">
        {f && (
          <div>
            <h4 className="mb-3 text-sm font-semibold">Score breakdown</h4>
            <ul className="space-y-4">
              {f.breakdown.map((b) => <FactorBar key={b.key} f={b} />)}
            </ul>
            {f.notAssessed.length > 0 && (
              <p className="mt-4 flex gap-2 rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
                <CircleHelp className="size-4 shrink-0" aria-hidden />
                <span>
                  Not assessed (missing data): {f.notAssessed.join(", ")}. These are left out of the score rather than guessed.
                </span>
              </p>
            )}
          </div>
        )}
        <div className="space-y-6">
          <ListBlock title="What fits" items={f?.positives ?? []} icon={CheckCircle2} tone="text-success" />
          <ListBlock title="Potential conflicts" items={f?.conflicts ?? []} icon={XCircle} tone="text-destructive" />
          <ListBlock title="Recommendations" items={f?.recommendations ?? []} icon={Lightbulb} tone="text-warning" />
          {!f?.positives.length && !f?.conflicts.length && !f?.recommendations.length && (
            <p className="flex gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="size-4 shrink-0" /> No detailed factors recorded for this score.
            </p>
          )}
        </div>
      </div>

      {!isAI && (
        <div className="flex flex-col gap-3 border-t border-border bg-secondary/50 p-5 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-muted-foreground">
            Get a deeper read — the AI also considers the description, your bio and free-text lifestyle notes.
          </p>
          <Button onClick={() => void runAI()} loading={loading} variant="highlight">
            {!loading && <Sparkles />} {loading ? "Analysing…" : "Run AI analysis"}
          </Button>
        </div>
      )}
    </Surface>
  );
}
