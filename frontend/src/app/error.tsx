"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaced in the browser console / Vercel logs; no sensitive data is shown to the user.
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">An unexpected error occurred. Please try again.</p>
      {error.digest && <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}><RotateCw /> Try again</Button>
    </main>
  );
}
