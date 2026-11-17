import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatCurrency, ROOM_TYPE_LABEL } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { serverFetch, SITE_URL } from "@/lib/server-api";

import { ListingDetail } from "./listing-detail";

type Props = { params: Promise<{ id: string }> };

const getListing = async (id: string) => (await serverFetch<{ listing: Listing }>(`/listings/${encodeURIComponent(id)}`, 30))?.listing ?? null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: "Listing not found", robots: { index: false } };

  const place = [listing.locality, listing.location].filter(Boolean).join(", ");
  const title = `${listing.title} — ${formatCurrency(listing.rent)}/month in ${place}`;
  const description = `${ROOM_TYPE_LABEL[listing.roomType]} in ${place}. ${listing.description.slice(0, 140)}`;
  const image = listing.photos[0]?.url;
  return {
    title,
    description,
    alternates: { canonical: `/listings/${listing.id}` },
    openGraph: { title, description, type: "website", images: image?.startsWith("https://") ? [{ url: image }] : undefined },
    robots: listing.status === "FILLED" ? { index: false, follow: true } : undefined,
  };
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    name: listing.title,
    description: listing.description,
    url: `${SITE_URL}/listings/${listing.id}`,
    image: listing.photos.map((p) => p.url).filter((u) => u.startsWith("https://")),
    address: { "@type": "PostalAddress", addressLocality: listing.locality ?? listing.location, addressRegion: listing.location, addressCountry: "IN" },
    amenityFeature: listing.amenities.map((a) => ({ "@type": "LocationFeatureSpecification", name: a, value: true })),
    occupancy: { "@type": "QuantitativeValue", maxValue: listing.maxOccupants },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output with "<" escaped is safe to inline.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ListingDetail listing={listing} />
    </>
  );
}
