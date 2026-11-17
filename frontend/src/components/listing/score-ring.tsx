import { Sparkles } from "lucide-react";

import { scoreTone } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Circular 0–100 score. Purely presentational; accessible via aria-label. */
export function ScoreRing({
  score,
  size = 56,
  stroke = 5,
  className,
  showLabel = false,
}: {
  score: number;
  size?: number;
  stroke?: number;
  className?: string;
  showLabel?: boolean;
}) {
  const tone = scoreTone(score);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("inline-flex flex-col items-center", className)} role="img" aria-label={`Compatibility ${score} out of 100 — ${tone.label}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={cn("transition-[stroke-dashoffset] duration-700 ease-out", tone.ring)}
            style={{ strokeDasharray: c, strokeDashoffset: c - (score / 100) * c }}
          />
        </svg>
        <span className={cn("absolute inset-0 grid place-items-center font-display font-bold tabular-nums", tone.className)} style={{ fontSize: size * 0.3 }}>
          {score}
        </span>
      </div>
      {showLabel && <span className={cn("mt-1.5 text-xs font-semibold", tone.className)}>{tone.label}</span>}
    </div>
  );
}

/** Compact pill used on listing cards. */
export function MatchPill({ score, via }: { score: number; via: "LLM" | "FALLBACK" }) {
  const tone = scoreTone(score);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-xs font-bold text-stone-900 shadow-soft backdrop-blur"
      title={via === "LLM" ? "AI compatibility score" : "Rule-based compatibility score"}
    >
      {via === "LLM" && <Sparkles className="size-3 text-highlight" aria-hidden />}
      <span className={cn("size-1.5 rounded-full", tone.ring.replace("stroke-", "bg-"))} aria-hidden />
      {score}% match
    </span>
  );
}
