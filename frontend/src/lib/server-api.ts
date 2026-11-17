import "server-only";

/**
 * Server-side (RSC) fetch against the backend for public, cacheable data
 * (landing page, listing pages, sitemap). Never sends user credentials.
 * Returns null instead of throwing so pages degrade gracefully when the API
 * is unreachable.
 */
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:5000").replace(/\/$/, "");

export async function serverFetch<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api${path}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
