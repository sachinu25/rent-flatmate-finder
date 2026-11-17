import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Brain,
  CalendarCheck,
  Check,
  Cigarette,
  Coffee,
  Dog,
  Heart,
  HandCoins,
  Home,
  MapPin,
  MessagesSquare,
  Moon,
  Quote,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Utensils,
  X,
} from "lucide-react";

import { HeroSearch } from "@/components/landing/hero-search";
import { ListingCard, ListingGrid } from "@/components/listing/listing-card";
import { ScoreRing } from "@/components/listing/score-ring";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import type { Listing } from "@/lib/types";
import { serverFetch } from "@/lib/server-api";

export const revalidate = 60;

const STEPS = [
  {
    icon: UserRoundCheck,
    title: "Tell us how you live",
    body: "Budget, area and move-in date — plus the things that actually make or break a flatshare: sleep schedule, cleanliness, food, smoking and pets.",
  },
  {
    icon: SearchCheck,
    title: "See your fit, instantly",
    body: "Every listing shows a compatibility score with a transparent breakdown. Ask for a deeper AI analysis whenever you want a second opinion.",
  },
  {
    icon: MessagesSquare,
    title: "Connect and move in",
    body: "Send a request with a short intro. Once the owner accepts, chat in real time to arrange a visit — no phone numbers shared until you choose.",
  },
];

const FACTORS = [
  { icon: HandCoins, label: "Budget fit", weight: 35 },
  { icon: MapPin, label: "Location", weight: 25 },
  { icon: CalendarCheck, label: "Move-in timing", weight: 15 },
  { icon: Moon, label: "Sleep schedule", weight: 5 },
  { icon: Sparkles, label: "Cleanliness", weight: 5 },
  { icon: Utensils, label: "Food habits", weight: 5 },
  { icon: Cigarette, label: "Smoking", weight: 5 },
  { icon: Dog, label: "Pets", weight: 5 },
];

const FEATURES = [
  { icon: Brain, title: "Explainable matching", body: "Scores come with reasons, conflicts and next steps — never a mystery number." },
  { icon: ShieldCheck, title: "Privacy by default", body: "Contact details stay private. Chat opens only after an owner accepts your request." },
  { icon: BellRing, title: "Real-time updates", body: "Instant notifications for new matches, request decisions, messages and price changes." },
  { icon: Heart, title: "Shortlists that stick", body: "Save homes to your wishlist and compare them side by side when you're ready." },
  { icon: BadgeCheck, title: "Built for owners too", body: "Manage listings, photos and requests — and see which tenants fit your household." },
  { icon: Coffee, title: "Honest by design", body: "If we don't know something about you or a home, we say so instead of guessing." },
];

const TESTIMONIALS = [
  {
    quote: "Seeing the clash on sleep schedules before visiting saved me two wasted weekends. The breakdown was more useful than the score itself.",
    name: "Graduate student",
    meta: "Shared room · Delhi",
  },
  {
    quote: "I listed a room on Monday and had three thoughtful requests by Wednesday, each with a clear picture of how they'd fit with my flatmates.",
    name: "Live-in owner",
    meta: "2BHK · Bangalore",
  },
  {
    quote: "Being able to chat inside the app without sharing my number first made the whole process feel a lot safer.",
    name: "Product designer",
    meta: "Studio · Mumbai",
  },
];

export default async function HomePage() {
  const [featured, stats, cities] = await Promise.all([
    serverFetch<{ listings: Listing[] }>("/listings/featured"),
    serverFetch<{ activeListings: number; cities: number; acceptedMatches: number }>("/stats/public", 300),
    serverFetch<{ cities: { city: string; count: number }[] }>("/listings/cities", 300),
  ]);
  const listings = featured?.listings ?? [];
  const showStats = Boolean(stats && stats.activeListings > 0);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_15%_0%,hsl(var(--primary)/0.10),transparent_70%),radial-gradient(40%_40%_at_95%_20%,hsl(var(--highlight)/0.10),transparent_70%)]"
        />
        <div className="container-page grid items-center gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-24 lg:pt-20">
          {/* z-10: the animated column is its own stacking context; keep it (and the
              search bar that overlaps the image on desktop) above the image column. */}
          <div className="relative z-10 animate-slide-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-soft">
              <Sparkles className="size-3.5 text-highlight" aria-hidden /> Rooms, flats &amp; flatmates — matched on how you live
            </p>
            <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4.1rem]">
              Find Your Perfect Space.
              <span className="mt-1 block font-serif text-[1.08em] font-normal italic tracking-[-0.01em] text-primary">
                Meet Your Perfect People.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Search rooms and flatshares by city, budget and room type — and see, before you visit, how well each
              home fits your routine, your habits and your wallet.
            </p>
            <div className="relative z-10 mt-8 max-w-3xl lg:-mr-24">
              <HeroSearch cities={cities?.cities.map((c) => c.city) ?? []} />
            </div>
            {cities && cities.cities.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Popular:</span>
                {cities.cities.slice(0, 5).map((c) => (
                  <Link
                    key={c.city}
                    href={`/listings?city=${encodeURIComponent(c.city)}`}
                    className="rounded-full border border-border bg-card px-3 py-1 font-medium transition-colors hover:border-primary hover:text-primary"
                  >
                    {c.city}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="relative mx-auto w-full max-w-xl animate-fade-in lg:max-w-none">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift sm:aspect-[5/5]">
              <Image
                src="/images/hero-living.jpg"
                alt="Bright, plant-filled shared living room"
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 90vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            </div>
            {/* Illustrative UI preview — labelled as an example, not real data */}
            <div className="absolute -bottom-6 left-3 right-3 rounded-3xl border border-border bg-card/95 p-4 shadow-lift backdrop-blur-md sm:left-auto sm:right-[-1.5rem] sm:w-80">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compatibility preview</p>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Example</span>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <ScoreRing score={87} size={64} />
                <ul className="space-y-1.5 text-[13px]">
                  <li className="flex items-center gap-2"><Check className="size-3.5 text-success" /> Within your budget</li>
                  <li className="flex items-center gap-2"><Check className="size-3.5 text-success" /> Same sleep schedule</li>
                  <li className="flex items-center gap-2"><X className="size-3.5 text-destructive" /> No pets allowed</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live stats (real counts only) ─────────────────────────────────── */}
      {showStats && stats && (
        <section aria-label="Platform statistics" className="border-y border-border bg-card/60">
          <div className="container-page grid grid-cols-3 divide-x divide-border py-8 text-center">
            {[
              { value: stats.activeListings, label: "Homes available now" },
              { value: stats.cities, label: stats.cities === 1 ? "City" : "Cities" },
              { value: stats.acceptedMatches, label: "Accepted requests" },
            ].map((s) => (
              <div key={s.label} className="px-2">
                <p className="font-display text-3xl font-bold tabular-nums sm:text-4xl">{s.value.toLocaleString("en-IN")}</p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="pb-3 text-center text-[11px] text-muted-foreground">Live counts from the platform database</p>
        </section>
      )}

      {/* ── Featured ─────────────────────────────────────────────────────── */}
      <section className="container-page py-20 sm:py-24" aria-labelledby="featured-heading">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Fresh on the market</p>
            <h2 id="featured-heading" className="mt-2 text-3xl font-bold sm:text-4xl">Featured homes</h2>
          </div>
          <Button asChild variant="outline">
            <Link href="/listings">
              View all homes <ArrowRight />
            </Link>
          </Button>
        </div>
        {listings.length > 0 ? (
          <ListingGrid className="xl:grid-cols-3">
            {listings.map((l, i) => (
              <ListingCard key={l.id} listing={l} priority={i < 3} />
            ))}
          </ListingGrid>
        ) : (
          <EmptyState
            icon={Home}
            title="New homes are on their way"
            description="There are no featured listings right now. Check back soon or list your own place."
            action={
              <Button asChild>
                <Link href="/register?role=OWNER">List your place</Link>
              </Button>
            }
          />
        )}
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-20 bg-card/60 py-20 sm:py-24" aria-labelledby="how-heading">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">How it works</p>
            <h2 id="how-heading" className="mt-2 text-3xl font-bold text-balance sm:text-4xl">From search to keys in three steps</h2>
          </div>
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-3xl border border-border bg-card p-7 shadow-soft">
                <span className="absolute right-6 top-5 font-display text-5xl font-extrabold text-border">{i + 1}</span>
                <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <s.icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-6 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── AI compatibility ─────────────────────────────────────────────── */}
      <section id="compatibility" className="container-page scroll-mt-20 py-20 sm:py-28" aria-labelledby="ai-heading">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Compatibility, explained</p>
            <h2 id="ai-heading" className="mt-2 text-3xl font-bold text-balance sm:text-4xl">
              A score you can actually <span className="font-serif font-normal italic text-primary">trust</span>
            </h2>
            <p className="mt-5 text-muted-foreground sm:text-lg">
              Every listing gets an instant, rule-based score from the factors below. Want more nuance? Run an AI analysis that
              reads the description and your bio, then explains strengths, likely conflicts and what to ask the owner.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                ["Transparent weights", "Budget and location matter most; lifestyle fit fine-tunes the result."],
                ["Unknowns stay unknown", "Unanswered questions are left out of the score — never guessed."],
                ["Validated AI output", "AI results are schema-checked; if the AI is unavailable, the rule-based score is used and clearly labelled."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                    <Check className="size-3.5" />
                  </span>
                  <span>
                    <span className="font-semibold">{t}.</span> <span className="text-muted-foreground">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-lift sm:p-8">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">What we compare</h3>
              <span className="text-xs text-muted-foreground">Max points</span>
            </div>
            <ul className="mt-5 space-y-3.5">
              {FACTORS.map((f) => (
                <li key={f.label} className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <f.icon className="size-4" aria-hidden />
                  </span>
                  <span className="w-32 text-sm font-medium">{f.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(f.weight / 35) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right text-sm font-semibold tabular-nums">{f.weight}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-2xl bg-secondary p-4 text-xs leading-relaxed text-muted-foreground">
              Gender, religion and other personal characteristics are never used in scoring. Flatmate gender preference is a search
              filter only.
            </p>
          </div>
        </div>
      </section>

      {/* ── Why us ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-foreground py-20 text-background sm:py-24" aria-labelledby="why-heading">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-highlight">Why Rent &amp; Flatmate</p>
            <h2 id="why-heading" className="mt-2 text-3xl font-bold text-balance sm:text-4xl">Less scrolling. Fewer surprises. Better flatmates.</h2>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-background/10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-foreground p-7">
                <f.icon className="size-6 text-highlight" aria-hidden />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-background/65">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials (illustrative) ──────────────────────────────────── */}
      <section className="container-page py-20 sm:py-24" aria-labelledby="stories-heading">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">The experience we&apos;re building</p>
          <h2 id="stories-heading" className="mt-2 text-3xl font-bold sm:text-4xl">Designed around real renting headaches</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Illustrative sample testimonials describing intended use — not quotes from real users.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-3xl border border-border bg-card p-7 shadow-soft">
              <Quote className="size-7 text-primary/40" aria-hidden />
              <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed">{t.quote}</blockquote>
              <figcaption className="mt-6 border-t border-border pt-4">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.meta} · Sample</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="container-page pb-24" aria-label="Get started">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="relative flex min-h-80 flex-col justify-end overflow-hidden rounded-[2rem] p-8 text-white sm:p-10">
            <Image src="/images/friends.jpg" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
            <div className="relative">
              <h2 className="text-2xl font-bold sm:text-3xl">Looking for a place?</h2>
              <p className="mt-2 max-w-md text-white/80">Build your profile in two minutes and see your best matches straight away.</p>
              <Button asChild size="lg" variant="highlight" className="mt-6">
                <Link href="/register?role=TENANT">
                  Find my match <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative flex min-h-80 flex-col justify-end overflow-hidden rounded-[2rem] p-8 text-white sm:p-10">
            <Image src="/images/owner.jpg" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/60 to-primary/10" />
            <div className="relative">
              <h2 className="text-2xl font-bold sm:text-3xl">Have a room to fill?</h2>
              <p className="mt-2 max-w-md text-white/85">List for free, manage requests in one place and meet tenants who fit your household.</p>
              <Button asChild size="lg" className="mt-6 bg-white text-stone-900 hover:bg-white/90">
                <Link href="/register?role=OWNER">
                  List your place <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
