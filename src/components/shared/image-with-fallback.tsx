"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface ImageWithFallbackProps {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  className?: string;
  fallbackClassName?: string;
  priority?: boolean;
}

export function ImageWithFallback({
  src,
  alt,
  sizes,
  className,
  fallbackClassName,
  priority,
}: ImageWithFallbackProps) {
  const normalizedSrc = src?.trim();
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const hasError = Boolean(normalizedSrc) && failedSource === normalizedSrc;

  if (!normalizedSrc || hasError) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground",
          fallbackClassName
        )}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="h-8 w-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <Image
      src={normalizedSrc}
      alt={alt}
      fill
      className={className}
      sizes={sizes}
      priority={priority}
      onError={() => setFailedSource(normalizedSrc)}
    />
  );
}
