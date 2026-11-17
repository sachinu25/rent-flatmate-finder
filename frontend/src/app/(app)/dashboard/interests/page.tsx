"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, CheckCircle2, Clock, Inbox, MessageCircle, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { ListingImage } from "@/components/listing/listing-image";
import { ScoreRing } from "@/components/listing/score-ring";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, UserAvatar } from "@/components/ui/overlays";
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton, Surface } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/auth-context";
import { api, errorMessage } from "@/lib/api";
import { formatCurrency, formatDate, timeAgo } from "@/lib/format";
import type { InterestStatus } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const STATUS: Record<InterestStatus, { label: string; icon: typeof Clock; variant: "warning" | "success" | "neutral" }> = {
  PENDING: { label: "Pending", icon: Clock, variant: "warning" },
  ACCEPTED: { label: "Accepted", icon: CheckCircle2, variant: "success" },
  DECLINED: { label: "Declined", icon: XCircle, variant: "neutral" },
};

function StatusBadge({ s }: { s: InterestStatus }) {
  const { label, icon: Icon, variant } = STATUS[s];
  return <Badge variant={variant}><Icon /> {label}</Badge>;
}

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count: number }[] }) {
  return (
    <div role="tablist" className="mb-6 inline-flex gap-1 rounded-2xl bg-secondary p-1">
      {items.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            value === t.value ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label} <span className="ml-1 text-xs text-muted-foreground tabular-nums">{t.count}</span>
        </button>
      ))}
    </div>
  );
}

// ── Tenant: sent requests ───────────────────────────────────────────────────
interface SentInterest {
  id: string;
  status: InterestStatus;
  message: string | null;
  createdAt: string;
  listing: { id: string; title: string; location: string; locality: string | null; rent: number; status: string; photos: { url: string }[]; owner: { firstName: string; lastName: string } };
  conversation: { id: string } | null;
}

function TenantRequests() {
  const { data, error, loading, reload, setData } = useApi<{ interests: SentInterest[] }>("/interests/mine");
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = data?.interests ?? [];

  const withdraw = async () => {
    if (!withdrawId) return;
    setBusy(true);
    try {
      await api.delete(`/interests/${withdrawId}`);
      setData((d) => (d ? { interests: d.interests.filter((i) => i.id !== withdrawId) } : d));
      toast.success("Request withdrawn");
      setWithdrawId(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;
  if (!items.length)
    return (
      <EmptyState
        icon={Inbox}
        title="No requests yet"
        description="When you find a home you like, send the owner a request — it'll be tracked here."
        action={<Button asChild><Link href="/listings">Browse homes</Link></Button>}
      />
    );

  return (
    <>
      <ul className="space-y-3">
        {items.map((i) => (
          <li key={i.id}>
            <Surface className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <Link href={`/listings/${i.listing.id}`} className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-28 sm:aspect-auto">
                <ListingImage src={i.listing.photos[0]?.url} alt={i.listing.title} fill sizes="112px" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/listings/${i.listing.id}`} className="font-semibold hover:underline">{i.listing.title}</Link>
                  <StatusBadge s={i.status} />
                  {i.listing.status === "FILLED" && i.status === "PENDING" && <Badge variant="neutral">Listing filled</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {[i.listing.locality, i.listing.location].filter(Boolean).join(", ")} · {formatCurrency(i.listing.rent)}/mo · Owner {i.listing.owner.firstName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Sent {timeAgo(i.createdAt)}</p>
              </div>
              <div className="flex gap-2">
                {i.status === "ACCEPTED" && i.conversation && (
                  <Button asChild size="sm"><Link href={`/messages/${i.conversation.id}`}><MessageCircle /> Chat</Link></Button>
                )}
                {i.status === "PENDING" && (
                  <Button size="sm" variant="outline" onClick={() => setWithdrawId(i.id)}>Withdraw</Button>
                )}
              </div>
            </Surface>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(withdrawId)}
        onOpenChange={(o) => !o && setWithdrawId(null)}
        title="Withdraw this request?"
        description="The owner will no longer see it. You can send a new request later."
        confirmLabel="Withdraw"
        destructive
        loading={busy}
        onConfirm={() => void withdraw()}
      />
    </>
  );
}

// ── Owner: received requests ────────────────────────────────────────────────
interface ReceivedInterest {
  id: string;
  status: InterestStatus;
  message: string | null;
  createdAt: string;
  tenantId: string;
  listingId: string;
  tenant: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    tenantProfile: { occupation: string | null; moveInDate: string; budgetMin: number; budgetMax: number } | null;
  };
  listing: { id: string; title: string };
  conversation: { id: string } | null;
  compatibility: { score: number; computedVia: "LLM" | "FALLBACK" } | null;
}

function OwnerRequests() {
  const { data, error, loading, reload, setData } = useApi<{ interests: ReceivedInterest[] }>("/interests/received");
  const [tab, setTab] = useState<InterestStatus>("PENDING");
  const [confirm, setConfirm] = useState<{ id: string; status: "ACCEPTED" | "DECLINED"; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const all = data?.interests ?? [];
  const items = all.filter((i) => i.status === tab);

  const resolve = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const res = await api.patch<{ conversationId: string | null }>(`/interests/${confirm.id}`, { status: confirm.status });
      setData((d) =>
        d
          ? {
              interests: d.interests.map((i) =>
                i.id === confirm.id
                  ? { ...i, status: confirm.status, conversation: res.data?.conversationId ? { id: res.data.conversationId } : null }
                  : i,
              ),
            }
          : d,
      );
      toast.success(confirm.status === "ACCEPTED" ? `Accepted — you can now chat with ${confirm.name}` : "Request declined");
      setConfirm(null);
    } catch (err) {
      toast.error(errorMessage(err));
      reload();
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>;

  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        items={(["PENDING", "ACCEPTED", "DECLINED"] as const).map((s) => ({ value: s, label: STATUS[s].label, count: all.filter((i) => i.status === s).length }))}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tab === "PENDING" ? "No pending requests" : `No ${STATUS[tab].label.toLowerCase()} requests`}
          description={tab === "PENDING" ? "New requests from tenants will appear here." : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((i) => {
            const p = i.tenant.tenantProfile;
            const name = `${i.tenant.firstName} ${i.tenant.lastName}`;
            return (
              <li key={i.id}>
                <Surface className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex flex-1 gap-4">
                      <UserAvatar firstName={i.tenant.firstName} lastName={i.tenant.lastName} src={i.tenant.avatarUrl} className="size-12" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{name}</p>
                          <StatusBadge s={i.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          for <Link href={`/listings/${i.listing.id}`} className="font-medium text-foreground hover:underline">{i.listing.title}</Link> · {timeAgo(i.createdAt)}
                        </p>
                        {p && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {p.occupation ?? "Tenant"} · Budget {formatCurrency(p.budgetMin)}–{formatCurrency(p.budgetMax)} · Moving {formatDate(p.moveInDate, { day: "numeric", month: "short" })}
                          </p>
                        )}
                        {i.message && <p className="mt-3 rounded-xl bg-secondary p-3 text-sm leading-relaxed">“{i.message}”</p>}
                      </div>
                    </div>
                    {i.compatibility && (
                      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                        <ScoreRing score={i.compatibility.score} size={52} stroke={5} />
                        <span className="text-[11px] text-muted-foreground">{i.compatibility.computedVia === "LLM" ? "AI score" : "Rule-based"}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                    {i.status === "PENDING" ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setConfirm({ id: i.id, status: "DECLINED", name: i.tenant.firstName })}>
                          <X /> Decline
                        </Button>
                        <Button size="sm" onClick={() => setConfirm({ id: i.id, status: "ACCEPTED", name: i.tenant.firstName })}>
                          <Check /> Accept &amp; open chat
                        </Button>
                      </>
                    ) : i.status === "ACCEPTED" && i.conversation ? (
                      <Button asChild size="sm"><Link href={`/messages/${i.conversation.id}`}><MessageCircle /> Open chat</Link></Button>
                    ) : null}
                  </div>
                </Surface>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.status === "ACCEPTED" ? `Accept ${confirm.name}'s request?` : `Decline ${confirm?.name}'s request?`}
        description={
          confirm?.status === "ACCEPTED"
            ? "A private chat will open between you, and they'll be notified by email and in the app."
            : "They'll be notified that you declined. This can't be undone."
        }
        confirmLabel={confirm?.status === "ACCEPTED" ? "Accept" : "Decline"}
        destructive={confirm?.status === "DECLINED"}
        loading={busy}
        onConfirm={() => void resolve()}
      />
    </>
  );
}

export default function InterestsPage() {
  const { user } = useAuth();
  const owner = user?.role === "OWNER";
  return (
    <>
      <PageHeader
        title={owner ? "Tenant requests" : "My requests"}
        description={owner ? "Review who wants to live in your homes." : "Track the homes you've asked about."}
      />
      {owner ? <OwnerRequests /> : <TenantRequests />}
    </>
  );
}
