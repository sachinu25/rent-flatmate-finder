"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Building2,
  Compass,
  Heart,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageCircle,
  PlusCircle,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SheetContent } from "@/components/ui/overlays";
import { useAuth } from "@/contexts/auth-context";
import { useRealtime } from "@/contexts/realtime-context";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: "messages" | "notifications";
  exact?: boolean;
}

const TENANT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/listings", label: "Browse homes", icon: Compass },
  { href: "/dashboard/matches", label: "My matches", icon: Sparkles },
  { href: "/dashboard/saved", label: "Saved", icon: Heart },
  { href: "/dashboard/interests", label: "My requests", icon: Inbox },
  { href: "/messages", label: "Messages", icon: MessageCircle, badge: "messages" },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
];

const OWNER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/listings", label: "My listings", icon: Building2, exact: true },
  { href: "/dashboard/listings/new", label: "New listing", icon: PlusCircle },
  { href: "/dashboard/interests", label: "Requests", icon: Inbox },
  { href: "/messages", label: "Messages", icon: MessageCircle, badge: "messages" },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
  { href: "/dashboard/profile", label: "Account", icon: UserRound },
];

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { unreadMessages, unreadNotifications } = useRealtime();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Dashboard">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const count = item.badge === "messages" ? unreadMessages : item.badge === "notifications" ? unreadNotifications : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <item.icon className="size-[18px]" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {count > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-highlight px-1.5 text-[11px] font-bold leading-5 text-highlight-foreground">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const items = user?.role === "OWNER" ? OWNER_NAV : TENANT_NAV;
  const roleLabel = user?.role === "OWNER" ? "Owner" : "Tenant";

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card/60 lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo href="/" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{roleLabel} workspace</p>
          <NavLinks items={items} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger className="grid size-10 place-items-center rounded-xl hover:bg-accent lg:hidden" aria-label="Open navigation">
              <Menu className="size-5" />
            </DialogPrimitive.Trigger>
            <SheetContent title={`${roleLabel} workspace`}>
              <div className="p-3">
                <NavLinks items={items} onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </DialogPrimitive.Root>
          <div className="lg:hidden">
            <Logo href="/" />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <div className="ml-1.5">
              <UserMenu />
            </div>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <div className="mx-auto w-full max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
