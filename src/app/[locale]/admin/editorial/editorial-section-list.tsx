"use client";

import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ImageIcon,
  Layers,
  Loader2,
  MonitorPlay,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import {
  createSectionAction,
  deleteSectionAction,
  getCollectionAction,
  getEditorialCardsAction,
  getSlideshowItemsAction,
  reorderSectionsAction,
  updateSectionAction,
} from "./actions";
import { CardsEditor } from "./cards/[sectionId]/cards-editor";
import { CollectionEditor } from "./collection/[sectionId]/collection-editor";
import { DecadeEditor } from "./decade/decade-editor";
import { SlideshowEditor } from "./slideshow/[sectionId]/slideshow-editor";

import type { EditorialSectionRow } from "@/lib/services/editorial-service";

const SECTION_TYPE_CONFIG = {
  slideshow: { icon: MonitorPlay, labelKey: "typeSlideshow" as const },
  collection: { icon: Layers, labelKey: "typeCollection" as const },
  card_grid: { icon: ImageIcon, labelKey: "typeCardGrid" as const },
  decade_catalog: { icon: Settings, labelKey: "typeDecadeCatalog" as const },
};

interface EditorialSectionListProps {
  initialSections: EditorialSectionRow[];
}

export function EditorialSectionList({ initialSections }: EditorialSectionListProps) {
  const t = useTranslations("admin.editorial");
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<EditorialSectionRow | null>(null);

  // Sheet editor state
  const [editingSection, setEditingSection] = useState<EditorialSectionRow | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editorData, setEditorData] = useState<any>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionTitleFr, setSectionTitleFr] = useState("");
  const titleSaveTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const openEditor = useCallback(
    async (section: EditorialSectionRow) => {
      setEditingSection(section);
      setEditorData(null);
      setEditorLoading(true);
      setSectionTitle(section.title ?? "");
      setSectionTitleFr(section.titleFr ?? "");

      try {
        switch (section.type) {
          case "slideshow": {
            const result = await getSlideshowItemsAction(section.id);
            if ("items" in result) setEditorData(result.items);
            break;
          }
          case "collection": {
            const result = await getCollectionAction(section.id);
            if ("collection" in result) setEditorData(result.collection);
            break;
          }
          case "card_grid": {
            const result = await getEditorialCardsAction(section.id);
            if ("cards" in result) setEditorData(result.cards);
            break;
          }
          case "decade_catalog": {
            setEditorData(section.config ?? null);
            break;
          }
        }
      } catch (error) {
        console.error("Failed to load section data:", error);
        toast.error(t("loadError"));
      } finally {
        setEditorLoading(false);
      }
    },
    [t]
  );

  function closeEditor() {
    if (titleSaveTimeout.current) clearTimeout(titleSaveTimeout.current);
    setEditingSection(null);
    setEditorData(null);
    setSectionTitle("");
    setSectionTitleFr("");
    router.refresh();
  }

  function handleSectionTitleChange(value: string) {
    setSectionTitle(value);
    debounceSectionTitleSave(value, sectionTitleFr);
  }

  function handleSectionTitleFrChange(value: string) {
    setSectionTitleFr(value);
    debounceSectionTitleSave(sectionTitle, value);
  }

  function debounceSectionTitleSave(titleValue: string, titleFrValue: string) {
    if (titleSaveTimeout.current) clearTimeout(titleSaveTimeout.current);
    if (!editingSection) return;
    const sectionId = editingSection.id;
    titleSaveTimeout.current = setTimeout(async () => {
      const title = titleValue.trim() || null;
      const titleFr = titleFrValue.trim() || null;
      const result = await updateSectionAction(sectionId, { title, titleFr });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, title, titleFr } : s)));
    }, 500);
  }

  function handleAddSection(type: "slideshow" | "collection" | "card_grid" | "decade_catalog") {
    startTransition(async () => {
      const result = await createSectionAction({ type });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("sectionCreated"));
      router.refresh();
      // Optimistic update
      if ("section" in result && result.section) {
        setSections((prev) => [...prev, result.section]);
      }
    });
  }

  function handleToggleVisibility(section: EditorialSectionRow) {
    startTransition(async () => {
      const result = await updateSectionAction(section.id, { visible: !section.visible });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setSections((prev) =>
        prev.map((s) => (s.id === section.id ? { ...s, visible: !s.visible } : s))
      );
    });
  }

  function handleMove(sectionId: string, direction: "up" | "down") {
    const index = sections.findIndex((s) => s.id === sectionId);
    if (index === -1) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved!);
    setSections(reordered);

    startTransition(async () => {
      const result = await reorderSectionsAction(reordered.map((s) => s.id));
      if ("error" in result) {
        toast.error(result.error);
        setSections(initialSections);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteSectionAction(deleteTarget.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("sectionDeleted"));
      setSections((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    });
  }

  function getSheetTitle(section: EditorialSectionRow): string {
    const config = SECTION_TYPE_CONFIG[section.type];
    const typeLabel = t(config.labelKey);
    return section.title || typeLabel;
  }

  function getSheetDescription(section: EditorialSectionRow): string {
    switch (section.type) {
      case "slideshow":
        return t("slideshowDescription");
      case "collection":
        return t("collectionDescription");
      case "card_grid":
        return t("cardsDescription");
      case "decade_catalog":
        return t("decadeDescription");
      default:
        return "";
    }
  }

  return (
    <div className="space-y-4">
      {/* Add section dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={isPending}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addSection")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {(["slideshow", "collection", "card_grid", "decade_catalog"] as const).map((type) => {
            const config = SECTION_TYPE_CONFIG[type];
            const Icon = config.icon;
            return (
              <DropdownMenuItem key={type} onClick={() => handleAddSection(type)}>
                <Icon className="mr-2 h-4 w-4" />
                {t(config.labelKey)}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Section list */}
      {sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Layers className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sections.map((section, index) => {
            const config = SECTION_TYPE_CONFIG[section.type];
            const Icon = config.icon;

            return (
              <Card
                key={section.id}
                className={cn(!section.visible && "opacity-60")}
                data-section-id={section.id}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  {/* Move buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMove(section.id, "up")}
                      disabled={index === 0 || isPending}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleMove(section.id, "down")}
                      disabled={index === sections.length - 1 || isPending}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Icon + info */}
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{section.title || t(config.labelKey)}</p>
                      <Badge variant="outline" className="text-xs">
                        {t(config.labelKey)}
                      </Badge>
                      {!section.visible && (
                        <Badge variant="secondary" className="text-xs">
                          {t("hidden")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleVisibility(section)}
                      disabled={isPending}
                      className="rounded p-2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={section.visible ? "Hide" : "Show"}
                    >
                      {section.visible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>

                    <Button variant="ghost" size="sm" onClick={() => openEditor(section)}>
                      {t("edit")}
                    </Button>

                    <button
                      onClick={() => setDeleteTarget(section)}
                      disabled={isPending}
                      className="rounded p-2 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor Sheet */}
      <Sheet
        open={!!editingSection}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
          {editingSection && (
            <>
              <SheetHeader>
                <SheetTitle>{getSheetTitle(editingSection)}</SheetTitle>
                <SheetDescription>{getSheetDescription(editingSection)}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="section-title">{t("sectionTitleLabel")} (EN)</Label>
                    <Input
                      id="section-title"
                      value={sectionTitle}
                      onChange={(e) => handleSectionTitleChange(e.target.value)}
                      placeholder={t("sectionTitlePlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="section-title-fr">{t("sectionTitleLabel")} (FR)</Label>
                    <Input
                      id="section-title-fr"
                      value={sectionTitleFr}
                      onChange={(e) => handleSectionTitleFrChange(e.target.value)}
                      placeholder={t("frenchTranslation")}
                    />
                  </div>
                </div>
                {editorLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {editingSection.type === "slideshow" && editorData && (
                      <SlideshowEditor sectionId={editingSection.id} initialItems={editorData} />
                    )}
                    {editingSection.type === "collection" && editorData && (
                      <CollectionEditor
                        sectionId={editingSection.id}
                        initialCollection={editorData}
                      />
                    )}
                    {editingSection.type === "card_grid" && editorData && (
                      <CardsEditor sectionId={editingSection.id} initialCards={editorData} />
                    )}
                    {editingSection.type === "decade_catalog" && (
                      <DecadeEditor
                        sectionId={editingSection.id}
                        initialConfig={editorData as { decades?: number[] } | null}
                      />
                    )}
                    {editingSection.type === "collection" && !editorData && !editorLoading && (
                      <p className="text-muted-foreground">{t("noCollection")}</p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t("confirmDelete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
