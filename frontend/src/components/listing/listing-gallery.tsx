"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Grid2x2, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import type { Photo } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ListingImage } from "./listing-image";

export function ListingGallery({ photos, title }: { photos: Photo[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const count = photos.length;

  const show = (i: number) => {
    setIndex(i);
    setOpen(true);
  };
  const go = useCallback((d: number) => setIndex((i) => (i + d + count) % count), [count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  if (count === 0) {
    return (
      <div className="relative aspect-[16/9] overflow-hidden rounded-3xl">
        <ListingImage src={null} alt={title} fill />
      </div>
    );
  }

  const tiles = photos.slice(0, 5);
  return (
    <>
      <div
        className={cn(
          "relative grid gap-2 overflow-hidden rounded-3xl",
          tiles.length >= 3 ? "aspect-[16/10] grid-cols-4 grid-rows-2 sm:aspect-[2.2/1]" : "aspect-[16/9] grid-cols-1",
        )}
      >
        {tiles.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => show(i)}
            className={cn(
              "group relative overflow-hidden bg-muted focus-visible:z-10",
              tiles.length >= 3 && i === 0 && "col-span-4 row-span-2 sm:col-span-2",
              tiles.length >= 3 && i > 0 && "hidden sm:block",
              tiles.length === 3 && i > 0 && "sm:col-span-2",
              tiles.length === 4 && i === 3 && "sm:col-span-2",
            )}
            aria-label={`Open photo ${i + 1} of ${count}`}
          >
            <ListingImage
              src={p.url}
              alt={p.altText ?? `${title} photo ${i + 1}`}
              fill
              priority={i === 0}
              sizes={i === 0 ? "(min-width: 640px) 50vw, 100vw" : "25vw"}
              className="transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </button>
        ))}
        {count > 1 && (
          <button
            type="button"
            onClick={() => show(0)}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-xl bg-white/95 px-3.5 py-2 text-sm font-semibold text-stone-900 shadow-soft backdrop-blur hover:bg-white"
          >
            <Grid2x2 className="size-4" /> Show all {count} photos
          </button>
        )}
      </div>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/92 data-[state=open]:animate-overlay-in" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col focus:outline-none" aria-describedby={undefined}>
            <DialogPrimitive.Title className="sr-only">{title} — photos</DialogPrimitive.Title>
            <div className="flex items-center justify-between p-4 text-white">
              <span className="text-sm font-medium tabular-nums">
                {index + 1} / {count}
              </span>
              <DialogPrimitive.Close className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Close gallery">
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>
            <div className="relative flex-1">
              <ListingImage
                key={photos[index]?.id}
                src={photos[index]?.url}
                alt={photos[index]?.altText ?? `${title} photo ${index + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
              />
              {count > 1 && (
                <>
                  <button onClick={() => go(-1)} className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-stone-900 hover:bg-white" aria-label="Previous photo">
                    <ChevronLeft className="size-5" />
                  </button>
                  <button onClick={() => go(1)} className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-stone-900 hover:bg-white" aria-label="Next photo">
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )}
            </div>
            <div className="flex justify-center gap-2 overflow-x-auto p-4 scrollbar-none">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setIndex(i)}
                  className={cn("relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition", i === index ? "ring-white" : "opacity-50 ring-transparent hover:opacity-100")}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={i === index}
                >
                  <ListingImage src={p.url} alt="" fill sizes="80px" />
                </button>
              ))}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
