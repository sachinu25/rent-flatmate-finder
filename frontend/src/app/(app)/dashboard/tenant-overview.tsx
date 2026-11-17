"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Clock, Heart, History, Inbox, MessageCircle, Sparkles } from "lucide-react";

import { ConversationRow } from "@/components/app/conversation-preview";
import { ListingCard, ListingCardSkeleton } from "@/components/listing/listing-card";
import { ListingImage } from "@/components/listing/listing-image";
import { NotificationItem, notificationHref } from "@/components/notifications/notification-item";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Skeleton, StatCard, Surface } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/auth-context";
import { useRealtime } from "@/contexts/realtime-context";
import { formatCurrency, timeAgo } from "@/lib/format";
import { readRecent, type RecentListing } from "@/lib/hooks";
import type { ConversationSummary, Listing, Notification } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useRouter } from "next/navigation";

interface TenantDashboard {
  profileCompletion: { percent: number; missing: string[] };
  hasProfile: boolean;
  stats: { saved: number; interests: { pending: number; accepted: number; declined: number } };
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Section({ title, href, linkLabel = "View all", children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            {linkLabel} <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function TenantOverview() {
  const { user } = useAuth();
  const router = useRouter();
  const { unreadMessages } = useRealtime();
  const dash = useApi<TenantDashboard>("/dashboard/tenant");
  const matches = useApi<{ matches: Listing[] }>(dash.data?.hasProfile ? "/compatibility/matches" : null);
  const convs = useApi<{ conversations: ConversationSummary[] }>("/chat/conversations");
  const notes = useApi<{ notifications: Notification[] }>("/notifications?limit=4");
  // Client-only page (behind the auth guard), so reading storage at mount is safe.
  const [recent] = useState<RecentListing[]>(readRecent);

  const d = dash.data;
  const pct = d?.profileCompletion.percent ?? 0;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={greeting()}
        title={`Welcome back, ${user?.firstName}`}
        description="Here's what's happening with your home search."
        actions={
          <Button asChild>
            <Link href="/listings">Browse homes</Link>
          </Button>
        }
      />

      {/* Profile completion */}
      {dash.loading ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : (
        d &&
        pct < 100 && (
          <Surface className="flex flex-col gap-5 overflow-hidden p-6 sm:flex-row sm:items-center">
            <div className="relative grid size-20 shrink-0 place-items-center">
              <svg viewBox="0 0 36 36" className="size-20 -rotate-90" aria-hidden>
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" className="stroke-border" />
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-highlight" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
              </svg>
              <span className="absolute font-display text-lg font-bold">{pct}%</span>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">{d.hasProfile ? "Sharpen your matches" : "Set up your profile to unlock matching"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Still missing: {d.profileCompletion.missing.slice(0, 4).join(", ")}
                {d.profileCompletion.missing.length > 4 && ` and ${d.profileCompletion.missing.length - 4} more`}.
              </p>
            </div>
            <Button asChild variant="highlight">
              <Link href="/dashboard/profile">Complete profile</Link>
            </Button>
          </Surface>
        )
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Saved homes" value={d?.stats.saved ?? "–"} icon={Heart} tone="highlight" />
        <StatCard label="Pending requests" value={d?.stats.interests.pending ?? "–"} icon={Clock} tone="warning" />
        <StatCard label="Accepted" value={d?.stats.interests.accepted ?? "–"} icon={Inbox} tone="success" />
        <StatCard label="Unread messages" value={unreadMessages} icon={MessageCircle} />
      </div>

      <Section title="Recommended for you" href={d?.hasProfile ? "/dashboard/matches" : undefined}>
        {!d?.hasProfile && !dash.loading ? (
          <EmptyState
            icon={Sparkles}
            title="Get personalised recommendations"
            description="Tell us your budget, preferred area and lifestyle and we'll rank homes by how well they fit."
            action={<Button asChild><Link href="/dashboard/profile">Add preferences</Link></Button>}
          />
        ) : matches.loading || dash.loading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <ListingCardSkeleton key={i} />)}</div>
        ) : matches.data?.matches.length ? (
          <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
            {matches.data.matches.slice(0, 4).map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        ) : (
          <EmptyState icon={Sparkles} title="No matches in your area yet" description="Try widening your preferred location or budget in your profile." />
        )}
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Conversations" href="/messages">
          {convs.loading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : convs.data?.conversations.length ? (
            <Surface className="p-2">
              {convs.data.conversations.slice(0, 4).map((c) => <ConversationRow key={c.id} c={c} currentUserId={user?.id} />)}
            </Surface>
          ) : (
            <EmptyState icon={MessageCircle} title="No conversations yet" description="Chats open once an owner accepts one of your requests." />
          )}
        </Section>

        <Section title="Notifications" href="/notifications">
          {notes.loading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : notes.data?.notifications.length ? (
            <Surface className="overflow-hidden">
              {notes.data.notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} compact onOpen={() => router.push(notificationHref(n))} />
              ))}
            </Surface>
          ) : (
            <EmptyState icon={Sparkles} title="Nothing new" description="We'll let you know about new matches and replies." />
          )}
        </Section>
      </div>

      {recent.length > 0 && (
        <Section title="Recently viewed">
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 scrollbar-none">
            {recent.map((r) => (
              <Link key={r.id} href={`/listings/${r.id}`} className="group w-56 shrink-0">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                  <ListingImage src={r.photo} alt={r.title} fill sizes="224px" className="transition-transform group-hover:scale-105" />
                </div>
                <p className="mt-2 line-clamp-1 text-sm font-semibold">{r.title}</p>
                <p className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(r.rent)}/mo · {r.location}</span>
                  <span className="inline-flex items-center gap-1"><History className="size-3" />{timeAgo(new Date(r.viewedAt))}</span>
                </p>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
