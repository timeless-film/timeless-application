"use client";

import { ArrowDown, ArrowUp, Film, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  addSlideshowItemAction,
  deleteSlideshowItemAction,
  reorderSlideshowItemsAction,
  updateSlideshowItemAction,
} from "../../actions";
import { FilmSearchPicker } from "../../film-search-picker";

interface SlideshowItem {
  id: string;
  sectionId: string;
  filmId: string;
  headline: string | null;
  headlineFr: string | null;
  subtitle: string | null;
  subtitleFr: string | null;
  position: number;
  film: {
    id: string;
    title: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    genres: string[] | null;
    releaseYear: number | null;
    directors: string[] | null;
  };
}

interface SlideshowEditorProps {
  sectionId: string;
  initialItems: SlideshowItem[];
}

export function SlideshowEditor({ sectionId, initialItems }: SlideshowEditorProps) {
  const t = useTranslations("admin.editorial");
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [editItem, setEditItem] = useState<SlideshowItem | null>(null);
  const [editHeadline, setEditHeadline] = useState("");
  const [editHeadlineFr, setEditHeadlineFr] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editSubtitleFr, setEditSubtitleFr] = useState("");

  function handleAddFilm(film: SlideshowItem["film"]) {
    startTransition(async () => {
      const result = await addSlideshowItemAction({ sectionId, filmId: film.id });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("filmAdded"));
      // Reload items from server
      const freshResult = await import("../../actions").then((m) =>
        m.getSlideshowItemsAction(sectionId)
      );
      if ("items" in freshResult) {
        setItems(freshResult.items as SlideshowItem[]);
      }
    });
  }

  function handleDelete(itemId: string) {
    startTransition(async () => {
      const result = await deleteSlideshowItemAction(itemId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success(t("itemDeleted"));
    });
  }

  function handleMove(itemId: string, direction: "up" | "down") {
    const index = items.findIndex((i) => i.id === itemId);
    if (index === -1) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved!);
    setItems(reordered);

    startTransition(async () => {
      const result = await reorderSlideshowItemsAction(reordered.map((i) => i.id));
      if ("error" in result) {
        toast.error(result.error);
      }
    });
  }

  function openEditDialog(item: SlideshowItem) {
    setEditItem(item);
    setEditHeadline(item.headline ?? "");
    setEditHeadlineFr(item.headlineFr ?? "");
    setEditSubtitle(item.subtitle ?? "");
    setEditSubtitleFr(item.subtitleFr ?? "");
  }

  function handleSaveEdit() {
    if (!editItem) return;
    startTransition(async () => {
      const result = await updateSlideshowItemAction(editItem.id, {
        headline: editHeadline || null,
        headlineFr: editHeadlineFr || null,
        subtitle: editSubtitle || null,
        subtitleFr: editSubtitleFr || null,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.id === editItem.id
            ? {
                ...i,
                headline: editHeadline || null,
                headlineFr: editHeadlineFr || null,
                subtitle: editSubtitle || null,
                subtitleFr: editSubtitleFr || null,
              }
            : i
        )
      );
      setEditItem(null);
      toast.success(t("saved"));
    });
  }

  const excludeIds = items.map((i) => i.filmId);

  return (
    <div className="space-y-6">
      {/* Film search */}
      <div>
        <Label className="mb-2 block">{t("addFilmToSlideshow")}</Label>
        <FilmSearchPicker onSelect={handleAddFilm} excludeIds={excludeIds} />
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Film className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t("slideshowEmpty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-4 p-3">
                {/* Move buttons */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMove(item.id, "up")}
                    disabled={index === 0 || isPending}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleMove(item.id, "down")}
                    disabled={index === items.length - 1 || isPending}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>

                {/* Preview */}
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded">
                  {item.film.backdropUrl ? (
                    <Image
                      src={item.film.backdropUrl}
                      alt={item.film.title}
                      fill
                      className="object-cover"
                      sizes="112px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <Film className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.headline ?? item.film.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.subtitle ?? item.film.genres?.join(", ") ?? ""}
                  </p>
                  {item.headline && (
                    <p className="truncate text-xs text-muted-foreground">
                      {item.film.title} ({item.film.releaseYear})
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditDialog(item)}
                    disabled={isPending}
                    className="rounded p-2 text-muted-foreground hover:text-foreground"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={isPending}
                    className="rounded p-2 text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editSlide")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="headline">{t("headline")} (EN)</Label>
              <Input
                id="headline"
                value={editHeadline}
                onChange={(e) => setEditHeadline(e.target.value)}
                placeholder={editItem?.film.title ?? ""}
              />
              <p className="text-xs text-muted-foreground">{t("headlineHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="headlineFr">{t("headline")} (FR)</Label>
              <Input
                id="headlineFr"
                value={editHeadlineFr}
                onChange={(e) => setEditHeadlineFr(e.target.value)}
                placeholder={t("frenchTranslation")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">{t("subtitleField")} (EN)</Label>
              <Input
                id="subtitle"
                value={editSubtitle}
                onChange={(e) => setEditSubtitle(e.target.value)}
                placeholder={t("subtitlePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitleFr">{t("subtitleField")} (FR)</Label>
              <Input
                id="subtitleFr"
                value={editSubtitleFr}
                onChange={(e) => setEditSubtitleFr(e.target.value)}
                placeholder={t("frenchTranslation")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
