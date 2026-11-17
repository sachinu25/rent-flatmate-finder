import type { Metadata } from "next";

import { AppShell } from "@/components/app/app-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute roles={["TENANT", "OWNER"]}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
