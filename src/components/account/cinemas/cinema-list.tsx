"use client";

import { Archive, Building2, Edit, Loader2, MapPin, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getCountryOptions } from "@/lib/countries";

import { archiveCinema, archiveRoom, createCinema, getCinemas, updateCinema } from "./actions";
import { RoomFormDialog } from "./room-form-dialog";

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

interface Cinema {
  id: string;
  name: string;
  country: string;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  rooms: Room[];
}

interface CinemaListProps {
  initialCinemas: Cinema[];
  currentUserRole: string;
  accountCountry: string;
  accountAddress: string | null;
  accountCity: string | null;
  accountPostalCode: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CinemaList({
  initialCinemas,
  currentUserRole,
  accountCountry,
  accountAddress,
  accountCity,
  accountPostalCode,
}: CinemaListProps) {
  const t = useTranslations("cinemas");
  const tRooms = useTranslations("rooms");
  const locale = useLocale();
  const countryOptions = useMemo(() => getCountryOptions(locale), [locale]);

  const canEdit = currentUserRole === "owner" || currentUserRole === "admin";

  const [cinemas, setCinemas] = useState<Cinema[]>(initialCinemas);
  const [showAddForm, setShowAddForm] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Cinema | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [roomDialogCinemaId, setRoomDialogCinemaId] = useState<string | null>(null);
  const [roomToEdit, setRoomToEdit] = useState<Room | undefined>(undefined);
  const [roomArchiveTarget, setRoomArchiveTarget] = useState<{
    room: Room;
    cinemaId: string;
  } | null>(null);
  const [roomArchiving, setRoomArchiving] = useState(false);

  function getCountryName(code: string) {
    return countryOptions.find((c) => c.value === code)?.label ?? code;
  }

  async function refreshCinemas() {
    const result = await getCinemas();
    if ("cinemas" in result) {
      setCinemas(result.cinemas as Cinema[]);
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);

    const result = await archiveCinema(archiveTarget.id);
    if ("error" in result) {
      toast.error(t(`error.${result.error}`));
    } else {
      toast.success(t("archived"));
      await refreshCinemas();
    }

    setArchiving(false);
    setArchiveTarget(null);
  }

  async function handleRoomArchive() {
    if (!roomArchiveTarget) return;
    setRoomArchiving(true);

    const result = await archiveRoom(roomArchiveTarget.room.id, roomArchiveTarget.cinemaId);
    if ("error" in result) {
      toast.error(tRooms(`error.${result.error}`));
    } else {
      toast.success(tRooms("archived"));
      await refreshCinemas();
    }

    setRoomArchiving(false);
    setRoomArchiveTarget(null);
  }

  return (
    <div className="space-y-4">
      {/* Add cinema button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setShowAddForm(true)} variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("addCinema")}
          </Button>
        </div>
      )}

      {/* Add cinema form */}
      {showAddForm && (
        <AddCinemaForm
          countryOptions={countryOptions}
          defaultCountry={accountCountry}
          defaultAddress={accountAddress}
          defaultCity={accountCity}
          defaultPostalCode={accountPostalCode}
          onSuccess={async () => {
            setShowAddForm(false);
            await refreshCinemas();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Cinema accordion list */}
      {cinemas.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <Accordion type="single" collapsible className="rounded-md">
          {cinemas.map((cinema) => (
            <AccordionItem key={cinema.id} value={cinema.id}>
              <AccordionTrigger className="px-4">
                <div className="flex flex-1 items-center gap-3">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="text-left">
                    <p className="font-medium">{cinema.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <MapPin className="mr-1 inline h-3 w-3" />
                      {cinema.city ? `${cinema.city}, ` : ""}
                      {getCountryName(cinema.country)} &middot;{" "}
                      {t("roomCount", { count: cinema.rooms.length })}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <CinemaEditForm
                  cinema={cinema}
                  countryOptions={countryOptions}
                  canEdit={canEdit}
                  onSaved={refreshCinemas}
                />
                {/* Room list */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{t("rooms")}</h4>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRoomToEdit(undefined);
                          setRoomDialogCinemaId(cinema.id);
                        }}
                      >
                        <Plus className="mr-2 h-3 w-3" />
                        {tRooms("addRoom")}
                      </Button>
                    )}
                  </div>
                  {cinema.rooms.map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between rounded-md border p-3 text-sm"
                    >
                      <div>
                        <span className="font-medium">{room.name}</span>
                        <span className="ml-2 text-muted-foreground">
                          {t("capacity", { count: room.capacity })}
                        </span>
                        {room.reference && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({room.reference})
                          </span>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setRoomToEdit(room);
                              setRoomDialogCinemaId(cinema.id);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setRoomArchiveTarget({ room, cinemaId: cinema.id })}
                          >
                            <Archive className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Archive button */}
                {canEdit && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setArchiveTarget(cinema)}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      {t("archive")}
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Archive confirmation dialog */}
      <Dialog open={!!archiveTarget} onOpenChange={() => setArchiveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("archiveDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("archiveDialog.description", { name: archiveTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)} disabled={archiving}>
              {t("archiveDialog.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archiving}>
              {archiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("archiveDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room form dialog */}
      <RoomFormDialog
        open={!!roomDialogCinemaId}
        onOpenChange={(open) => {
          if (!open) {
            setRoomDialogCinemaId(null);
            setRoomToEdit(undefined);
          }
        }}
        cinemaId={roomDialogCinemaId ?? ""}
        room={roomToEdit}
        onSuccess={refreshCinemas}
      />

      {/* Room archive confirmation dialog */}
      <Dialog open={!!roomArchiveTarget} onOpenChange={() => setRoomArchiveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tRooms("archiveDialog.title")}</DialogTitle>
            <DialogDescription>
              {tRooms("archiveDialog.description", { name: roomArchiveTarget?.room.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoomArchiveTarget(null)}
              disabled={roomArchiving}
            >
              {tRooms("archiveDialog.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleRoomArchive} disabled={roomArchiving}>
              {roomArchiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tRooms("archiveDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Add cinema form ──────────────────────────────────────────────────────────

interface AddCinemaFormProps {
  countryOptions: { value: string; label: string }[];
  defaultCountry: string;
  defaultAddress: string | null;
  defaultCity: string | null;
  defaultPostalCode: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function AddCinemaForm({
  countryOptions,
  defaultCountry,
  defaultAddress,
  defaultCity,
  defaultPostalCode,
  onSuccess,
  onCancel,
}: AddCinemaFormProps) {
  const t = useTranslations("cinemas");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState(defaultCountry);
  const [city, setCity] = useState(defaultCity ?? "");
  const [address, setAddress] = useState(defaultAddress ?? "");
  const [postalCode, setPostalCode] = useState(defaultPostalCode ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await createCinema({
      name,
      country,
      city,
      address: address || undefined,
      postalCode: postalCode || undefined,
    });

    if ("error" in result) {
      toast.error(t(`error.${result.error}`));
    } else {
      toast.success(t("created"));
      onSuccess();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border bg-muted/30 p-4">
      <h3 className="text-sm font-medium">{t("addCinemaTitle")}</h3>

      <div className="space-y-2">
        <Label htmlFor="cinemaName">
          {t("name")} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="cinemaName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          disabled={loading}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cinemaCountry">
            {t("country")} <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            id="cinemaCountry"
            options={countryOptions}
            value={country}
            onValueChange={setCountry}
            disabled={loading}
            searchPlaceholder={tCommon("search")}
            emptyMessage={tCommon("noResults")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cinemaCity">
            {t("city")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="cinemaCity"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={loading}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cinemaAddress">{t("address")}</Label>
        <Input
          id="cinemaAddress"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cinemaPostalCode">{t("postalCode")}</Label>
        <Input
          id="cinemaPostalCode"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading || !name.trim() || !city.trim()}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("addCinemaButton")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

// ─── Cinema edit form ─────────────────────────────────────────────────────────

interface CinemaEditFormProps {
  cinema: Cinema;
  countryOptions: { value: string; label: string }[];
  canEdit: boolean;
  onSaved: () => void;
}

function CinemaEditForm({ cinema, countryOptions, canEdit, onSaved }: CinemaEditFormProps) {
  const t = useTranslations("cinemas");
  const tCommon = useTranslations("common");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(cinema.name);
  const [country, setCountry] = useState(cinema.country);
  const [city, setCity] = useState(cinema.city ?? "");
  const [address, setAddress] = useState(cinema.address ?? "");
  const [postalCode, setPostalCode] = useState(cinema.postalCode ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const result = await updateCinema(cinema.id, {
      name,
      country,
      city,
      address: address || null,
      postalCode: postalCode || null,
    });

    if ("error" in result) {
      toast.error(t(`error.${result.error}`));
    } else {
      toast.success(t("saved"));
      onSaved();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`name-${cinema.id}`}>
          {t("name")} <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`name-${cinema.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit || saving}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`country-${cinema.id}`}>
            {t("country")} <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            id={`country-${cinema.id}`}
            options={countryOptions}
            value={country}
            onValueChange={setCountry}
            disabled={!canEdit || saving}
            searchPlaceholder={tCommon("search")}
            emptyMessage={tCommon("noResults")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`city-${cinema.id}`}>
            {t("city")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`city-${cinema.id}`}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={!canEdit || saving}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`address-${cinema.id}`}>{t("address")}</Label>
        <Input
          id={`address-${cinema.id}`}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={!canEdit || saving}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`postalCode-${cinema.id}`}>{t("postalCode")}</Label>
        <Input
          id={`postalCode-${cinema.id}`}
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          disabled={!canEdit || saving}
        />
      </div>

      {canEdit && (
        <Button type="submit" disabled={saving || !name.trim() || !city.trim()}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("save")}
        </Button>
      )}
    </form>
  );
}
