import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// ── Badge ───────────────────────────────────────────────────────────────────
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary-soft text-primary",
        neutral: "bg-secondary text-secondary-foreground",
        outline: "border border-border text-muted-foreground",
        success: "bg-success/12 text-success",
        warning: "bg-warning/12 text-warning",
        destructive: "bg-destructive/12 text-destructive",
        highlight: "bg-highlight-soft text-highlight",
        glass: "bg-black/45 text-white backdrop-blur-md",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// ── Skeleton ────────────────────────────────────────────────────────────────
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton rounded-lg", className)} {...props} />;
}

// ── Surface (card) ──────────────────────────────────────────────────────────
export function Surface({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-card text-card-foreground shadow-soft", className)} {...props} />;
}

// ── Empty state ─────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center", className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Error state ─────────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <p className="text-sm font-medium text-destructive">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 text-sm font-semibold text-foreground underline underline-offset-4">
          Try again
        </button>
      )}
    </div>
  );
}

// ── Page header ─────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground sm:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ── Stat card ───────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  tone?: "default" | "highlight" | "success" | "warning";
}) {
  const tones = {
    default: "bg-primary-soft text-primary",
    highlight: "bg-highlight-soft text-highlight",
    success: "bg-success/12 text-success",
    warning: "bg-warning/12 text-warning",
  };
  return (
    <Surface className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn("grid size-9 place-items-center rounded-xl", tones[tone])}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Surface>
  );
}

// ── Chip toggle ─────────────────────────────────────────────────────────────
export function Chip({
  selected,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors [&_svg]:size-3.5",
        selected
          ? "border-primary bg-primary-soft text-primary"
          : "border-border bg-card text-foreground hover:border-foreground/30",
        className,
      )}
      {...props}
    />
  );
}
