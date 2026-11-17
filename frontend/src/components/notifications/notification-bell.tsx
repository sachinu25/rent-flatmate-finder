"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { useRealtime } from "@/contexts/realtime-context";
import { api } from "@/lib/api";
import type { Notification } from "@/lib/types";

import { NotificationItem, notificationHref } from "./notification-item";

export function NotificationBell() {
  const { unreadNotifications, setUnreadNotifications } = useRealtime();
  const [items, setItems] = useState<Notification[] | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ notifications: Notification[]; unreadCount: number }>("/notifications?limit=8");
      setItems(res.data?.notifications ?? []);
      setUnreadNotifications(res.data?.unreadCount ?? 0);
    } catch {
      setItems([]);
    }
  }, [setUnreadNotifications]);

  const markAll = async () => {
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
    setUnreadNotifications(0);
    await api.patch("/notifications/read-all").catch(() => undefined);
  };

  const open = async (n: Notification) => {
    if (!n.read) {
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? prev);
      setUnreadNotifications((c) => Math.max(0, c - 1));
      void api.patch(`/notifications/${n.id}/read`).catch(() => undefined);
    }
    router.push(notificationHref(n));
  };

  return (
    <PopoverPrimitive.Root onOpenChange={(o) => o && void load()}>
      <PopoverPrimitive.Trigger
        className="relative grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={unreadNotifications ? `Notifications, ${unreadNotifications} unread` : "Notifications"}
      >
        <Bell className="size-[18px]" />
        {unreadNotifications > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-[18px] place-items-center rounded-full bg-highlight px-1 text-[10px] font-bold leading-[18px] text-highlight-foreground ring-2 ring-background">
            {unreadNotifications > 9 ? "9+" : unreadNotifications}
          </span>
        )}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-popover shadow-lift data-[state=open]:animate-pop-in"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unreadNotifications > 0 && (
              <button onClick={() => void markAll()} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[22rem] overflow-y-auto">
            {items === null ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-12 rounded-xl" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => (
                <PopoverPrimitive.Close asChild key={n.id}>
                  <NotificationItem notification={n} onOpen={() => void open(n)} compact />
                </PopoverPrimitive.Close>
              ))
            )}
          </div>
          <PopoverPrimitive.Close asChild>
            <Link href="/notifications" className="block border-t border-border px-4 py-3 text-center text-sm font-semibold text-primary hover:bg-accent">
              View all notifications
            </Link>
          </PopoverPrimitive.Close>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
