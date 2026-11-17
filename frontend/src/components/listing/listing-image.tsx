"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * next/image wrapper with a graceful fallback when an image is missing or fails
 * to load. Locally stored uploads (dev) bypass the optimizer, which refuses to
 * fetch from local IPs by design.
 */
export function ListingImage({
  src,
  alt,
  className,
  ...props
}: Omit<ImageProps, "src"> & { src?: string | null }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt || "No photo available"}
        className={cn(
          "flex size-full items-center justify-center bg-gradient-to-br from-primary-soft via-secondary to-highlight-soft text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-6 opacity-60" aria-hidden />
      </div>
    );
  }

  const local = src.startsWith("/uploads") || /^https?:\/\/(localhost|127\.0\.0\.1)/.test(src);
  return (
    <Image
      src={src}
      alt={alt}
      unoptimized={local}
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
      {...props}
    />
  );
}
