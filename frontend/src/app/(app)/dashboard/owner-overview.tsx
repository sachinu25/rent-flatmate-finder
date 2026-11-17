"use client";

import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Clock, Eye, Heart, Home, Inbox, PlusCircle, Users } from "lucide-react";

import { ListingImage } from "@/components/listing/listing-image";
import { ScoreRing } from "@/components/listing/score-ring";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/overlays";
import { Badge, EmptyState, PageHeader, Skeleton, StatCard, Surface } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/auth-context";
import { formatCurrency, formatDate, timeAgo } from "@/lib/format";
import type { InterestStatus, OwnerListing } from "@/lib/types";
import { useApi } from "@/lib/use-api";

interface OwnerDashboard {
  stats: {
    totalListings: number;
    activeListings: number;
    filledListings: number;
    totalViews: number;
    totalSaves: number;
    interests: { pending: number; accepted: number; declined: number };
  };
  recentActivity: {
    id: string;
    status: InterestStatus;
    createdAt: string;
    updatedAt: string;
    tenant: { firstName: string; lastName: string; avatarUrl: string | null };
    listing: { id: string; title: string };
  }[];
}

interface Candidate {
  tenant: { id: string; name: string; avatarUrl: string | null };
  occupation: string | null;
  budgetMin: number;
  budgetMax: number;
  moveInDate: string;
  score: number;
  highlights: string[];
  conflicts: string[];
}

const ACTIVITY: Record<InterestStatus, { label: string; variant: "warning" | "success" | "neutral" }> = {
  PENDING: { label: "requested", variant: "warning" },
  ACCEPTED: { label: "accepted", variant: "success" },
  DECLINED: { label: "declined", variant: "neutral" },
};

export function OwnerOverview() {
  const { user } = useAuth();
  const dash = useApi<OwnerDashboard>("/dashboard/owner");
  const mine = useApi<{ listings: OwnerListing[] }>("/listings/mine");
  const topListing = mine.data?.listings.find((l) => l.status === "ACTIVE");
  const candidates = useApi<{ candidates: Candidate[] }>(topListing ? `/listings/${topListing.id}/candidates` : null);
  const s = dash.data?.stats;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Owner workspace"
        title={`Hello, ${user?.firstName}`}
        description="Your listings, requests and tenant matches at a glance."
        actions={
          <Button asChild>
            <Link href="/dashboard/listings/new"><PlusCircle /> New listing</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total listings" value={s?.totalListings ?? "–"} icon={Building2} />
        <StatCard label="Active" value={s?.activeListings ?? "–"} icon={Home} tone="success" />
        <StatCard label="Filled" value={s?.filledListings ?? "–"} icon={CheckCircle2} />
        <StatCard label="Listing views" value={s?.totalViews.toLocaleString("en-IN") ?? "–"} icon={Eye} hint="Detail-page visits" />
        <StatCard label="Saves" value={s?.totalSaves ?? "–"} icon={Heart} tone="highlight" />
        <StatCard label="Pending requests" value={s?.interests.pending ?? "–"} icon={Clock} tone="warning" />
      </div>

      {s && s.interests.pending > 0 && (
        <Surface className="flex flex-col gap-4 border-warning/30 bg-warning/5 p-5 sm:flex-row sm:items-center">
          <Inbox className="size-6 text-warning" aria-hidden />
          <p className="flex-1 text-sm">
            You have <strong>{s.interests.pending}</strong> request{s.interests.pending === 1 ? "" : "s"} waiting for a reply.
          </p>
          <Button asChild size="sm"><Link href="/dashboard/interests">Review now</Link></Button>
        </Surface>
      )}

      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Your listings</h2>
            <Link href="/dashboard/listings" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Manage <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {mine.loading ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : mine.data?.listings.length ? (
            <Surface className="divide-y divide-border">
              {mine.data.listings.slice(0, 4).map((l) => (
                <Link key={l.id} href={`/dashboard/listings/${l.id}/edit`} className="flex items-center gap-4 p-4 transition-colors hover:bg-accent/60">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                    <ListingImage src={l.photos[0]?.url} alt={l.title} fill sizes="64px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.title}</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(l.rent)}/mo · {l.location}</p>
                    <p className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Eye className="size-3" />{l.viewCount}</span>
                      <span className="inline-flex items-center gap-1"><Heart className="size-3" />{l._count.savedBy}</span>
                      <span className="inline-flex items-center gap-1"><Inbox className="size-3" />{l._count.interestRequests}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={l.status === "ACTIVE" ? "success" : "neutral"}>{l.status === "ACTIVE" ? "Active" : "Filled"}</Badge>
                    {l.pendingInterests > 0 && <Badge variant="warning">{l.pendingInterests} pending</Badge>}
                  </div>
                </Link>
              ))}
            </Surface>
          ) : (
            <EmptyState
              icon={Building2}
              title="List your first place"
              description="Add photos, rent and house rules — it takes about five minutes."
              action={<Button asChild><Link href="/dashboard/listings/new">Create listing</Link></Button>}
            />
          )}
        </section>

        <section className="min-w-0">
          <h2 className="mb-4 text-lg font-bold">Recent activity</h2>
          {dash.loading ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : dash.data?.recentActivity.length ? (
            <Surface className="p-2">
              <ol>
                {dash.data.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 rounded-xl p-3">
                    <UserAvatar firstName={a.tenant.firstName} lastName={a.tenant.lastName} src={a.tenant.avatarUrl} className="size-9 text-xs" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p>
                        <span className="font-semibold">{a.tenant.firstName} {a.tenant.lastName.charAt(0)}.</span>{" "}
                        <span className="text-muted-foreground">— request {ACTIVITY[a.status].label} for</span>{" "}
                        <Link href={`/listings/${a.listing.id}`} className="font-medium hover:underline">{a.listing.title}</Link>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(a.updatedAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Surface>
          ) : (
            <EmptyState icon={Inbox} title="No activity yet" description="Requests from tenants will show up here." />
          )}
        </section>
      </div>

      {topListing && (
        <section className="min-w-0">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-bold">Potential tenants for “{topListing.title}”</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Tenants whose stated preferences fit this listing (rule-based score). Names are abbreviated and contact details stay private
            until a tenant sends you a request.
          </p>
          {candidates.loading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : candidates.data?.candidates.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {candidates.data.candidates.slice(0, 6).map((c) => (
                <Surface key={c.tenant.id} className="flex gap-4 p-5">
                  <ScoreRing score={c.score} size={52} stroke={5} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.tenant.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.occupation ?? "Tenant"} · {formatCurrency(c.budgetMin)}–{formatCurrency(c.budgetMax)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Moving {formatDate(c.moveInDate, { day: "numeric", month: "short" })}</p>
                    {c.highlights[0] && <p className="mt-2 line-clamp-2 text-xs text-success">✓ {c.highlights[0]}</p>}
                    {c.conflicts[0] && <p className="mt-1 line-clamp-2 text-xs text-destructive">✕ {c.conflicts[0]}</p>}
                  </div>
                </Surface>
              ))}
            </div>
          ) : (
            <EmptyState icon={Users} title="No matching tenants yet" description="As tenants in this area set up profiles, the best fits will appear here." />
          )}
        </section>
      )}
    </div>
  );
}
