"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";

import { api, getAccessToken, refreshSession } from "@/lib/api";
import type { ChatMessage, Notification } from "@/lib/types";

import { useAuth } from "./auth-context";

/**
 * One Socket.IO connection per signed-in session.
 *
 * Provides connection state, live unread counters for notifications and
 * messages, and presence. Polls slowly as a fallback when the socket is down,
 * so counters stay correct even if WebSockets are blocked.
 */

const SOCKET_URL = (process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5000").replace(/\/$/, "");

interface RealtimeContextType {
  socket: Socket | null;
  connected: boolean;
  unreadNotifications: number;
  unreadMessages: number;
  setUnreadNotifications: (n: number | ((p: number) => number)) => void;
  refreshCounts: () => void;
  setActiveConversation: (id: string | null) => void;
  online: Record<string, boolean>;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const activeConversation = useRef<string | null>(null);

  const refreshCounts = useCallback(() => {
    if (!getAccessToken()) return;
    void api
      .get<{ unreadCount: number }>("/notifications/unread-count")
      .then((r) => setUnreadNotifications(r.data?.unreadCount ?? 0))
      .catch(() => undefined);
    void api
      .get<{ unreadCount: number }>("/chat/unread-count")
      .then((r) => setUnreadMessages(r.data?.unreadCount ?? 0))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;

    const s = io(SOCKET_URL, {
      // Called on every (re)connect, so reconnections always use a fresh token.
      auth: (cb) => cb({ token: getAccessToken() }),
      transports: ["websocket", "polling"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });

    // The socket is published to consumers once connected; they also check
    // `socket.connected` so late subscribers can act immediately.
    s.on("connect", () => {
      setSocket(s);
      setConnected(true);
      refreshCounts();
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", async (err) => {
      setConnected(false);
      if (/token|auth/i.test(err.message)) {
        const ok = await refreshSession();
        if (ok) s.connect();
      }
    });

    s.on("notification:new", (n: Notification) => {
      setUnreadNotifications((c) => c + 1);
      // Message notifications are surfaced by the chat badge instead of a toast.
      if (n.type !== "NEW_MESSAGE") toast(n.title, { description: n.message });
    });

    s.on("chat:activity", (m: ChatMessage & { conversationId: string }) => {
      if (m.senderId !== user.id && activeConversation.current !== m.conversationId) {
        setUnreadMessages((c) => c + 1);
      }
    });

    s.on("messages:read", () => refreshCounts());
    s.on("presence:update", (p: { userId: string; online: boolean }) =>
      setOnline((o) => ({ ...o, [p.userId]: p.online })),
    );

    refreshCounts();
    const poll = setInterval(() => {
      if (!s.connected) refreshCounts();
    }, 60_000);

    return () => {
      clearInterval(poll);
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user, refreshCounts]);

  /** The open conversation's incoming messages must not bump the unread badge. */
  const setActiveConversation = useCallback(
    (id: string | null) => {
      activeConversation.current = id;
      if (id) refreshCounts();
    },
    [refreshCounts],
  );

  const value = useMemo<RealtimeContextType>(
    () => ({
      socket,
      connected,
      unreadNotifications: user ? unreadNotifications : 0,
      unreadMessages: user ? unreadMessages : 0,
      setUnreadNotifications,
      refreshCounts,
      setActiveConversation,
      online,
    }),
    [socket, connected, unreadNotifications, unreadMessages, refreshCounts, setActiveConversation, online, user],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}
