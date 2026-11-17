"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, CheckCircle2, ExternalLink, Eye, Heart, Inbox, MoreVertical, Pencil, PlusCircle, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { ListingImage } from "@/components/listing/listing-image";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton, Surface } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import { availability, formatCurrency, ROOM_TYPE_LABEL } from "@/lib/format";
import type { OwnerListing } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function MyListingsPage() {
  const { data, error, loading, reload, setData } = useApi<{ listings: OwnerListing[] }>("/listings/mine");
  const [pending, setPending] = useState<{ type: "delete" | "fill" | "reactivate"; listing: OwnerListing } | null>(null);
  const [busy, setBusy] = useState(false);
  const listings = data?.listings ?? [];

  const act = async () => {
    if (!pending) return;
    const { type, listing } = pending;
    setBusy(true);
    try {
      if (type === "delete") {
        await api.delete(`/listings/${listing.id}`);
        setData((d) => (d ? { listings: d.listings.filter((l) => l.id !== listing.id) } : d));
        toast.success("Listing deleted");
      } else {
        const status = type === "fill" ? "FILLED" : "ACTIVE";
        await api.patch(`/listings/${listing.id}/status`, { status });
        setData((d) => (d ? { listings: d.listings.map((l) => (l.id === listing.id ? { ...l, status } : l)) } : d));
        toast.success(status === "FILLED" ? "Marked as filled — pending applicants were notified" : "Listing is active again");
      }
      setPending(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const dialog = pending && {
    delete: {
      title: "Delete this listing permanently?",
      description: "This removes the listing, its photos, requests and linked conversations. This cannot be undone.",
      label: "Delete",
      destructive: true,
    },
    fill: {
      title: "Mark as filled?",
      description: "The listing will be hidden from search and tenants with pending requests will be notified. You can reactivate it later.",
      label: "Mark as filled",
      destructive: false,
    },
    reactivate: {
      title: "Reactivate this listing?",
      description: "It will appear in search again and accept new requests.",
      label: "Reactivate",
      destructive: false,
    },
  }[pending.type];

  return (
    <ProtectedRoute roles={["OWNER"]}>
      <PageHeader
        title="My listings"
        description="Manage availability, photos and details."
        actions={<Button asChild><Link href="/dashboard/listings/new"><PlusCircle /> New listing</Link></Button>}
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No listings yet"
          description="Create your first listing to start receiving requests from compatible tenants."
          action={<Button asChild><Link href="/dashboard/listings/new">Create listing</Link></Button>}
        />
      ) : (
        <ul className="space-y-3">
          {listings.map((l) => (
            <li key={l.id}>
              <Surface className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <Link href={`/listings/${l.id}`} className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:aspect-[4/3] sm:w-40">
                  <ListingImage src={l.photos[0]?.url} alt={l.title} fill sizes="160px" className={l.status === "FILLED" ? "grayscale" : ""} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{l.title}</h2>
                    <Badge variant={l.status === "ACTIVE" ? "success" : "neutral"}>{l.status === "ACTIVE" ? "Active" : "Filled"}</Badge>
                    {l.pendingInterests > 0 && <Badge variant="warning">{l.pendingInterests} pending</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[l.locality, l.location].filter(Boolean).join(", ")} · {ROOM_TYPE_LABEL[l.roomType]} · {formatCurrency(l.rent)}/mo · {availability(l.availableFrom)}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><Eye className="size-4" /> {l.viewCount} views</span>
                    <span className="inline-flex items-center gap-1.5"><Heart className="size-4" /> {l._count.savedBy} saves</span>
                    <span className="inline-flex items-center gap-1.5"><Inbox className="size-4" /> {l._count.interestRequests} requests</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm"><Link href={`/dashboard/listings/${l.id}/edit`}><Pencil /> Edit</Link></Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="grid size-9 place-items-center rounded-lg border border-border hover:bg-accent" aria-label={`More actions for ${l.title}`}>
                      <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem asChild><Link href={`/listings/${l.id}`}><ExternalLink /> View listing</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link href="/dashboard/interests"><Inbox /> View requests</Link></DropdownMenuItem>
                      {l.status === "ACTIVE" ? (
                        <DropdownMenuItem onSelect={() => setPending({ type: "fill", listing: l })}><CheckCircle2 /> Mark as filled</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => setPending({ type: "reactivate", listing: l })}><RotateCcw /> Reactivate</DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setPending({ type: "delete", listing: l })} className="text-destructive [&_svg]:text-destructive">
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Surface>
            </li>
          ))}
        </ul>
      )}
      {dialog && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.label}
          destructive={dialog.destructive}
          loading={busy}
          onConfirm={() => void act()}
        />
      )}
    </ProtectedRoute>
  );
}
