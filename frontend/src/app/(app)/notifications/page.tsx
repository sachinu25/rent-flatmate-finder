"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BellOff, CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { NotificationItem, notificationHref } from "@/components/notifications/notification-item";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Skeleton, Surface } from "@/components/ui/primitives";
import { useRealtime } from "@/contexts/realtime-context";
import { api, errorMessage } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type Page = { notifications: Notification[]; unreadCount: number; nextCursor: string | null };

export default function NotificationsPage() {
  const router = useRouter();
  const { setUnreadNotifications } = useRealtime();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { data, error, loading, reload, setData } = useApi<Page>(`/notifications?limit=20${filter === "unread" ? "&unread=true" : ""}`);
  const [loadingMore, setLoadingMore] = useState(false);
  const items = data?.notifications ?? [];

  const markAll = async () => {
    try {
      await api.patch("/notifications/read-all");
      setData((d) => (d ? { ...d, unreadCount: 0, notifications: filter === "unread" ? [] : d.notifications.map((n) => ({ ...n, read: true })) } : d));
      setUnreadNotifications(0);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const open = (n: Notification) => {
    if (!n.read) {
      void api.patch(`/notifications/${n.id}/read`).catch(() => undefined);
      setUnreadNotifications((c) => Math.max(0, c - 1));
    }
    router.push(notificationHref(n));
  };

  const remove = async (n: Notification) => {
    setData((d) => (d ? { ...d, notifications: d.notifications.filter((x) => x.id !== n.id) } : d));
    if (!n.read) setUnreadNotifications((c) => Math.max(0, c - 1));
    await api.delete(`/notifications/${n.id}`).catch(() => reload());
  };

  const more = async () => {
    if (!data?.nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await api.get<Page>(`/notifications?limit=20&cursor=${data.nextCursor}${filter === "unread" ? "&unread=true" : ""}`);
      setData((d) => (d && res.data ? { ...res.data, notifications: [...d.notifications, ...res.data.notifications] } : d));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description={data ? `${data.unreadCount} unread` : undefined}
        actions={
          <Button variant="outline" onClick={() => void markAll()} disabled={!data?.unreadCount}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />
      <div role="tablist" className="mb-5 inline-flex gap-1 rounded-2xl bg-secondary p-1">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn("rounded-xl px-4 py-2 text-sm font-semibold capitalize", filter === f ? "bg-card shadow-soft" : "text-muted-foreground")}
          >
            {f}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={BellOff} title={filter === "unread" ? "No unread notifications" : "No notifications yet"} description="Updates about requests, messages and new matches will appear here." />
      ) : (
        <Surface className="divide-y divide-border overflow-hidden p-1.5">
          {items.map((n) => (
            <div key={n.id} className="group relative">
              <NotificationItem notification={n} onOpen={() => open(n)} />
              <button
                onClick={() => void remove(n)}
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                aria-label="Delete notification"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </Surface>
      )}
      {data?.nextCursor && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => void more()} loading={loadingMore}>Load more</Button>
        </div>
      )}
    </>
  );
}
