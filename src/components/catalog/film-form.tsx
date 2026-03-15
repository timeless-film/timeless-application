"use client";

import { Loader2, RefreshCw, Search, Unlink } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createFilmAction,
  disassociateTmdbAction,
  resyncTmdbAction,
  searchTmdb,
  updateTmdbManualAction,
  updateFilmAction,
} from "@/app/[locale]/(rights-holder)/films/actions";
import { ImageUpload } from "@/components/shared/image-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";

import { PriceZonesEditor } from "./price-zones-editor";

import type { PriceZone } from "./price-zones-editor";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TmdbResult {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  overview: string;
}

interface FilmData {
  id: string;
  title: string;
  externalId: string | null;
  type: "direct" | "validation";
  status: "active" | "inactive" | "retired";
  tmdbId: number | null;
  tmdbMatchStatus: "matched" | "pending" | "no_match" | "manual" | null;
  releaseYear: number | null;
  originalTitle: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  synopsis: string | null;
  synopsisEn: string | null;
  directors: string[] | null;
  cast: string[] | null;
  duration: number | null;
  genres: string[] | null;
  prices: { id: string; countries: string[]; price: number; currency: string }[];
}

interface FilmFormProps {
  mode: "create" | "edit";
  film?: FilmData;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilmForm({ mode, film }: FilmFormProps) {
  const t = useTranslations("films");
  const router = useRouter();

  // ─── Form state ──────────────────────────────────────────────────────────

  const [title, setTitle] = useState(film?.title ?? "");
  const [externalId, setExternalId] = useState(film?.externalId ?? "");
  const [type, setType] = useState<"direct" | "validation">(film?.type ?? "direct");
  const [status, setStatus] = useState<"active" | "inactive">(
    film?.status === "retired" ? "inactive" : (film?.status ?? "active")
  );
  const [zones, setZones] = useState<PriceZone[]>(
    film?.prices.map((p) => ({
      countries: p.countries,
      price: p.price,
      currency: p.currency,
    })) ?? [{ countries: [], price: 0, currency: "EUR" }]
  );

  // ─── TMDB search state ──────────────────────────────────────────────────

  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [selectedTmdbId, setSelectedTmdbId] = useState<number | null>(film?.tmdbId ?? null);
  const [selectedTmdbTitle, setSelectedTmdbTitle] = useState<string | null>(
    film?.originalTitle ?? film?.title ?? null
  );
  const [selectedTmdbYear, setSelectedTmdbYear] = useState<number | null>(
    film?.releaseYear ?? null
  );
  const [selectedTmdbPoster, setSelectedTmdbPoster] = useState<string | null>(
    film?.posterUrl ?? null
  );
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Submit state ────────────────────────────────────────────────────────

  const [saving, setSaving] = useState(false);

  // ─── TMDB sync state (edit mode) ────────────────────────────────────────

  const [syncing, setSyncing] = useState(false);
  const [tmdbStatus, setTmdbStatus] = useState(film?.tmdbMatchStatus ?? null);
  const [tmdbPoster, setTmdbPoster] = useState(film?.posterUrl ?? null);
  const [tmdbOriginalTitle, setTmdbOriginalTitle] = useState(film?.originalTitle ?? null);
  const [tmdbYear, setTmdbYear] = useState(film?.releaseYear ?? null);
  const [tmdbSynopsis, setTmdbSynopsis] = useState(film?.synopsis ?? null);
  const [tmdbSynopsisEn, setTmdbSynopsisEn] = useState(film?.synopsisEn ?? null);
  const [tmdbDirectors, setTmdbDirectors] = useState(film?.directors ?? null);
  const [tmdbCast, setTmdbCast] = useState(film?.cast ?? null);
  const [tmdbDuration, setTmdbDuration] = useState(film?.duration ?? null);
  const [tmdbGenres, setTmdbGenres] = useState(film?.genres ?? null);
  const [manualOriginalTitle, setManualOriginalTitle] = useState(film?.originalTitle ?? "");
  const [manualSynopsis, setManualSynopsis] = useState(film?.synopsis ?? "");
  const [manualSynopsisEn, setManualSynopsisEn] = useState(film?.synopsisEn ?? "");
  const [manualDirectors, setManualDirectors] = useState((film?.directors ?? []).join(", "));
  const [manualGenres, setManualGenres] = useState((film?.genres ?? []).join(", "));
  const [manualCast, setManualCast] = useState((film?.cast ?? []).join(", "));
  const [manualReleaseYear, setManualReleaseYear] = useState(
    film?.releaseYear ? String(film.releaseYear) : ""
  );
  const [manualDuration, setManualDuration] = useState(film?.duration ? String(film.duration) : "");
  const [manualPosterUrl, setManualPosterUrl] = useState(film?.posterUrl ?? "");
  const [manualBackdropUrl, setManualBackdropUrl] = useState(film?.backdropUrl ?? "");

  // ─── Unsaved changes guard ──────────────────────────────────────────────

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        title,
        externalId,
        type,
        status,
        zones,
        selectedTmdbId,
        manualOriginalTitle,
        manualSynopsis,
        manualSynopsisEn,
        manualDirectors,
        manualGenres,
        manualCast,
        manualReleaseYear,
        manualDuration,
        manualPosterUrl,
        manualBackdropUrl,
      }),
    [
      title,
      externalId,
      type,
      status,
      zones,
      selectedTmdbId,
      manualOriginalTitle,
      manualSynopsis,
      manualSynopsisEn,
      manualDirectors,
      manualGenres,
      manualCast,
      manualReleaseYear,
      manualDuration,
      manualPosterUrl,
      manualBackdropUrl,
    ]
  );
  const initialSnapshotRef = useRef(currentSnapshot);
  const isDirty = currentSnapshot !== initialSnapshotRef.current;

  const confirmLeave = () => {
    if (!isDirty) {
      return true;
    }

    return window.confirm(t("form.unsavedChangesConfirm"));
  };

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!isDirty) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) {
        return;
      }

      const isSamePage =
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        destination.hash === window.location.hash;

      if (isSamePage) {
        return;
      }

      if (!window.confirm(t("form.unsavedChangesConfirm"))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handlePopState = () => {
      if (!isDirty) {
        return;
      }

      if (!window.confirm(t("form.unsavedChangesConfirm"))) {
        window.history.pushState(null, "", window.location.href);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty, t]);

  function handleCancel() {
    if (!confirmLeave()) {
      return;
    }

    router.push("/films");
  }

  async function handleResyncTmdb() {
    if (!film) return;
    setSyncing(true);
    try {
      const result = await resyncTmdbAction(film.id);
      if ("error" in result) {
        toast.error(t(`form.tmdbErrors.${result.error}`));
        return;
      }
      if (result.status === "matched" && result.data) {
        toast.success(t("form.tmdbSyncSuccess"));
        setTmdbStatus("matched");
        setTmdbPoster(result.data.posterUrl ?? null);
        setTmdbOriginalTitle(result.data.originalTitle ?? null);
        setTmdbYear(result.data.releaseYear ?? null);
        setTmdbSynopsis(result.data.synopsis ?? null);
        setTmdbSynopsisEn(result.data.synopsisEn ?? null);
        setTmdbDirectors(result.data.directors ?? null);
        setTmdbCast(result.data.cast ?? null);
        setTmdbDuration(result.data.duration ?? null);
        setTmdbGenres(result.data.genres ?? null);
      } else {
        toast.warning(t("form.tmdbNoMatch"));
        setTmdbStatus("no_match");
        setTmdbPoster(null);
        setTmdbOriginalTitle(null);
        setTmdbSynopsis(null);
        setTmdbSynopsisEn(null);
        setTmdbDirectors(null);
        setTmdbCast(null);
        setTmdbDuration(null);
        setTmdbGenres(null);
      }
    } catch (error) {
      console.error("TMDB resync failed:", error);
      toast.error(t("form.tmdbErrors.TMDB_UNAVAILABLE"));
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisassociateTmdb() {
    if (!film) return;
    setSyncing(true);
    try {
      const result = await disassociateTmdbAction(film.id);
      if ("error" in result) {
        toast.error(t(`form.tmdbErrors.${result.error}`));
        return;
      }
      toast.success(t("form.tmdbDisassociated"));
      setTmdbStatus("no_match");
      setTmdbPoster(null);
      setTmdbOriginalTitle(null);
      setTmdbYear(null);
      setTmdbSynopsis(null);
      setTmdbSynopsisEn(null);
      setTmdbDirectors(null);
      setTmdbCast(null);
      setTmdbDuration(null);
      setTmdbGenres(null);
    } catch {
      toast.error(t("form.tmdbErrors.TMDB_UNAVAILABLE"));
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveManualTmdb() {
    if (!film) return;

    setSyncing(true);
    try {
      const directors = manualDirectors
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const genres = manualGenres
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const cast = manualCast
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      const parsedReleaseYear = manualReleaseYear.trim()
        ? Number.parseInt(manualReleaseYear.trim(), 10)
        : Number.NaN;
      const parsedDuration = manualDuration.trim()
        ? Number.parseInt(manualDuration.trim(), 10)
        : Number.NaN;
      const releaseYear = Number.isFinite(parsedReleaseYear) ? parsedReleaseYear : null;
      const duration = Number.isFinite(parsedDuration) ? parsedDuration : null;

      const result = await updateTmdbManualAction(film.id, {
        originalTitle: manualOriginalTitle.trim() || null,
        synopsis: manualSynopsis.trim() || null,
        synopsisEn: manualSynopsisEn.trim() || null,
        releaseYear,
        duration,
        directors,
        genres,
        cast,
        posterUrl: manualPosterUrl.trim() || null,
        backdropUrl: manualBackdropUrl.trim() || null,
      });

      if ("error" in result) {
        toast.error(t(`form.tmdbErrors.${result.error}`));
        return;
      }

      setTmdbStatus("manual");
      setTmdbOriginalTitle(manualOriginalTitle.trim() || null);
      setTmdbSynopsis(manualSynopsis.trim() || null);
      setTmdbSynopsisEn(manualSynopsisEn.trim() || null);
      setTmdbDirectors(directors);
      setTmdbGenres(genres);
      setTmdbCast(cast);
      setTmdbYear(releaseYear);
      setTmdbDuration(duration);
      setTmdbPoster(manualPosterUrl.trim() || null);
      toast.success(t("form.tmdbManualSaved"));
    } catch {
      toast.error(t("form.tmdbErrors.TMDB_UNAVAILABLE"));
    } finally {
      setSyncing(false);
    }
  }

  // ─── TMDB debounced search ───────────────────────────────────────────────

  useEffect(() => {
    if (!tmdbQuery.trim()) {
      setTmdbResults([]);
      setShowResults(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setTmdbLoading(true);
      try {
        const result = await searchTmdb(tmdbQuery.trim());
        if ("results" in result) {
          setTmdbResults(result.results as TmdbResult[]);
          setShowResults(true);
        }
      } finally {
        setTmdbLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [tmdbQuery]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  function selectTmdbResult(result: TmdbResult) {
    setSelectedTmdbId(result.id);
    setSelectedTmdbTitle(result.title);
    setSelectedTmdbYear(
      result.release_date ? parseInt(result.release_date.substring(0, 4), 10) : null
    );
    setSelectedTmdbPoster(
      result.poster_path ? `https://image.tmdb.org/t/p/w92${result.poster_path}` : null
    );
    setShowResults(false);
    setTmdbQuery("");

    // If title is empty, auto-fill from TMDB
    if (!title.trim()) {
      setTitle(result.title);
    }
  }

  function clearTmdbSelection() {
    setSelectedTmdbId(null);
    setSelectedTmdbTitle(null);
    setSelectedTmdbYear(null);
    setSelectedTmdbPoster(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!title.trim()) {
      toast.error(t("form.titleRequired"));
      return;
    }

    if (zones.length === 0) {
      toast.error(t("form.pricesRequired"));
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const result = await createFilmAction({
          title: title.trim(),
          externalId: externalId.trim() || undefined,
          type,
          status,
          prices: zones,
          tmdbId: selectedTmdbId,
        });

        if ("error" in result) {
          toast.error(result.error);
          return;
        }

        toast.success(t("form.createSuccess"));
        initialSnapshotRef.current = currentSnapshot;
        router.push("/films");
      } else if (film) {
        const result = await updateFilmAction(film.id, {
          title: title.trim(),
          externalId: externalId.trim() || null,
          type,
          status,
          prices: zones,
        });

        if ("error" in result) {
          toast.error(result.error);
          return;
        }

        toast.success(t("form.updateSuccess"));
        initialSnapshotRef.current = currentSnapshot;
        router.push("/films");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl">
            {mode === "create" ? t("form.createTitle") : film?.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "create" ? t("form.createDescription") : t("form.editDescription")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {saving ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("form.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("form.basicInfoDescription")}</p>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">
                {t("form.title")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="externalId">{t("form.externalId")}</Label>
              <Input
                id="externalId"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                disabled={saving}
              />
              <p className="text-muted-foreground text-xs">{t("form.externalIdHint")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">{t("form.type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as "direct" | "validation")}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">{t("type.direct")}</SelectItem>
                  <SelectItem value="validation">{t("type.validation")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t("form.status")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("status.active")}</SelectItem>
                  <SelectItem value="inactive">{t("status.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TMDB search (only on create) */}
      {mode === "create" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("form.tmdbMatch")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTmdbId ? (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                {selectedTmdbPoster ? (
                  <Image
                    src={selectedTmdbPoster}
                    alt={selectedTmdbTitle ?? ""}
                    width={40}
                    height={60}
                    className="rounded"
                  />
                ) : null}
                <div className="flex-1">
                  <p className="font-medium">
                    {t("form.tmdbMatched", {
                      title: selectedTmdbTitle ?? "",
                      year: selectedTmdbYear ?? "?",
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearTmdbSelection}
                  disabled={saving}
                >
                  &times;
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    value={tmdbQuery}
                    onChange={(e) => setTmdbQuery(e.target.value)}
                    placeholder={t("form.searchTmdb")}
                    className="pl-9"
                    disabled={saving}
                  />
                  {tmdbLoading && (
                    <Loader2 className="text-muted-foreground absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
                  )}
                </div>

                {showResults && tmdbResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                    <ul className="max-h-60 overflow-auto py-1">
                      {tmdbResults.slice(0, 8).map((result) => (
                        <li key={result.id}>
                          <button
                            type="button"
                            className="hover:bg-accent flex w-full items-center gap-3 px-3 py-2 text-left text-sm"
                            onClick={() => selectTmdbResult(result)}
                          >
                            {result.poster_path ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                                alt={result.title}
                                width={32}
                                height={48}
                                className="rounded"
                              />
                            ) : (
                              <div className="bg-muted h-12 w-8 rounded" />
                            )}
                            <div>
                              <p className="font-medium">{result.title}</p>
                              {result.release_date && (
                                <p className="text-muted-foreground text-xs">
                                  {result.release_date.substring(0, 4)}
                                </p>
                              )}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {showResults && tmdbResults.length === 0 && !tmdbLoading && (
                  <Badge variant="outline" className="mt-2">
                    {t("form.tmdbNoMatch")}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TMDB info (edit mode) */}
      {mode === "edit" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{t("form.tmdbMatch")}</CardTitle>
              <div className="flex gap-2">
                {tmdbStatus === "matched" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDisassociateTmdb}
                    disabled={syncing || saving}
                  >
                    {syncing ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Unlink className="mr-2 size-4" />
                    )}
                    {t("form.tmdbDisassociate")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResyncTmdb}
                  disabled={syncing || saving}
                >
                  {syncing ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 size-4" />
                  )}
                  {t("form.tmdbSync")}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{t("form.tmdbEditDescription")}</p>
          </CardHeader>
          <CardContent>
            {tmdbStatus === "matched" ? (
              <div className="flex gap-4">
                {tmdbPoster && (
                  <Image
                    src={tmdbPoster}
                    alt={tmdbOriginalTitle ?? title}
                    width={80}
                    height={120}
                    className="h-30 w-20 shrink-0 rounded object-cover"
                  />
                )}
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    {tmdbOriginalTitle ?? title}
                    {tmdbYear ? ` (${tmdbYear})` : ""}
                  </p>
                  {tmdbDirectors && tmdbDirectors.length > 0 && (
                    <p className="text-muted-foreground">
                      {t("form.tmdbDirectors")}: {tmdbDirectors.join(", ")}
                    </p>
                  )}
                  {tmdbDuration && (
                    <p className="text-muted-foreground">
                      {t("form.tmdbDuration", { minutes: tmdbDuration })}
                    </p>
                  )}
                  {tmdbGenres && tmdbGenres.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tmdbGenres.map((genre) => (
                        <Badge key={genre} variant="secondary" className="text-xs">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {tmdbSynopsis && (
                    <p className="text-muted-foreground line-clamp-3 pt-1">{tmdbSynopsis}</p>
                  )}
                  {tmdbSynopsisEn && (
                    <p className="text-muted-foreground line-clamp-3 pt-1">{tmdbSynopsisEn}</p>
                  )}
                  {tmdbCast && tmdbCast.length > 0 && (
                    <p className="text-muted-foreground pt-1">
                      {t("form.tmdbCast")}: {tmdbCast.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ) : tmdbStatus === "pending" ? (
              <p className="text-muted-foreground text-sm">{t("form.tmdbPending")}</p>
            ) : (
              <p className="text-muted-foreground text-sm">{t("form.tmdbNotMatched")}</p>
            )}

            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manual-original-title">{t("form.tmdbManualOriginalTitle")}</Label>
                  <Input
                    id="manual-original-title"
                    value={manualOriginalTitle}
                    onChange={(event) => setManualOriginalTitle(event.target.value)}
                    disabled={syncing || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-release-year">{t("form.tmdbManualReleaseYear")}</Label>
                  <Input
                    id="manual-release-year"
                    type="number"
                    value={manualReleaseYear}
                    onChange={(event) => setManualReleaseYear(event.target.value)}
                    disabled={syncing || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-duration">{t("form.tmdbManualDuration")}</Label>
                  <Input
                    id="manual-duration"
                    type="number"
                    value={manualDuration}
                    onChange={(event) => setManualDuration(event.target.value)}
                    disabled={syncing || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-directors">{t("form.tmdbManualDirectors")}</Label>
                  <Input
                    id="manual-directors"
                    value={manualDirectors}
                    onChange={(event) => setManualDirectors(event.target.value)}
                    disabled={syncing || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-genres">{t("form.tmdbManualGenres")}</Label>
                  <Input
                    id="manual-genres"
                    value={manualGenres}
                    onChange={(event) => setManualGenres(event.target.value)}
                    disabled={syncing || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-cast">{t("form.tmdbManualCast")}</Label>
                  <Input
                    id="manual-cast"
                    value={manualCast}
                    onChange={(event) => setManualCast(event.target.value)}
                    disabled={syncing || saving}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="manual-synopsis">{t("form.tmdbManualSynopsis")}</Label>
                  <Textarea
                    id="manual-synopsis"
                    value={manualSynopsis}
                    onChange={(event) => setManualSynopsis(event.target.value)}
                    disabled={syncing || saving}
                    rows={4}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="manual-synopsis-en">{t("form.tmdbManualSynopsisEn")}</Label>
                  <Textarea
                    id="manual-synopsis-en"
                    value={manualSynopsisEn}
                    onChange={(event) => setManualSynopsisEn(event.target.value)}
                    disabled={syncing || saving}
                    rows={4}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("form.mediaAssetsTitle")}
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="manual-poster-url">{t("form.tmdbManualPosterUrl")}</Label>
                    <ImageUpload
                      value={manualPosterUrl}
                      onChange={setManualPosterUrl}
                      className="min-h-[210px]"
                    />
                    <Input
                      id="manual-poster-url"
                      value={manualPosterUrl}
                      onChange={(event) => setManualPosterUrl(event.target.value)}
                      disabled={syncing || saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-backdrop-url">{t("form.tmdbManualBackdropUrl")}</Label>
                    <ImageUpload
                      value={manualBackdropUrl}
                      onChange={setManualBackdropUrl}
                      className="min-h-[210px]"
                    />
                    <Input
                      id="manual-backdrop-url"
                      value={manualBackdropUrl}
                      onChange={(event) => setManualBackdropUrl(event.target.value)}
                      disabled={syncing || saving}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveManualTmdb}
                disabled={syncing || saving}
              >
                {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {t("form.tmdbSaveManual")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price zones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("form.prices")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("form.pricingDescription")}</p>
        </CardHeader>
        <CardContent>
          <PriceZonesEditor zones={zones} onChange={setZones} disabled={saving} />
        </CardContent>
      </Card>
    </form>
  );
}
