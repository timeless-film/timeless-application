"use client";

import { ArrowDown, ArrowUp, Film, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ImageUpload } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import {
  addFilmToCollectionAction,
  removeFilmFromCollectionAction,
  reorderCollectionFilmsAction,
  updateCollectionAction,
} from "../../actions";
import { FilmSearchPicker } from "../../film-search-picker";

interface CollectionFilm {
  id: string;
  position: number;
  film: {
    id: string;
    title: string;
    posterUrl: string | null;
    genres: { nameEn: string; nameFr: string }[];
    releaseYear: number | null;
  };
}

interface Collection {
  id: string;
  sectionId: string;
  slug: string;
  title: string;
  titleFr: string | null;
  description: string | null;
  descriptionFr: string | null;
  coverUrl: string | null;
  displayMode: string;
  visible: boolean;
  collectionFilms: CollectionFilm[];
}

interface CollectionEditorProps {
  sectionId: string;
  initialCollection: Collection;
}

export function CollectionEditor({ sectionId, initialCollection }: CollectionEditorProps) {
  const t = useTranslations("admin.editorial");
  const [isPending, startTransition] = useTransition();

  // Form state
  const [title, setTitle] = useState(initialCollection.title);
  const [titleFr, setTitleFr] = useState(initialCollection.titleFr ?? "");
  const [slug, setSlug] = useState(initialCollection.slug);
  const [description, setDescription] = useState(initialCollection.description ?? "");
  const [descriptionFr, setDescriptionFr] = useState(initialCollection.descriptionFr ?? "");
  const [coverUrl, setCoverUrl] = useState(initialCollection.coverUrl ?? "");
  const [displayMode, setDisplayMode] = useState(initialCollection.displayMode || "poster");
  const [collectionFilms, setCollectionFilms] = useState(initialCollection.collectionFilms);

  function handleSaveDetails() {
    startTransition(async () => {
      const result = await updateCollectionAction(initialCollection.id, {
        title,
        titleFr: titleFr || null,
        slug,
        description: description || null,
        descriptionFr: descriptionFr || null,
        coverUrl: coverUrl || null,
        displayMode,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("saved"));
    });
  }

  function handleAddFilm(film: CollectionFilm["film"]) {
    startTransition(async () => {
      const result = await addFilmToCollectionAction({
        collectionId: initialCollection.id,
        filmId: film.id,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("filmAdded"));
      // Reload
      const freshResult = await import("../../actions").then((m) =>
        m.getCollectionAction(sectionId)
      );
      if ("collection" in freshResult && freshResult.collection) {
        setCollectionFilms(freshResult.collection.collectionFilms as CollectionFilm[]);
      }
    });
  }

  function handleRemoveFilm(collectionFilmId: string) {
    startTransition(async () => {
      const result = await removeFilmFromCollectionAction(collectionFilmId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setCollectionFilms((prev) => prev.filter((cf) => cf.id !== collectionFilmId));
      toast.success(t("filmRemoved"));
    });
  }

  function handleMove(cfId: string, direction: "up" | "down") {
    const index = collectionFilms.findIndex((cf) => cf.id === cfId);
    if (index === -1) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= collectionFilms.length) return;

    const reordered = [...collectionFilms];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved!);
    setCollectionFilms(reordered);

    startTransition(async () => {
      const result = await reorderCollectionFilmsAction(reordered.map((cf) => cf.id));
      if ("error" in result) {
        toast.error(result.error);
      }
    });
  }

  function generateSlug(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  const excludeIds = collectionFilms.map((cf) => cf.film.id);

  return (
    <div className="space-y-6">
      {/* Collection details */}
      <Card>
        <CardHeader>
          <CardTitle>{t("collectionDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">{t("collectionName")} (EN)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (slug === generateSlug(title)) {
                    setSlug(generateSlug(e.target.value));
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="titleFr">{t("collectionName")} (FR)</Label>
              <Input
                id="titleFr"
                value={titleFr}
                onChange={(e) => setTitleFr(e.target.value)}
                placeholder={t("frenchTranslation")}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="slug">{t("collectionSlug")}</Label>
              <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t("slugHint")}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t("collectionDesc")} (EN)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descriptionFr">{t("collectionDesc")} (FR)</Label>
            <Textarea
              id="descriptionFr"
              value={descriptionFr}
              onChange={(e) => setDescriptionFr(e.target.value)}
              rows={3}
              placeholder={t("frenchTranslation")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("coverImage")}</Label>
            <ImageUpload value={coverUrl} onChange={setCoverUrl} />
          </div>
          <div className="space-y-2">
            <Label>{t("displayMode")}</Label>
            <RadioGroup value={displayMode} onValueChange={setDisplayMode} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="poster" id="mode-poster" />
                <Label htmlFor="mode-poster" className="cursor-pointer text-sm font-normal">
                  {t("displayModePoster")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="backdrop" id="mode-backdrop" />
                <Label htmlFor="mode-backdrop" className="cursor-pointer text-sm font-normal">
                  {t("displayModeBackdrop")}
                </Label>
              </div>
            </RadioGroup>
          </div>
          <Button onClick={handleSaveDetails} disabled={isPending}>
            {t("save")}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Films */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t("collectionFilms")}</h2>
        <FilmSearchPicker onSelect={handleAddFilm} excludeIds={excludeIds} />

        {collectionFilms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <Film className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("noFilmsInCollection")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {collectionFilms.map((cf, index) => (
              <Card key={cf.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  {/* Move */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMove(cf.id, "up")}
                      disabled={index === 0 || isPending}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleMove(cf.id, "down")}
                      disabled={index === collectionFilms.length - 1 || isPending}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Poster */}
                  <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded">
                    {cf.film.posterUrl ? (
                      <Image
                        src={cf.film.posterUrl}
                        alt={cf.film.title}
                        fill
                        className="object-cover"
                        sizes="32px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <Film className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{cf.film.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[cf.film.releaseYear, cf.film.genres?.[0]?.nameEn]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleRemoveFilm(cf.id)}
                    disabled={isPending}
                    className="rounded p-2 text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
