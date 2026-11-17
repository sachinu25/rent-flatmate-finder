import type { Metadata } from "next";
import { Shield } from "lucide-react";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export const metadata: Metadata = { title: "Admin console", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute roles={["ADMIN"]}>
      <div className="min-h-dvh bg-background">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
          <div className="container-page flex h-16 items-center gap-3">
            <Logo />
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
              <Shield className="size-3.5" /> Admin
            </span>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <div className="ml-1.5">
                <UserMenu />
              </div>
            </div>
          </div>
        </header>
        <main id="main" className="container-page py-8">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
