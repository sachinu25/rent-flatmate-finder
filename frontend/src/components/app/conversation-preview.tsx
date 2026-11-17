"use client";

import Link from "next/link";

import { UserAvatar } from "@/components/ui/overlays";
import { useRealtime } from "@/contexts/realtime-context";
import { timeAgo } from "@/lib/format";
import type { ConversationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ConversationRow({
  c,
  active = false,
  currentUserId,
}: {
  c: ConversationSummary;
  active?: boolean;
  currentUserId?: string;
}) {
  const { online } = useRealtime();
  const isOnline = online[c.otherUser.id] ?? c.otherUser.online;
  const mine = c.lastMessage?.senderId === currentUserId;
  return (
    <Link
      href={`/messages/${c.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-2xl p-3 transition-colors",
        active ? "bg-primary-soft" : "hover:bg-accent",
      )}
    >
      <UserAvatar firstName={c.otherUser.firstName} lastName={c.otherUser.lastName} src={c.otherUser.avatarUrl} online={isOnline} className="size-11" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn("truncate text-sm", c.unreadCount ? "font-bold" : "font-semibold")}>
            {c.otherUser.firstName} {c.otherUser.lastName}
          </p>
          {c.lastMessage && <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(c.lastMessage.createdAt)}</span>}
        </div>
        <p className="truncate text-xs text-muted-foreground">{c.listing.title}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className={cn("flex-1 truncate text-[13px]", c.unreadCount ? "font-medium text-foreground" : "text-muted-foreground")}>
            {c.lastMessage ? `${mine ? "You: " : ""}${c.lastMessage.content}` : "Say hello 👋"}
          </p>
          {c.unreadCount > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-highlight px-1.5 text-[11px] font-bold leading-5 text-highlight-foreground">
              {c.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
