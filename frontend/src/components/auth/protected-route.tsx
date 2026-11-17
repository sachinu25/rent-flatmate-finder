"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/contexts/auth-context";
import type { Role } from "@/lib/types";
import { homeFor } from "@/lib/utils";

/**
 * Client-side route guard (UX only). Every API endpoint independently enforces
 * authentication and role checks on the server.
 */
export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const forbidden = Boolean(user && roles && !roles.includes(user.role));

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (forbidden && user) router.replace(homeFor(user.role));
  }, [isLoading, isAuthenticated, forbidden, user, pathname, router]);

  if (isLoading || !isAuthenticated || forbidden) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center" role="status" aria-label="Loading">
        <span className="size-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
      </div>
    );
  }
  return <>{children}</>;
}
