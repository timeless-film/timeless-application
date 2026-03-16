"use client";

import { Film } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface FilmBackdropCardProps {
  filmId: string;
  title: string;
  backdropUrl: string | null;
  posterUrl: string | null;
  subtitle?: string | null;
  className?: string;
  sizes?: string;
}

export function FilmBackdropCard({
  filmId,
  title,
  backdropUrl,
  posterUrl,
  subtitle,
  className,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}: FilmBackdropCardProps) {
  const imageSource = (backdropUrl ?? posterUrl)?.trim();
  const [hasError, setHasError] = useState(false);

  return (
    <Link
      href={`/catalog/${filmId}`}
      className={cn(
        "group flex shrink-0 flex-col gap-0.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg shadow-md transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-xl">
        {imageSource && !hasError ? (
          <Image
            src={imageSource}
            alt={title}
            fill
            className="object-cover"
            sizes={sizes}
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            <Film className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
      </div>
      <p className="mt-1 truncate font-heading text-sm">{title}</p>
      {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
    </Link>
  );
}
