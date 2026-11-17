import Link from "next/link";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M8 15.2 16 8.5l8 6.7V24a1 1 0 0 1-1 1h-4.5v-5.2h-5V25H9a1 1 0 0 1-1-1v-8.8Z" fill="white" />
      <circle cx="23.5" cy="9.5" r="3.5" className="fill-highlight" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-lg", className)} aria-label="Rent & Flatmate Finder — home">
      <LogoMark />
      <span className="font-display text-[15px] font-bold leading-none tracking-tight">
        Rent<span className="text-primary">&amp;</span>Flatmate
      </span>
    </Link>
  );
}
