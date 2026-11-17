"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import { ListingCard, ListingCardSkeleton, ListingGrid } from "@/components/listing/listing-card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/primitives";
import type { Listing } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function SavedPage() {
  const { data, error, loading, reload } = useApi<{ listings: Listing[] }>("/saved");
  const listings = data?.listings ?? [];

  return (
    <>
      <PageHeader
        title="Saved homes"
        description={loading ? "Loading your wishlist…" : `${listings.length} ${listings.length === 1 ? "home" : "homes"} on your shortlist`}
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <ListingGrid className="xl:grid-cols-3">{[0, 1, 2].map((i) => <ListingCardSkeleton key={i} />)}</ListingGrid>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Tap the heart on any home to save it here and compare later."
          action={<Button asChild><Link href="/listings">Browse homes</Link></Button>}
        />
      ) : (
        <ListingGrid className="xl:grid-cols-3">
          {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </ListingGrid>
      )}
    </>
  );
}
