"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, SearchX, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { countActive, EMPTY_FILTERS, ListingFilters, type Filters } from "@/components/listing/listing-filters";
import { ListingCard, ListingCardSkeleton, ListingGrid } from "@/components/listing/listing-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { SheetContent } from "@/components/ui/overlays";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/auth-context";
import { qs } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks";
import { useApi } from "@/lib/use-api";
import type { Listing, Pagination as PageInfo } from "@/lib/types";

function fromParams(sp: URLSearchParams): Filters {
  return {
    q: sp.get("q") ?? "",
    city: sp.get("city") ?? sp.get("location") ?? "",
    locality: sp.get("locality") ?? "",
    minRent: sp.get("minRent") ?? "",
    maxRent: sp.get("maxRent") ?? "",
    roomType: sp.get("roomType") ?? "",
    furnishingStatus: sp.get("furnishingStatus") ?? "",
    genderPreference: sp.get("genderPreference") ?? "",
    amenities: sp.get("amenities")?.split(",").filter(Boolean) ?? [],
    availableBy: sp.get("availableBy") ?? "",
    sort: sp.get("sort") ?? "newest",
  };
}

function toQuery(f: Filters, page: number) {
  return qs({
    q: f.q.trim(),
    city: f.city.trim(),
    locality: f.locality.trim(),
    minRent: f.minRent,
    maxRent: f.maxRent,
    roomType: f.roomType,
    furnishingStatus: f.furnishingStatus,
    genderPreference: f.genderPreference,
    amenities: f.amenities.join(","),
    availableBy: f.availableBy,
    sort: f.sort === "newest" ? "" : f.sort,
    page: page > 1 ? page : "",
  });
}

export function ListingsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [filters, setFilters] = useState<Filters>(() => fromParams(new URLSearchParams(searchParams.toString())));
  const [page, setPage] = useState(() => Number(searchParams.get("page") ?? 1) || 1);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Typing is debounced; discrete choices (chips, selects) apply immediately.
  // (A string key keeps the debounced value referentially stable.)
  const textKey = JSON.stringify([filters.q, filters.city, filters.locality, filters.minRent, filters.maxRent]);
  const debouncedKey = useDebouncedValue(textKey, 400);
  const query = useMemo(() => {
    const [q, city, locality, minRent, maxRent] = JSON.parse(debouncedKey) as string[];
    return toQuery({ ...filters, q: q!, city: city!, locality: locality!, minRent: minRent!, maxRent: maxRent! }, page);
  }, [debouncedKey, filters, page]);

  // Keep the URL in sync (shareable, back-button friendly).
  useEffect(() => {
    router.replace(`${pathname}${query}`, { scroll: false });
  }, [query, pathname, router]);

  // Wait for auth so tenants get compatibility scores on the first load.
  // Previous results stay visible (dimmed) while the next query loads.
  const { data, error, loading: fetching, reload } = useApi<{ listings: Listing[]; pagination: PageInfo; scored: boolean }>(
    authLoading ? null : `/listings${query}${query ? "&" : "?"}limit=12`,
  );
  const loading = authLoading || fetching;

  const update = useCallback((patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  const clearAll = () => {
    setFilters({ ...EMPTY_FILTERS, sort: filters.sort });
    setPage(1);
  };

  const active = countActive(filters);
  const total = data?.pagination.total ?? 0;
  const isTenant = user?.role === "TENANT";

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Find a home</h1>
          <p className="mt-1.5 text-muted-foreground">
            {loading && !data ? "Searching…" : `${total.toLocaleString("en-IN")} ${total === 1 ? "home" : "homes"} match your search`}
          </p>
        </div>

        {/* Search + controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search listings</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="Search by title, area or keyword"
              className="h-12 w-full rounded-2xl border border-input bg-card pl-11 pr-4 text-sm shadow-soft outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15"
            />
          </label>
          <div className="flex gap-2">
            <DialogPrimitive.Root open={sheetOpen} onOpenChange={setSheetOpen}>
              <DialogPrimitive.Trigger asChild>
                <Button variant="outline" className="h-12 flex-1 rounded-2xl lg:hidden">
                  <SlidersHorizontal /> Filters
                  {active > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">{active}</span>}
                </Button>
              </DialogPrimitive.Trigger>
              <SheetContent title="Filters" side="bottom">
                <div className="p-5">
                  <ListingFilters value={filters} onChange={update} idPrefix="m" />
                </div>
                <div className="sticky bottom-0 flex gap-3 border-t border-border bg-popover p-4">
                  <Button variant="ghost" onClick={clearAll} disabled={active === 0}>Clear all</Button>
                  <Button className="flex-1" onClick={() => setSheetOpen(false)}>
                    Show {loading ? "" : total} {total === 1 ? "home" : "homes"}
                  </Button>
                </div>
              </SheetContent>
            </DialogPrimitive.Root>
            <div className="w-48 shrink-0">
              <label htmlFor="sort" className="sr-only">Sort by</label>
              <Select id="sort" value={filters.sort} onChange={(e) => update({ sort: e.target.value })} className="h-12 rounded-2xl">
                <option value="newest">Newest first</option>
                {isTenant && <option value="match">Best match</option>}
                <option value="rent_asc">Rent: low to high</option>
                <option value="rent_desc">Rent: high to low</option>
                <option value="available_soonest">Available soonest</option>
              </Select>
            </div>
          </div>
        </div>

        {isTenant && data && !data.scored && (
          <div className="flex flex-col gap-3 rounded-2xl border border-highlight/30 bg-highlight-soft p-4 sm:flex-row sm:items-center">
            <Sparkles className="size-5 shrink-0 text-highlight" aria-hidden />
            <p className="flex-1 text-sm">Add your preferences to see a compatibility score on every listing.</p>
            <Button asChild size="sm" variant="highlight">
              <Link href="/dashboard/profile">Complete profile</Link>
            </Button>
          </div>
        )}

        {active > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {filters.city && <ActiveChip label={`City: ${filters.city}`} onClear={() => update({ city: "" })} />}
            {filters.locality && <ActiveChip label={`Area: ${filters.locality}`} onClear={() => update({ locality: "" })} />}
            {(filters.minRent || filters.maxRent) && (
              <ActiveChip label={`₹${filters.minRent || 0} – ${filters.maxRent ? `₹${filters.maxRent}` : "any"}`} onClear={() => update({ minRent: "", maxRent: "" })} />
            )}
            {filters.roomType && <ActiveChip label={filters.roomType.toLowerCase()} onClear={() => update({ roomType: "" })} />}
            {filters.furnishingStatus && <ActiveChip label={filters.furnishingStatus.replace("_", "-").toLowerCase()} onClear={() => update({ furnishingStatus: "" })} />}
            {filters.genderPreference && <ActiveChip label={`Open to ${filters.genderPreference.toLowerCase()}`} onClear={() => update({ genderPreference: "" })} />}
            {filters.availableBy && <ActiveChip label={`Move in by ${filters.availableBy}`} onClear={() => update({ availableBy: "" })} />}
            {filters.amenities.map((a) => (
              <ActiveChip key={a} label={a} onClear={() => update({ amenities: filters.amenities.filter((x) => x !== a) })} />
            ))}
            <button onClick={clearAll} className="text-sm font-semibold text-primary hover:underline">Clear all</button>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[17rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2 scrollbar-none">
            <ListingFilters value={filters} onChange={update} />
          </div>
        </aside>

        <section aria-live="polite" aria-busy={loading}>
          {error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : loading && !data ? (
            <ListingGrid className="xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => <ListingCardSkeleton key={i} />)}
            </ListingGrid>
          ) : data && data.listings.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No homes match these filters"
              description="Try widening your budget, removing an amenity or searching a nearby area."
              action={active > 0 || filters.q ? <Button variant="outline" onClick={() => { clearAll(); update({ q: "" }); }}>Reset search</Button> : undefined}
            />
          ) : (
            <div className={loading ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
              <ListingGrid className="xl:grid-cols-3">
                {data?.listings.map((l, i) => <ListingCard key={l.id} listing={l} priority={i < 3} />)}
              </ListingGrid>
              <div className="mt-12">
                <Pagination
                  page={page}
                  totalPages={data?.pagination.totalPages ?? 1}
                  onChange={(p) => {
                    setPage(p);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1.5 text-xs font-medium capitalize">
      {label}
      <button onClick={onClear} className="grid size-5 place-items-center rounded-full hover:bg-accent" aria-label={`Remove filter ${label}`}>
        <X className="size-3" />
      </button>
    </span>
  );
}
