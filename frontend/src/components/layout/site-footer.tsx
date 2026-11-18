import Link from "next/link";

import { Logo } from "./logo";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/listings", label: "Browse homes" },
      { href: "/listings?roomType=SHARED", label: "Shared rooms" },
      { href: "/listings?roomType=STUDIO", label: "Studios" },
      { href: "/listings?roomType=APARTMENT", label: "Entire apartments" },
    ],
  },
  {
    title: "For tenants",
    links: [
      { href: "/register?role=TENANT", label: "Create a profile" },
      { href: "/#compatibility", label: "How matching works" },
      { href: "/dashboard/matches", label: "Your matches" },
    ],
  },
  {
    title: "For owners",
    links: [
      { href: "/register?role=OWNER", label: "List your place" },
      { href: "/dashboard/listings", label: "Manage listings" },
      { href: "/dashboard/interests", label: "Tenant requests" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Rooms, flats and flatmates — matched on budget, location and the way you actually live.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="mt-3 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Rent &amp; Flatmate Finder ·{" "}
            <span className="whitespace-nowrap">
              Developed by <span className="font-semibold text-foreground">Anumodit Shukla</span>
            </span>
          </p>
          <p>Listing photos courtesy of Unsplash contributors.</p>
        </div>
      </div>
    </footer>
  );
}
