import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Only allow same-site relative redirect targets ("/dashboard"), never
 * protocol-relative ("//evil.com") or absolute URLs — prevents open redirects.
 */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export function homeFor(role: "TENANT" | "OWNER" | "ADMIN") {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}
