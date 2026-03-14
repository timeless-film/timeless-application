"use client";

import { Film } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface FilmPosterProps {
  filmId: string;
  title: string;
  posterUrl: string | null;
  genre?: string | null;
  rank?: number;
  className?: string;
}

export function FilmPoster({ filmId, title, posterUrl, genre, rank, className }: FilmPosterProps) {
  const normalizedSrc = posterUrl?.trim();
  const [hasError, setHasError] = useState(false);

  return (
    <Link
      href={`/catalog/${filmId}`}
      className={cn("group flex shrink-0 flex-col gap-1.5", className)}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg shadow-md transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-xl">
        {normalizedSrc && !hasError ? (
          <Image
            src={normalizedSrc}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 180px"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            <Film className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
        {rank !== undefined && (
          <span className="absolute bottom-1 left-2 text-5xl font-black leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {rank}
          </span>
        )}
      </div>
      <p className="truncate text-sm font-medium">{title}</p>
      {genre && <p className="truncate text-xs text-muted-foreground">{genre}</p>}
    </Link>
  );
}
