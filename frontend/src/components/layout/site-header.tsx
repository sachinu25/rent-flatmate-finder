"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, MessageCircle } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { useAuth } from "@/contexts/auth-context";
import { useRealtime } from "@/contexts/realtime-context";
import { cn } from "@/lib/utils";

import { NotificationBell } from "../notifications/notification-bell";
import { Button } from "../ui/button";
import { SheetContent } from "../ui/overlays";

import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const LINKS = [
  { href: "/listings", label: "Browse homes" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#compatibility", label: "AI matching" },
  { href: "/register?role=OWNER", label: "List your place" },
];

export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  const { user, isLoading } = useAuth();
  const { unreadMessages } = useRealtime();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);


  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-[background-color,border-color,backdrop-filter] duration-200",
        scrolled || !transparent
          ? "border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70"
          : "border-b border-transparent",
      )}
    >
      <div className="container-page flex h-16 items-center gap-4">
        <Logo />

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                pathname === l.href && "text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {isLoading ? (
            <div className="skeleton ml-1 h-9 w-24 rounded-xl" />
          ) : user ? (
            <>
              {user.role !== "ADMIN" && (
                <Link
                  href="/messages"
                  className="relative grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={unreadMessages ? `Messages, ${unreadMessages} unread` : "Messages"}
                >
                  <MessageCircle className="size-[18px]" />
                  {unreadMessages > 0 && (
                    <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-highlight ring-2 ring-background" />
                  )}
                </Link>
              )}
              <NotificationBell />
              <div className="ml-1.5">
                <UserMenu />
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-1 sm:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </div>
          )}

          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger
              className="ml-1 grid size-10 place-items-center rounded-xl text-foreground hover:bg-accent lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </DialogPrimitive.Trigger>
            <SheetContent title="Menu">
              <nav className="flex flex-col p-3" aria-label="Mobile" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
                {LINKS.map((l) => (
                  <Link key={l.href} href={l.href} className="rounded-xl px-3 py-3 text-[15px] font-medium hover:bg-accent">
                    {l.label}
                  </Link>
                ))}
                {user ? (
                  <Link href={user.role === "ADMIN" ? "/admin" : "/dashboard"} className="rounded-xl px-3 py-3 text-[15px] font-medium hover:bg-accent">
                    {user.role === "ADMIN" ? "Admin console" : "Dashboard"}
                  </Link>
                ) : (
                  <div className="mt-4 grid gap-2 px-1">
                    <Button asChild variant="outline">
                      <Link href="/login">Sign in</Link>
                    </Button>
                    <Button asChild>
                      <Link href="/register">Create an account</Link>
                    </Button>
                  </div>
                )}
              </nav>
            </SheetContent>
          </DialogPrimitive.Root>
        </div>
      </div>
    </header>
  );
}
