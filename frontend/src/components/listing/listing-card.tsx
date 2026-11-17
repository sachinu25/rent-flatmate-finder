import Link from "next/link";
import { BedDouble, CalendarDays, MapPin, Sofa } from "lucide-react";

import { Badge, Skeleton } from "@/components/ui/primitives";
import { availability, formatCurrency, FURNISHING_LABEL, ROOM_TYPE_LABEL } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ListingImage } from "./listing-image";
import { SaveButton } from "./save-button";
import { MatchPill } from "./score-ring";

export function ListingCard({
  listing,
  priority = false,
  showSave = true,
  className,
}: {
  listing: Listing;
  priority?: boolean;
  showSave?: boolean;
  className?: string;
}) {
  const photo = listing.photos[0];
  const place = [listing.locality, listing.location].filter(Boolean).join(", ");
  const filled = listing.status === "FILLED";

  return (
    <article className={cn("group relative", className)}>
      <Link
        href={`/listings/${listing.id}`}
        className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
          <ListingImage
            src={photo?.url}
            alt={photo?.altText ?? listing.title}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={cn("transition-transform duration-500 ease-out group-hover:scale-[1.04]", filled && "grayscale")}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {listing.compatibility && <MatchPill score={listing.compatibility.score} via={listing.compatibility.computedVia} />}
            {filled && <Badge variant="glass">Filled</Badge>}
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-1 text-[15px] font-semibold leading-snug">{listing.title}</h3>
          </div>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-1">{place}</span>
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-3.5" aria-hidden /> {ROOM_TYPE_LABEL[listing.roomType]}
            </span>
            <span className="inline-flex items-center gap-1">
              <Sofa className="size-3.5" aria-hidden /> {FURNISHING_LABEL[listing.furnishingStatus]}
            </span>
          </p>
          <div className="flex items-baseline justify-between pt-1">
            <p>
              <span className="font-display text-lg font-bold">{formatCurrency(listing.rent)}</span>
              <span className="text-sm text-muted-foreground"> / month</span>
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <CalendarDays className="size-3.5" aria-hidden />
              {availability(listing.availableFrom)}
            </span>
          </div>
        </div>
      </Link>
      {showSave && (
        <div className="absolute right-3 top-3">
          <SaveButton listingId={listing.id} initialSaved={listing.isSaved} />
        </div>
      )}
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="aspect-[4/3] rounded-2xl" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3.5 w-1/2" />
      <Skeleton className="mt-2 h-3.5 w-2/3" />
      <Skeleton className="mt-3 h-5 w-1/3" />
    </div>
  );
}

export function ListingGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>{children}</div>
  );
}
