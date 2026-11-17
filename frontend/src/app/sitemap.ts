import type { MetadataRoute } from "next";

import type { Listing } from "@/lib/types";
import { serverFetch, SITE_URL } from "@/lib/server-api";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/listings`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/register`, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Active listings (up to 50 per page × 20 pages = 1000 URLs).
  const listings: Listing[] = [];
  for (let page = 1; page <= 20; page++) {
    const data = await serverFetch<{ listings: Listing[]; pagination: { totalPages: number } }>(`/listings?limit=50&page=${page}`, 3600);
    if (!data) break;
    listings.push(...data.listings);
    if (page >= data.pagination.totalPages) break;
  }

  return [
    ...pages,
    ...listings.map((l) => ({
      url: `${SITE_URL}/listings/${l.id}`,
      lastModified: new Date(l.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
