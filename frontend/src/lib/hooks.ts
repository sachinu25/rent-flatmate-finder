"use client";

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Recently viewed (per-browser convenience, never authoritative) ──────────
export interface RecentListing {
  id: string;
  title: string;
  location: string;
  rent: number;
  photo: string | null;
  viewedAt: number;
}

const RECENT_KEY = "rff_recently_viewed";

export function readRecent(): RecentListing[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentListing[]) : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: Omit<RecentListing, "viewedAt">) {
  try {
    const list = readRecent().filter((r) => r.id !== item.id);
    list.unshift({ ...item, viewedAt: Date.now() });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* storage unavailable */
  }
}
