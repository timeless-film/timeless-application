"use client";

import { Film, Loader2, Search } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

import { searchFilmsAction } from "./actions";

interface FilmSearchResult {
  id: string;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[] | null;
  releaseYear: number | null;
  directors: string[] | null;
}

interface FilmSearchPickerProps {
  onSelect: (film: FilmSearchResult) => void;
  excludeIds?: string[];
}

export function FilmSearchPicker({ onSelect, excludeIds = [] }: FilmSearchPickerProps) {
  const t = useTranslations("admin.editorial");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FilmSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value.trim()) {
        setResults([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        const result = await searchFilmsAction(value.trim());
        if ("films" in result) {
          setResults(result.films.filter((f) => !excludeIds.includes(f.id)));
        }
        setSearching(false);
      }, 300);
    },
    [excludeIds]
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        {searching ? (
          <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          type="search"
          placeholder={t("searchFilms")}
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {results.length > 0 && (
        <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border p-1">
          {results.map((film) => (
            <button
              key={film.id}
              onClick={() => {
                onSelect(film);
                setQuery("");
                setResults([]);
              }}
              className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
            >
              {film.posterUrl ? (
                <Image
                  src={film.posterUrl}
                  alt={film.title}
                  width={32}
                  height={48}
                  className="rounded object-cover"
                />
              ) : (
                <div className="flex h-12 w-8 items-center justify-center rounded bg-muted">
                  <Film className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{film.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[film.releaseYear, film.directors?.join(", ")].filter(Boolean).join(" — ")}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
