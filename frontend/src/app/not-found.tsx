import Link from "next/link";
import { Compass } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-12 font-display text-7xl font-extrabold text-primary/20">404</p>
      <h1 className="mt-2 text-2xl font-bold">This page has moved out</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist, or the listing is no longer available.</p>
      <div className="mt-8 flex gap-3">
        <Button asChild><Link href="/listings"><Compass /> Browse homes</Link></Button>
        <Button asChild variant="outline"><Link href="/">Go home</Link></Button>
      </div>
    </main>
  );
}
