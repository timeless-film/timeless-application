"use client";

import { Loader2Icon, SearchIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { searchFilmSuggestions } from "@/components/header-search-actions";
import { cn } from "@/lib/utils";

import type { SearchSuggestion } from "@/components/header-search-actions";

export function HeaderSearch() {
  const t = useTranslations("navigation");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSuggestions([]);
    setActiveIndex(-1);
  }, []);

  const navigateToFilm = useCallback(
    (filmId: string) => {
      router.push(`/${locale}/catalog/${filmId}`);
      close();
    },
    [router, locale, close]
  );

  const submitSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/${locale}/catalog?search=${encodeURIComponent(trimmed)}`);
    close();
  }, [query, router, locale, close]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const result = await searchFilmSuggestions(trimmed);
      setSuggestions(result.suggestions);
      setLoading(false);
    }, 250);
  }

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "Escape" && open) {
        close();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Total navigable items: suggestions + "search all" row
  const hasQuery = query.trim().length > 0;
  const totalItems = suggestions.length + (hasQuery ? 1 : 0);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % totalItems);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? totalItems - 1 : prev - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        const suggestion = suggestions[activeIndex];
        if (suggestion) navigateToFilm(suggestion.id);
      } else {
        submitSearch();
      }
    }
  }

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-md bg-white/5 px-3 py-1.5 text-sm text-white/50 transition-colors hover:bg-white/10 hover:text-white/70 md:flex"
      >
        <SearchIcon className="h-4 w-4" />
        <span>{t("searchPlaceholder")}</span>
      </button>

      {/* Mobile search icon */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-md p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white md:hidden"
      >
        <SearchIcon className="h-5 w-5" />
        <span className="sr-only">{t("searchPlaceholder")}</span>
      </button>

      {/* Search overlay */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          {/* Search panel */}
          <div className="fixed inset-x-0 top-0 z-50 mx-auto max-w-2xl px-4 pt-[15vh]">
            <div className="overflow-hidden rounded-xl border border-white/15 bg-[oklch(0.12_0_0)] shadow-2xl">
              {/* Input */}
              <div className="flex items-center gap-3 px-4">
                {loading ? (
                  <Loader2Icon className="h-5 w-5 shrink-0 animate-spin text-accent" />
                ) : (
                  <SearchIcon className="h-5 w-5 shrink-0 text-white/40" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("searchCatalogPlaceholder")}
                  className="h-14 flex-1 bg-transparent text-lg text-white placeholder:text-white/35 focus:outline-none"
                />
                <kbd
                  className={cn(
                    "rounded border border-white/20 bg-white/10 px-2 py-0.5 font-sans text-xs text-white/40",
                    hasQuery ? "hidden" : ""
                  )}
                >
                  ESC
                </kbd>
              </div>

              {/* Results */}
              {hasQuery && (
                <div className="border-t border-white/10">
                  {/* Film suggestions */}
                  {suggestions.length > 0 && (
                    <div className="px-2 py-2">
                      <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/30">
                        {t("searchResults")}
                      </p>
                      {suggestions.map((film, index) => (
                        <button
                          key={film.id}
                          onClick={() => navigateToFilm(film.id)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                            activeIndex === index
                              ? "bg-white/10 text-white"
                              : "text-white/70 hover:bg-white/5"
                          )}
                        >
                          {film.posterUrl ? (
                            <Image
                              src={film.posterUrl}
                              alt={film.title}
                              width={32}
                              height={48}
                              className="h-12 w-8 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <div className="h-12 w-8 shrink-0 rounded bg-white/10" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{film.title}</p>
                            <p className="truncate text-xs text-white/40">
                              {[film.releaseYear, film.directors?.slice(0, 2).join(", ")]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* "Search all" action */}
                  <div
                    className={cn(
                      "px-2 py-2",
                      suggestions.length > 0 && "border-t border-white/10"
                    )}
                  >
                    <button
                      onClick={submitSearch}
                      onMouseEnter={() => setActiveIndex(suggestions.length)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        activeIndex === suggestions.length
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5"
                      )}
                    >
                      <SearchIcon className="h-4 w-4 text-accent" />
                      <span>{t("searchFor", { query: query.trim() })}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
