"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Optimistic wishlist toggle. Anonymous users are sent to sign in. */
export function SaveButton({
  listingId,
  initialSaved = false,
  variant = "overlay",
  onChange,
}: {
  listingId: string;
  initialSaved?: boolean;
  variant?: "overlay" | "inline";
  onChange?: (saved: boolean) => void;
}) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`);
      return;
    }
    if (busy) return;
    const next = !saved;
    setSaved(next);
    setBusy(true);
    try {
      if (next) await api.put(`/saved/${listingId}`);
      else await api.delete(`/saved/${listingId}`);
      onChange?.(next);
      toast.success(next ? "Saved to your wishlist" : "Removed from wishlist");
    } catch (err) {
      setSaved(!next);
      toast.error(errorMessage(err, "Could not update wishlist"));
    } finally {
      setBusy(false);
    }
  };

  const label = saved ? "Remove from wishlist" : "Save to wishlist";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        aria-label={label}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-accent"
      >
        <Heart className={cn("size-4 transition-transform", saved && "scale-110 fill-highlight text-highlight")} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full bg-white/90 text-stone-800 shadow-soft backdrop-blur transition-transform hover:scale-105 active:scale-95"
    >
      <Heart className={cn("size-[18px] transition-all", saved && "scale-110 fill-highlight text-highlight")} />
    </button>
  );
}
