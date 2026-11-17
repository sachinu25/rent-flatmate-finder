import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, Plus_Jakarta_Sans } from "next/font/google";

import { themeInitScript } from "@/contexts/theme-context";

import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap", weight: ["500", "600", "700", "800"] });
const instrument = Instrument_Serif({ subsets: ["latin"], variable: "--font-instrument", display: "swap", weight: "400", style: ["normal", "italic"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "Find rooms, flats and compatible flatmates. Search by city, budget and room type, and see an explainable compatibility score for every listing.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Rent & Flatmate Finder — Find your space. Meet your people.", template: "%s · Rent & Flatmate Finder" },
  description: DESCRIPTION,
  applicationName: "Rent & Flatmate Finder",
  authors: [{ name: "Sachin Upadhyay" }],
  creator: "Sachin Upadhyay",
  keywords: ["rent", "room for rent", "flatmate", "roommate", "PG", "shared flat", "India"],
  openGraph: {
    type: "website",
    siteName: "Rent & Flatmate Finder",
    title: "Find Your Perfect Space. Meet Your Perfect People.",
    description: DESCRIPTION,
    url: "/",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title: "Rent & Flatmate Finder", description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1111" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jakarta.variable} ${instrument.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-[60] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
