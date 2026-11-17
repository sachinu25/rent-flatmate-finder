"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Check,
  Cigarette,
  Dog,
  Eye,
  MapPin,
  Moon,
  Pencil,
  Share2,
  Sofa,
  Sparkles,
  Users,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";

import { CompatibilityPanel } from "@/components/listing/compatibility-panel";
import { InterestAction, type ViewerInterest } from "@/components/listing/interest-action";
import { ListingGallery } from "@/components/listing/listing-gallery";
import { SaveButton } from "@/components/listing/save-button";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/overlays";
import { Badge, Skeleton, Surface } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/auth-context";
import { useApi } from "@/lib/use-api";
import {
  availability,
  CLEANLINESS_LABEL,
  FOOD_LABEL,
  formatCurrency,
  formatDate,
  FURNISHING_LABEL,
  GENDER_LABEL,
  humanize,
  ROOM_TYPE_LABEL,
  SLEEP_LABEL,
} from "@/lib/format";
import { pushRecent } from "@/lib/hooks";
import type { Compatibility, Listing } from "@/lib/types";

interface Viewer {
  isOwner: boolean;
  isSaved: boolean;
  hasProfile: boolean;
  interest: ViewerInterest | null;
  compatibility: Compatibility | null;
}

function Fact({ icon: Icon, label, value }: { icon: typeof BedDouble; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

export function ListingDetail({ listing }: { listing: Listing }) {
  const { user, isLoading } = useAuth();

  // Viewer-specific data (saved, interest, compatibility) — needs auth.
  const viewerQuery = useApi<{ viewer: Viewer | null }>(!isLoading && user ? `/listings/${listing.id}?as=${user.id}` : null);
  const viewer = user ? (viewerQuery.data?.viewer ?? null) : null;
  const viewerLoading = viewerQuery.loading;
  const setViewer = (fn: (v: Viewer | null) => Viewer | null) =>
    viewerQuery.setData((d) => (d ? { viewer: fn(d.viewer) } : d));

  // Count one view per browser session; remember for "recently viewed".
  useEffect(() => {
    pushRecent({ id: listing.id, title: listing.title, location: listing.locality ?? listing.location, rent: listing.rent, photo: listing.photos[0]?.url ?? null });
    try {
      const key = `rff_viewed_${listing.id}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        void fetch(`/api/listings/${listing.id}/view`, { method: "POST", headers: { "X-Requested-With": "fetch" } }).catch(() => undefined);
      }
    } catch {
      /* storage unavailable */
    }
  }, [listing]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const place = [listing.locality, listing.location].filter(Boolean).join(", ");
  const owner = listing.owner;
  const role = user?.role ?? null;
  const filled = listing.status === "FILLED";

  const household: { icon: typeof Dog; label: string; value: string }[] = [];
  if (listing.smokingAllowed !== null) household.push({ icon: Cigarette, label: "Smoking", value: listing.smokingAllowed ? "Allowed" : "Not allowed" });
  if (listing.petsAllowed !== null) household.push({ icon: Dog, label: "Pets", value: listing.petsAllowed ? "Welcome" : "Not allowed" });
  if (listing.foodPolicy) household.push({ icon: Utensils, label: "Kitchen", value: FOOD_LABEL[listing.foodPolicy] });
  if (listing.householdSleepSchedule) household.push({ icon: Moon, label: "Household rhythm", value: SLEEP_LABEL[listing.householdSleepSchedule] });
  if (listing.householdCleanliness) household.push({ icon: Sparkles, label: "Cleanliness", value: CLEANLINESS_LABEL[listing.householdCleanliness] ?? "" });

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href="/listings" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All homes
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void share()}>
            <Share2 /> Share
          </Button>
          {viewer?.isOwner ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/listings/${listing.id}/edit`}><Pencil /> Edit</Link>
            </Button>
          ) : (
            role !== "ADMIN" && <SaveButton key={String(viewer?.isSaved)} listingId={listing.id} initialSaved={viewer?.isSaved} variant="inline" />
          )}
        </div>
      </div>

      <ListingGallery photos={listing.photos} title={listing.title} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-14">
        <div className="min-w-0 space-y-10">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={filled ? "neutral" : "success"}>{filled ? "Filled" : availability(listing.availableFrom)}</Badge>
              {listing.genderPreference !== "ANY" && <Badge variant="outline">{GENDER_LABEL[listing.genderPreference]}</Badge>}
            </div>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-balance sm:text-4xl">{listing.title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-4" aria-hidden /> {listing.address ?? place}
            </p>
          </header>

          <section aria-label="Key details" className="grid grid-cols-2 gap-5 border-y border-border py-6 sm:grid-cols-4">
            <Fact icon={BedDouble} label="Room type" value={ROOM_TYPE_LABEL[listing.roomType]} />
            <Fact icon={Sofa} label="Furnishing" value={FURNISHING_LABEL[listing.furnishingStatus]} />
            <Fact icon={Users} label="Max occupants" value={String(listing.maxOccupants)} />
            <Fact icon={CalendarDays} label="Available" value={formatDate(listing.availableFrom, { day: "numeric", month: "short" })} />
          </section>

          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="text-xl font-bold">About this place</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground/85">{listing.description}</p>
          </section>

          {listing.amenities.length > 0 && (
            <section aria-labelledby="amenities-heading">
              <h2 id="amenities-heading" className="text-xl font-bold">Amenities</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {listing.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-3 text-sm">
                    <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-primary"><Check className="size-3.5" /></span>
                    {humanize(a)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(household.length > 0 || listing.rules.length > 0) && (
            <section aria-labelledby="household-heading">
              <h2 id="household-heading" className="text-xl font-bold">Household &amp; house rules</h2>
              {household.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3">
                  {household.map((h) => <Fact key={h.label} {...h} />)}
                </div>
              )}
              {listing.rules.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {listing.rules.map((r) => <Badge key={r} variant="neutral">{humanize(r)}</Badge>)}
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="match-heading">
            <h2 id="match-heading" className="mb-4 text-xl font-bold">Your compatibility</h2>
            {isLoading || (user && viewerLoading) ? (
              <Skeleton className="h-56 rounded-2xl" />
            ) : (
              <CompatibilityPanel
                listingId={listing.id}
                initial={viewer?.compatibility ?? null}
                hasProfile={Boolean(viewer?.hasProfile)}
                role={role}
              />
            )}
          </section>
        </div>

        {/* ── Sticky booking card ── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Surface className="p-6 shadow-lift">
            <p>
              <span className="font-display text-3xl font-bold">{formatCurrency(listing.rent)}</span>
              <span className="text-muted-foreground"> / month</span>
            </p>
            <dl className="mt-4 space-y-2 border-b border-border pb-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Security deposit</dt>
                <dd className="font-medium">{listing.deposit ? formatCurrency(listing.deposit) : "Not specified"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Available from</dt>
                <dd className="font-medium">{formatDate(listing.availableFrom)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{filled ? "Filled" : "Accepting requests"}</dd>
              </div>
            </dl>
            <div className="mt-5">
              {isLoading || (user && viewerLoading) ? (
                <Skeleton className="h-12 rounded-xl" />
              ) : viewer?.isOwner ? (
                <Button asChild size="lg" variant="outline" className="w-full">
                  <Link href="/dashboard/interests">View requests</Link>
                </Button>
              ) : (
                <InterestAction
                  listingId={listing.id}
                  listingTitle={listing.title}
                  ownerName={owner?.firstName ?? "the owner"}
                  interest={viewer?.interest ?? null}
                  role={role}
                  filled={filled}
                  onChange={(interest) => setViewer((v) => (v ? { ...v, interest } : v))}
                />
              )}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">Contact details are shared only after the owner accepts.</p>
          </Surface>

          {owner && (
            <Surface className="mt-4 flex items-center gap-4 p-5">
              <UserAvatar firstName={owner.firstName} lastName={owner.lastName} src={owner.avatarUrl} className="size-12" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Listed by</p>
                <p className="font-semibold">{owner.firstName} {owner.lastName.charAt(0)}.</p>
                {owner.createdAt && <p className="text-xs text-muted-foreground">Member since {formatDate(owner.createdAt, { month: "short", year: "numeric" })}</p>}
              </div>
            </Surface>
          )}
          {viewer?.isOwner && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="size-3.5" /> {listing.viewCount.toLocaleString("en-IN")} views (as of page load)
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
