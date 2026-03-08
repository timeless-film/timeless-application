"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createRoom, updateRoom } from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Room {
  id: string;
  cinemaId: string;
  name: string;
  capacity: number;
  reference: string | null;
  projectionType: string | null;
  hasDcpEquipment: boolean;
  screenFormat: string | null;
  soundSystem: string | null;
}

interface RoomFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cinemaId: string;
  room?: Room;
  onSuccess: () => void;
}

const PROJECTION_TYPES = ["digital", "film_35mm", "film_70mm"] as const;
type ProjectionType = (typeof PROJECTION_TYPES)[number];

// ─── Component ────────────────────────────────────────────────────────────────

export function RoomFormDialog({
  open,
  onOpenChange,
  cinemaId,
  room,
  onSuccess,
}: RoomFormDialogProps) {
  const t = useTranslations("rooms");
  const isEditing = !!room;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("editTitle") : t("addTitle")}</DialogTitle>
        </DialogHeader>
        {open && (
          <RoomForm
            cinemaId={cinemaId}
            room={room}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Inner form ───────────────────────────────────────────────────────────────

function RoomForm({
  cinemaId,
  room,
  onClose,
  onSuccess,
}: {
  cinemaId: string;
  room?: Room;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("rooms");
  const isEditing = !!room;

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(room?.name ?? "");
  const [capacity, setCapacity] = useState(String(room?.capacity ?? 100));
  const [reference, setReference] = useState(room?.reference ?? "");
  const [projectionType, setProjectionType] = useState(room?.projectionType ?? "");
  const [hasDcpEquipment, setHasDcpEquipment] = useState(room?.hasDcpEquipment ?? false);
  const [screenFormat, setScreenFormat] = useState(room?.screenFormat ?? "");
  const [soundSystem, setSoundSystem] = useState(room?.soundSystem ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      toast.error(t("error.INVALID_CAPACITY"));
      setLoading(false);
      return;
    }

    if (isEditing) {
      const result = await updateRoom(room.id, cinemaId, {
        name: name || undefined,
        capacity: capacityNum,
        reference: reference || null,
        projectionType: (projectionType as ProjectionType) || null,
        hasDcpEquipment,
        screenFormat: screenFormat || null,
        soundSystem: soundSystem || null,
      });

      if ("error" in result) {
        toast.error(t(`error.${result.error}`));
      } else {
        toast.success(t("saved"));
        onClose();
        onSuccess();
      }
    } else {
      const result = await createRoom(cinemaId, {
        name: name || undefined,
        capacity: capacityNum,
        reference: reference || undefined,
        projectionType: (projectionType as ProjectionType) || undefined,
        hasDcpEquipment,
        screenFormat: screenFormat || undefined,
        soundSystem: soundSystem || undefined,
      });

      if ("error" in result) {
        toast.error(t(`error.${result.error}`));
      } else {
        toast.success(t("created"));
        onClose();
        onSuccess();
      }
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="roomName">{t("name")}</Label>
        <Input
          id="roomName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          disabled={loading}
        />
      </div>

      {/* Capacity */}
      <div className="space-y-2">
        <Label htmlFor="roomCapacity">
          {t("capacity")} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="roomCapacity"
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          disabled={loading}
          required
        />
        <p className="text-xs text-muted-foreground">{t("capacityHint")}</p>
      </div>

      {/* Reference */}
      <div className="space-y-2">
        <Label htmlFor="roomReference">{t("reference")}</Label>
        <Input
          id="roomReference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={t("referencePlaceholder")}
          disabled={loading}
        />
      </div>

      {/* Projection type */}
      <div className="space-y-2">
        <Label htmlFor="roomProjectionType">{t("projectionType")}</Label>
        <Select value={projectionType} onValueChange={setProjectionType} disabled={loading}>
          <SelectTrigger id="roomProjectionType">
            <SelectValue placeholder={t("projectionTypePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {PROJECTION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`projectionTypes.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* DCP equipment */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="roomDcp"
          checked={hasDcpEquipment}
          onCheckedChange={(checked) => setHasDcpEquipment(checked === true)}
          disabled={loading}
        />
        <Label htmlFor="roomDcp" className="font-normal">
          {t("hasDcpEquipment")}
        </Label>
      </div>

      {/* Screen format */}
      <div className="space-y-2">
        <Label htmlFor="roomScreenFormat">{t("screenFormat")}</Label>
        <Input
          id="roomScreenFormat"
          value={screenFormat}
          onChange={(e) => setScreenFormat(e.target.value)}
          placeholder={t("screenFormatPlaceholder")}
          disabled={loading}
        />
      </div>

      {/* Sound system */}
      <div className="space-y-2">
        <Label htmlFor="roomSoundSystem">{t("soundSystem")}</Label>
        <Input
          id="roomSoundSystem"
          value={soundSystem}
          onChange={(e) => setSoundSystem(e.target.value)}
          placeholder={t("soundSystemPlaceholder")}
          disabled={loading}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? t("save") : t("addButton")}
        </Button>
      </DialogFooter>
    </form>
  );
}
