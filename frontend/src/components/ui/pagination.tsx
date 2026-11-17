"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

function pages(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const btn = "grid size-10 place-items-center rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none";
  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <button className={cn(btn, "hover:bg-accent")} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="size-4" />
      </button>
      {pages(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(btn, p === page ? "bg-foreground text-background" : "hover:bg-accent")}
          >
            {p}
          </button>
        ),
      )}
      <button className={cn(btn, "hover:bg-accent")} onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
