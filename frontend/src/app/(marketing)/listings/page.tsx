import type { Metadata } from "next";
import { Suspense } from "react";

import { ListingCardSkeleton, ListingGrid } from "@/components/listing/listing-card";

import { ListingsExplorer } from "./listings-explorer";

export const metadata: Metadata = {
  title: "Browse rooms, flats & flatshares",
  description: "Search rooms and flatshares by city, locality, budget, room type, furnishing, amenities and move-in date.",
  alternates: { canonical: "/listings" },
};

export default function ListingsPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-10">
          <div className="skeleton h-10 w-56 rounded-xl" />
          <ListingGrid className="mt-10 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => <ListingCardSkeleton key={i} />)}
          </ListingGrid>
        </div>
      }
    >
      <ListingsExplorer />
    </Suspense>
  );
}
