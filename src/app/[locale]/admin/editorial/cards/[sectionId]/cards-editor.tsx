"use client";

import { ArrowDown, ArrowUp, ImageIcon, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ImageUpload } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  addEditorialCardAction,
  deleteEditorialCardAction,
  reorderEditorialCardsAction,
  updateEditorialCardAction,
} from "../../actions";

interface EditorialCard {
  id: string;
  sectionId: string;
  title: string;
  titleFr: string | null;
  description: string | null;
  descriptionFr: string | null;
  imageUrl: string;
  href: string;
  hrefFr: string | null;
  position: number;
}

interface CardsEditorProps {
  sectionId: string;
  initialCards: EditorialCard[];
}

export function CardsEditor({ sectionId, initialCards }: CardsEditorProps) {
  const t = useTranslations("admin.editorial");
  const [isPending, startTransition] = useTransition();
  const [cards, setCards] = useState(initialCards);

  // Add card form state
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTitleFr, setNewTitleFr] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDescriptionFr, setNewDescriptionFr] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newHref, setNewHref] = useState("");
  const [newHrefFr, setNewHrefFr] = useState("");

  // Edit card state
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTitleFr, setEditTitleFr] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDescriptionFr, setEditDescriptionFr] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editHref, setEditHref] = useState("");
  const [editHrefFr, setEditHrefFr] = useState("");

  function handleAdd() {
    if (!newTitle.trim() || !newImageUrl.trim() || !newHref.trim()) return;

    startTransition(async () => {
      const result = await addEditorialCardAction({
        sectionId,
        title: newTitle.trim(),
        titleFr: newTitleFr.trim() || undefined,
        description: newDescription.trim() || undefined,
        descriptionFr: newDescriptionFr.trim() || undefined,
        imageUrl: newImageUrl.trim(),
        href: newHref.trim(),
        hrefFr: newHrefFr.trim() || undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("cardAdded"));
      setAddOpen(false);
      setNewTitle("");
      setNewTitleFr("");
      setNewDescription("");
      setNewDescriptionFr("");
      setNewImageUrl("");
      setNewHref("");
      setNewHrefFr("");
      // Reload cards
      const { getEditorialCardsAction } = await import("../../actions");
      const freshResult = await getEditorialCardsAction(sectionId);
      if ("cards" in freshResult) {
        setCards(freshResult.cards as EditorialCard[]);
      }
    });
  }

  function openEdit(card: EditorialCard) {
    setEditCardId(card.id);
    setEditTitle(card.title);
    setEditTitleFr(card.titleFr ?? "");
    setEditDescription(card.description ?? "");
    setEditDescriptionFr(card.descriptionFr ?? "");
    setEditImageUrl(card.imageUrl);
    setEditHref(card.href);
    setEditHrefFr(card.hrefFr ?? "");
  }

  function handleSaveEdit() {
    if (!editCardId) return;

    startTransition(async () => {
      const result = await updateEditorialCardAction(editCardId, {
        title: editTitle.trim(),
        titleFr: editTitleFr.trim() || null,
        description: editDescription.trim() || null,
        descriptionFr: editDescriptionFr.trim() || null,
        imageUrl: editImageUrl.trim(),
        href: editHref.trim(),
        hrefFr: editHrefFr.trim() || null,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setCards((prev) =>
        prev.map((c) =>
          c.id === editCardId
            ? {
                ...c,
                title: editTitle.trim(),
                titleFr: editTitleFr.trim() || null,
                description: editDescription.trim() || null,
                descriptionFr: editDescriptionFr.trim() || null,
                imageUrl: editImageUrl.trim(),
                href: editHref.trim(),
                hrefFr: editHrefFr.trim() || null,
              }
            : c
        )
      );
      setEditCardId(null);
      toast.success(t("saved"));
    });
  }

  function handleDelete(cardId: string) {
    startTransition(async () => {
      const result = await deleteEditorialCardAction(cardId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      toast.success(t("cardDeleted"));
    });
  }

  function handleMove(cardId: string, direction: "up" | "down") {
    const index = cards.findIndex((c) => c.id === cardId);
    if (index === -1) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= cards.length) return;

    const reordered = [...cards];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved!);
    setCards(reordered);

    startTransition(async () => {
      const result = await reorderEditorialCardsAction(reordered.map((c) => c.id));
      if ("error" in result) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Add card button */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("addCard")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addCard")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cardTitle">{t("cardTitle")} (EN)</Label>
              <Input
                id="cardTitle"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardTitleFr">{t("cardTitle")} (FR)</Label>
              <Input
                id="cardTitleFr"
                value={newTitleFr}
                onChange={(e) => setNewTitleFr(e.target.value)}
                placeholder={t("frenchTranslation")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardDescription">{t("cardDescription")} (EN)</Label>
              <Textarea
                id="cardDescription"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardDescriptionFr">{t("cardDescription")} (FR)</Label>
              <Textarea
                id="cardDescriptionFr"
                value={newDescriptionFr}
                onChange={(e) => setNewDescriptionFr(e.target.value)}
                placeholder={t("frenchTranslation")}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("cardImage")}</Label>
              <ImageUpload value={newImageUrl} onChange={setNewImageUrl} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardHref">{t("cardHref")} (EN)</Label>
              <Input
                id="cardHref"
                value={newHref}
                onChange={(e) => setNewHref(e.target.value)}
                placeholder="https://... or /catalog?genre=..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardHrefFr">{t("cardHref")} (FR)</Label>
              <Input
                id="cardHrefFr"
                value={newHrefFr}
                onChange={(e) => setNewHrefFr(e.target.value)}
                placeholder={t("frenchTranslation")}
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={isPending || !newTitle.trim() || !newImageUrl.trim() || !newHref.trim()}
            >
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cards list */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("noCards")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map((card, index) => (
            <Card key={card.id}>
              <CardContent className="flex items-center gap-3 p-3">
                {/* Move */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMove(card.id, "up")}
                    disabled={index === 0 || isPending}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleMove(card.id, "down")}
                    disabled={index === cards.length - 1 || isPending}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Thumbnail */}
                <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.imageUrl}
                    alt={card.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{card.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{card.href}</p>
                </div>

                {/* Actions */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(card)}
                  disabled={isPending}
                >
                  {t("edit")}
                </Button>
                <button
                  onClick={() => handleDelete(card.id)}
                  disabled={isPending}
                  className="rounded p-2 text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editCardId !== null}
        onOpenChange={(open) => {
          if (!open) setEditCardId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editCard")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editCardTitle">{t("cardTitle")} (EN)</Label>
              <Input
                id="editCardTitle"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCardTitleFr">{t("cardTitle")} (FR)</Label>
              <Input
                id="editCardTitleFr"
                value={editTitleFr}
                onChange={(e) => setEditTitleFr(e.target.value)}
                placeholder={t("frenchTranslation")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCardDescription">{t("cardDescription")} (EN)</Label>
              <Textarea
                id="editCardDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCardDescriptionFr">{t("cardDescription")} (FR)</Label>
              <Textarea
                id="editCardDescriptionFr"
                value={editDescriptionFr}
                onChange={(e) => setEditDescriptionFr(e.target.value)}
                placeholder={t("frenchTranslation")}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("cardImage")}</Label>
              <ImageUpload value={editImageUrl} onChange={setEditImageUrl} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCardHref">{t("cardHref")} (EN)</Label>
              <Input
                id="editCardHref"
                value={editHref}
                onChange={(e) => setEditHref(e.target.value)}
                placeholder="https://... or /catalog?genre=..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCardHrefFr">{t("cardHref")} (FR)</Label>
              <Input
                id="editCardHrefFr"
                value={editHrefFr}
                onChange={(e) => setEditHrefFr(e.target.value)}
                placeholder={t("frenchTranslation")}
              />
            </div>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
