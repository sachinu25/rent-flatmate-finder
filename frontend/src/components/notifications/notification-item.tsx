"use client";

import { forwardRef } from "react";
import { BellRing, CheckCircle2, Home, MessageCircle, RefreshCw, Sparkles, XCircle } from "lucide-react";

import { timeAgo } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, { icon: typeof BellRing; tone: string }> = {
  INTEREST_RECEIVED: { icon: BellRing, tone: "bg-primary-soft text-primary" },
  INTEREST_ACCEPTED: { icon: CheckCircle2, tone: "bg-success/12 text-success" },
  INTEREST_DECLINED: { icon: XCircle, tone: "bg-destructive/10 text-destructive" },
  NEW_MESSAGE: { icon: MessageCircle, tone: "bg-primary-soft text-primary" },
  NEW_MATCH: { icon: Sparkles, tone: "bg-highlight-soft text-highlight" },
  COMPATIBILITY_COMPUTED: { icon: Sparkles, tone: "bg-highlight-soft text-highlight" },
  LISTING_UPDATED: { icon: RefreshCw, tone: "bg-warning/12 text-warning" },
  LISTING_FILLED: { icon: Home, tone: "bg-secondary text-muted-foreground" },
};

export function notificationHref(n: Notification): string {
  const m = (n.metadata ?? {}) as { conversationId?: string; listingId?: string };
  switch (n.type) {
    case "NEW_MESSAGE":
      return m.conversationId ? `/messages/${m.conversationId}` : "/messages";
    case "INTEREST_ACCEPTED":
      return m.conversationId ? `/messages/${m.conversationId}` : "/dashboard/interests";
    case "INTEREST_RECEIVED":
    case "INTEREST_DECLINED":
      return "/dashboard/interests";
    default:
      return m.listingId ? `/listings/${m.listingId}` : "/notifications";
  }
}

export const NotificationItem = forwardRef<
  HTMLButtonElement,
  { notification: Notification; onOpen: () => void; compact?: boolean; trailing?: React.ReactNode }
>(function NotificationItem({ notification: n, onOpen, compact, trailing, ...rest }, ref) {
  const { icon: Icon, tone } = ICONS[n.type] ?? { icon: BellRing, tone: "bg-secondary text-muted-foreground" };
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      {...rest}
      className={cn(
        "flex w-full items-start gap-3 text-left transition-colors hover:bg-accent",
        compact ? "px-4 py-3" : "rounded-2xl p-4",
        !n.read && "bg-primary-soft/40",
      )}
    >
      <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl", tone)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{n.title}</span>
          {!n.read && <span className="size-2 shrink-0 rounded-full bg-highlight" aria-label="Unread" />}
        </span>
        <span className={cn("mt-0.5 block text-sm text-muted-foreground", compact && "line-clamp-2")}>{n.message}</span>
        <span className="mt-1 block text-xs text-muted-foreground/80">{timeAgo(n.createdAt)}</span>
      </span>
      {trailing}
    </button>
  );
});
