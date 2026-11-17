"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Search } from "lucide-react";

import { ConversationRow } from "@/components/app/conversation-preview";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/auth-context";
import { useRealtime } from "@/contexts/realtime-context";
import type { ChatMessage, ConversationSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** Live conversation list: updates last message / unread count from socket events. */
export function ConversationList({ activeId }: { activeId?: string }) {
  const { user } = useAuth();
  const { socket } = useRealtime();
  const { data, error, loading, reload, setData } = useApi<{ conversations: ConversationSummary[] }>("/chat/conversations");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!socket) return;
    const onActivity = (m: ChatMessage & { conversationId: string }) => {
      setData((d) => {
        if (!d) return d;
        const exists = d.conversations.some((c) => c.id === m.conversationId);
        if (!exists) {
          reload();
          return d;
        }
        const updated = d.conversations.map((c) =>
          c.id === m.conversationId
            ? {
                ...c,
                lastMessage: m,
                updatedAt: m.createdAt,
                unreadCount: m.senderId !== user?.id && m.conversationId !== activeId ? c.unreadCount + 1 : c.unreadCount,
              }
            : c,
        );
        updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return { conversations: updated };
      });
    };
    socket.on("chat:activity", onActivity);
    return () => {
      socket.off("chat:activity", onActivity);
    };
  }, [socket, setData, reload, user?.id, activeId]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    // The open conversation is being read, so it never shows an unread badge.
    const all = (data?.conversations ?? []).map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c));
    if (!q) return all;
    return all.filter((c) => `${c.otherUser.firstName} ${c.otherUser.lastName} ${c.listing.title}`.toLowerCase().includes(q));
  }, [data, query, activeId]);

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <label className="relative block">
          <span className="sr-only">Search conversations</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
          />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <div className="space-y-2 p-1">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title={query ? "No matches" : "No conversations yet"}
            description={query ? undefined : user?.role === "OWNER" ? "Accept a tenant request to start chatting." : "Chats open when an owner accepts your request."}
            className="m-2 border-0"
          />
        ) : (
          <ul className="space-y-0.5">
            {list.map((c) => (
              <li key={c.id}>
                <ConversationRow c={c} active={c.id === activeId} currentUserId={user?.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
