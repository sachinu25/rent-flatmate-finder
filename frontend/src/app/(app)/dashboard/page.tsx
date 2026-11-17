"use client";

import { useAuth } from "@/contexts/auth-context";

import { OwnerOverview } from "./owner-overview";
import { TenantOverview } from "./tenant-overview";

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === "OWNER" ? <OwnerOverview /> : <TenantOverview />;
}
