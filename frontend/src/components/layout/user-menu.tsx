"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, LayoutDashboard, LogOut, MessageCircle, Settings, Shield } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, UserAvatar } from "../ui/overlays";

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;

  const signOut = async () => {
    await logout();
    toast.success("Signed out");
    router.push("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Account menu"
      >
        <UserAvatar firstName={user.firstName} lastName={user.lastName} src={user.avatarUrl} className="size-9 text-sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <p className="text-sm font-semibold">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === "ADMIN" ? (
          <DropdownMenuItem asChild>
            <Link href="/admin"><Shield /> Admin console</Link>
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link href="/dashboard"><LayoutDashboard /> Dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/messages"><MessageCircle /> Messages</Link>
            </DropdownMenuItem>
            {user.role === "TENANT" && (
              <DropdownMenuItem asChild>
                <Link href="/dashboard/saved"><Heart /> Saved</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile"><Settings /> Profile &amp; settings</Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()} className="text-destructive [&_svg]:text-destructive">
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
