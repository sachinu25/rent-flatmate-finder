"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Check, CheckCheck, Clock, Loader2, RotateCw, SendHorizontal, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/overlays";
import { ErrorState, Skeleton } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/auth-context";
import { useRealtime } from "@/contexts/realtime-context";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_LEN = 2000;

interface ConversationInfo {
  id: string;
  listing: { id: string; title: string };
  otherUser: { id: string; firstName: string; lastName: string; avatarUrl?: string | null; online: boolean } | null;
}

type SendAck = { ok: boolean; error?: string; message?: ChatMessage };

function dayLabel(d: string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatDate(date, { weekday: "short", day: "numeric", month: "short" });
}

export function ChatThread({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const { socket, connected, online, setActiveConversation } = useRealtime();
  const [info, setInfo] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // ── Initial load ──
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<{ conversation: ConversationInfo }>(`/chat/${conversationId}`),
      api.get<{ messages: ChatMessage[]; hasMore: boolean; nextCursor: string | null }>(`/chat/${conversationId}/messages?limit=30`),
    ])
      .then(([c, m]) => {
        if (cancelled) return;
        setInfo(c.data?.conversation ?? null);
        setMessages(m.data?.messages ?? []);
        setHasMore(Boolean(m.data?.hasMore));
        setCursor(m.data?.nextCursor ?? null);
        stickToBottom.current = true;
      })
      .catch((err) => !cancelled && setError(errorMessage(err, "This conversation isn't available")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // ── Socket: join room + live events ──
  useEffect(() => {
    if (!socket || !user) return;
    setActiveConversation(conversationId);

    const join = () => socket.emit("join:conversation", conversationId);
    if (socket.connected) join();
    socket.on("connect", join);

    const onMessage = (m: ChatMessage) => {
      if (m.conversationId !== conversationId) return;
      setMessages((prev) => {
        if (m.tempId && prev.some((p) => p.tempId === m.tempId)) {
          return prev.map((p) => (p.tempId === m.tempId ? { ...m, pending: false, failed: false } : p));
        }
        if (prev.some((p) => p.id === m.id)) return prev;
        return [...prev, m];
      });
      if (m.senderId !== user.id) {
        setTyping(false);
        if (document.visibilityState === "visible") socket.emit("messages:markRead", conversationId);
      }
    };
    const onRead = (p: { conversationId: string; readBy: string; readAt: string }) => {
      if (p.conversationId !== conversationId || p.readBy === user.id) return;
      setMessages((prev) => prev.map((m) => (m.senderId === user.id && !m.readAt ? { ...m, readAt: p.readAt } : m)));
    };
    const onTypingStart = (p: { userId: string; conversationId: string }) => {
      if (p.conversationId !== conversationId || p.userId === user.id) return;
      setTyping(true);
      if (remoteTypingTimer.current) clearTimeout(remoteTypingTimer.current);
      remoteTypingTimer.current = setTimeout(() => setTyping(false), 5000);
    };
    const onTypingStop = (p: { conversationId: string }) => p.conversationId === conversationId && setTyping(false);
    const onVisible = () => document.visibilityState === "visible" && socket.emit("messages:markRead", conversationId);

    socket.on("message:new", onMessage);
    socket.on("messages:read", onRead);
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      socket.emit("leave:conversation", conversationId);
      socket.off("connect", join);
      socket.off("message:new", onMessage);
      socket.off("messages:read", onRead);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
      document.removeEventListener("visibilitychange", onVisible);
      setActiveConversation(null);
    };
  }, [socket, user, conversationId, setActiveConversation]);

  // ── Scrolling ──
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, typing, loading]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const loadOlder = async () => {
    if (!cursor || loadingOlder) return;
    const el = scroller.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setLoadingOlder(true);
    stickToBottom.current = false;
    try {
      const res = await api.get<{ messages: ChatMessage[]; hasMore: boolean; nextCursor: string | null }>(
        `/chat/${conversationId}/messages?limit=30&cursor=${encodeURIComponent(cursor)}`,
      );
      setMessages((m) => [...(res.data?.messages ?? []), ...m]);
      setHasMore(Boolean(res.data?.hasMore));
      setCursor(res.data?.nextCursor ?? null);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  };

  // ── Sending ──
  const stopTyping = useCallback(() => {
    if (isTyping.current) {
      socket?.emit("typing:stop", conversationId);
      isTyping.current = false;
    }
  }, [socket, conversationId]);

  const emitSend = useCallback(
    (tempId: string, content: string) => {
      if (!socket) return;
      socket.timeout(10_000).emit("message:send", { conversationId, content, tempId }, (err: Error | null, ack?: SendAck) => {
        if (err || !ack?.ok) {
          setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...m, pending: false, failed: true } : m)));
          return;
        }
        if (ack.message) {
          setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...ack.message!, pending: false, failed: false } : m)));
        }
      });
    },
    [socket, conversationId],
  );

  const send = () => {
    const content = input.trim();
    if (!content || !user || !connected) return;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    stickToBottom.current = true;
    setMessages((prev) => [
      ...prev,
      { id: tempId, tempId, senderId: user.id, content, readAt: null, createdAt: new Date().toISOString(), pending: true },
    ]);
    setInput("");
    stopTyping();
    emitSend(tempId, content);
    requestAnimationFrame(() => textarea.current?.focus());
  };

  const retry = (m: ChatMessage) => {
    if (!m.tempId) return;
    setMessages((prev) => prev.map((x) => (x.tempId === m.tempId ? { ...x, pending: true, failed: false } : x)));
    emitSend(m.tempId, m.content);
  };

  const onInput = (v: string) => {
    setInput(v.slice(0, MAX_LEN));
    if (!socket) return;
    if (!isTyping.current && v.trim()) {
      socket.emit("typing:start", conversationId);
      isTyping.current = true;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 2500);
  };

  // Auto-grow textarea
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <ErrorState message={error} />
          <Button asChild variant="outline" className="mt-4 w-full"><Link href="/messages">Back to messages</Link></Button>
        </div>
      </div>
    );
  }

  const other = info?.otherUser;
  const otherOnline = other ? (online[other.id] ?? other.online) : false;
  const lastMineIndex = messages.map((m) => m.senderId).lastIndexOf(user?.id ?? "");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-3 sm:px-5">
        <Link href="/messages" className="grid size-9 place-items-center rounded-lg hover:bg-accent md:hidden" aria-label="Back to conversations">
          <ArrowLeft className="size-5" />
        </Link>
        {loading || !other ? (
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <>
            <UserAvatar firstName={other.firstName} lastName={other.lastName} src={other.avatarUrl} online={otherOnline} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{other.firstName} {other.lastName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {typing ? <span className="text-primary">typing…</span> : otherOnline ? "Online" : "Offline"} ·{" "}
                <Link href={`/listings/${info?.listing.id}`} className="hover:underline">{info?.listing.title}</Link>
              </p>
            </div>
          </>
        )}
        {!connected && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/12 px-2.5 py-1 text-xs font-semibold text-warning" role="status">
            <WifiOff className="size-3.5" /> Reconnecting…
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-4 sm:px-6" aria-live="polite" aria-label="Messages">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className={cn("h-12 w-2/3 rounded-2xl", i % 2 && "ml-auto")} />)}
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="mb-4 flex justify-center">
                <Button variant="ghost" size="sm" onClick={() => void loadOlder()} loading={loadingOlder}>Load earlier messages</Button>
              </div>
            )}
            {messages.length === 0 && (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Say hello 👋</p>
                <p className="mt-1">Introduce yourself and suggest a time to visit.</p>
              </div>
            )}
            <ol className="space-y-1.5">
              {messages.map((m, i) => {
                const mine = m.senderId === user?.id;
                const prev = messages[i - 1];
                const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                const grouped = prev && !newDay && prev.senderId === m.senderId;
                return (
                  <Fragment key={m.tempId ?? m.id}>
                    {newDay && (
                      <li className="py-3 text-center" aria-hidden>
                        <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground">{dayLabel(m.createdAt)}</span>
                      </li>
                    )}
                    <li className={cn("flex", mine ? "justify-end" : "justify-start", !grouped && "pt-2")}>
                      <div className={cn("max-w-[82%] sm:max-w-[70%]", mine && "items-end")}>
                        <div
                          className={cn(
                            "whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                            mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary text-secondary-foreground",
                            m.pending && "opacity-70",
                            m.failed && "bg-destructive/10 text-foreground ring-1 ring-destructive/40",
                          )}
                        >
                          {m.content}
                        </div>
                        <div className={cn("mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground", mine && "justify-end")}>
                          {m.failed ? (
                            <button onClick={() => retry(m)} className="inline-flex items-center gap-1 font-semibold text-destructive hover:underline">
                              <AlertCircle className="size-3" /> Not sent — retry <RotateCw className="size-3" />
                            </button>
                          ) : (
                            <>
                              <time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
                              {mine &&
                                (m.pending ? (
                                  <Clock className="size-3" aria-label="Sending" />
                                ) : m.readAt ? (
                                  <CheckCheck className="size-3.5 text-primary" aria-label="Read" />
                                ) : (
                                  <Check className="size-3.5" aria-label="Sent" />
                                ))}
                              {mine && i === lastMineIndex && m.readAt && <span>Seen</span>}
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  </Fragment>
                );
              })}
              {typing && (
                <li className="flex pt-2" aria-label={`${other?.firstName} is typing`}>
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-secondary px-4 py-3.5">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d * 0.15}s` }} />
                    ))}
                  </div>
                </li>
              )}
            </ol>
          </>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-border p-3 sm:p-4"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-input bg-card p-1.5 pl-4 focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15">
          <label htmlFor="composer" className="sr-only">Message</label>
          <textarea
            id="composer"
            ref={textarea}
            rows={1}
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onBlur={stopTyping}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={connected ? "Write a message…" : "Reconnecting…"}
            disabled={loading}
            className="max-h-40 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || !connected} aria-label="Send message" className="rounded-xl">
            {!connected ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
          </Button>
        </div>
        {input.length > MAX_LEN * 0.9 && (
          <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">{input.length}/{MAX_LEN}</p>
        )}
      </form>
    </div>
  );
}
