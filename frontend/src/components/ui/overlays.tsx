"use client";

import * as React from "react";
import { AlertDialog as AlertPrimitive, Avatar as AvatarPrimitive, Dialog as DialogPrimitive, DropdownMenu as MenuPrimitive } from "radix-ui";
import { X } from "lucide-react";

import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Button } from "./button";

const overlay = "fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-overlay-in";

// ── Dialog ──────────────────────────────────────────────────────────────────
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-border bg-popover p-6 text-popover-foreground shadow-lift data-[state=open]:animate-pop-in focus:outline-none",
          className,
        )}
        {...props}
      >
        <div className="mb-5 pr-8">
          <DialogPrimitive.Title className="font-display text-lg font-bold">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
        </div>
        {children}
        <DialogPrimitive.Close
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// ── Sheet (side drawer) ─────────────────────────────────────────────────────
export function SheetContent({
  className,
  children,
  title,
  side = "left",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string; side?: "left" | "bottom" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-popover text-popover-foreground shadow-lift focus:outline-none",
          side === "left"
            ? "inset-y-0 left-0 w-[86%] max-w-sm border-r border-border data-[state=open]:animate-sheet-in"
            : "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl border-t border-border data-[state=open]:animate-slide-up",
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogPrimitive.Title className="font-display text-base font-bold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          <DialogPrimitive.Close
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// ── Confirm dialog (destructive actions) ────────────────────────────────────
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className={overlay} />
        <AlertPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-popover p-6 shadow-lift data-[state=open]:animate-pop-in focus:outline-none">
          <AlertPrimitive.Title className="font-display text-lg font-bold">{title}</AlertPrimitive.Title>
          <AlertPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </AlertPrimitive.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertPrimitive.Cancel asChild>
              <Button variant="outline" disabled={loading}>Cancel</Button>
            </AlertPrimitive.Cancel>
            <Button
              variant={destructive ? "destructive" : "default"}
              loading={loading}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}

// ── Dropdown menu ───────────────────────────────────────────────────────────
export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        align={align}
        sideOffset={8}
        className={cn(
          "z-50 min-w-52 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lift data-[state=open]:animate-pop-in",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator() {
  return <MenuPrimitive.Separator className="my-1.5 h-px bg-border" />;
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("px-3 py-2", className)} {...props} />;
}

// ── Avatar ──────────────────────────────────────────────────────────────────
export function UserAvatar({
  firstName,
  lastName,
  src,
  className,
  online,
}: {
  firstName?: string;
  lastName?: string;
  src?: string | null;
  className?: string;
  online?: boolean;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <AvatarPrimitive.Root className={cn("inline-flex size-10 overflow-hidden rounded-full bg-primary-soft", className)}>
        {src && <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" />}
        <AvatarPrimitive.Fallback className="grid size-full place-items-center text-[0.8em] font-semibold text-primary">
          {initials(firstName, lastName)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {online !== undefined && (
        <span
          aria-label={online ? "Online" : "Offline"}
          className={cn(
            "absolute bottom-0 right-0 size-3 rounded-full border-2 border-card",
            online ? "bg-success" : "bg-muted-foreground/40",
          )}
        />
      )}
    </span>
  );
}
