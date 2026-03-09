"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { addToCart, createRequest, getFilmRequestSummary } from "@/components/catalog/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrencyOptions } from "@/lib/currencies";
import { formatAmount } from "@/lib/pricing/format";
import {
  convertCurrencyWithFallback,
  getExchangeRates,
} from "@/lib/services/exchange-rate-service";

import type { FilmWithAvailability } from "@/lib/services/catalog-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  film: FilmWithAvailability;
  accountId: string;
  cinemas: Cinema[];
  preferredCurrency: string;
  isDirect: boolean; // true = add to cart, false = send request
}

interface Cinema {
  id: string;
  name: string;
  country: string;
  rooms: Array<{ id: string; name: string; capacity: number }>;
}

interface ExistingRequestSummary {
  id: string;
  status: string;
  cinema: { name: string };
  room: { name: string };
  createdAt: Date;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilmActionModal({
  isOpen,
  onClose,
  film,
  accountId: _accountId,
  cinemas,
  preferredCurrency,
  isDirect,
}: FilmActionModalProps) {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const tModal = useTranslations("catalog.film.modal");
  const tSuccess = useTranslations("catalog.success");
  const tErrors = useTranslations("catalog.errors");
  const tStatus = useTranslations("requests.status");

  // Form state
  const [selectedCinemaId, setSelectedCinemaId] = useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [screeningCount, setScreeningCount] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState("EUR");
  const [displayUnitPrice, setDisplayUnitPrice] = useState<number | null>(null);
  const [exchangeRateDate, setExchangeRateDate] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [existingRequests, setExistingRequests] = useState<ExistingRequestSummary[]>([]);

  // Get best price (first matching price)
  const bestPrice = film.matchingPrices?.[0];
  const nativeCurrency = bestPrice?.currency ?? "EUR";
  const nativeUnitPrice = bestPrice?.price ?? 0;
  const totalCents = (displayUnitPrice ?? nativeUnitPrice) * screeningCount;

  const normalizedPreferredCurrency = preferredCurrency.toUpperCase();
  const availableCurrencies = getCurrencyOptions(locale);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCinemaId("");
      setSelectedRoomId("");
      setScreeningCount(1);
      setStartDate("");
      setEndDate("");
      setNote("");
      setSubmissionError(null);
      setExistingRequests([]);
    }
  }, [isOpen]);

  useEffect(() => {
    let isMounted = true;

    async function loadExistingRequests() {
      if (!isOpen) {
        return;
      }

      const result = await getFilmRequestSummary({ filmId: film.id });
      if (!isMounted || "error" in result) {
        return;
      }

      setExistingRequests(
        result.data.map((item) => ({
          id: item.id,
          status: item.status,
          cinema: { name: item.cinema.name },
          room: { name: item.room.name },
          createdAt: item.createdAt,
        }))
      );
    }

    void loadExistingRequests();

    return () => {
      isMounted = false;
    };
  }, [film.id, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDisplayCurrency(normalizedPreferredCurrency || "EUR");
  }, [isOpen, normalizedPreferredCurrency]);

  // Filter cinemas to only those whose country is covered by a price zone
  const compatibleCountries = new Set<string>(
    (film.matchingPrices ?? []).flatMap((p) => p.countries)
  );
  const compatibleCinemas = cinemas.filter((c) => compatibleCountries.has(c.country));

  // Get available rooms for selected cinema
  const selectedCinema = compatibleCinemas.find((c) => c.id === selectedCinemaId);
  const availableRooms = selectedCinema?.rooms ?? [];

  // Reset room when cinema changes
  useEffect(() => {
    if (!selectedCinemaId) {
      return;
    }

    const roomsForSelectedCinema =
      compatibleCinemas.find((cinema) => cinema.id === selectedCinemaId)?.rooms ?? [];

    if (!roomsForSelectedCinema.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId("");
    }
  }, [compatibleCinemas, selectedCinemaId, selectedRoomId]);

  useEffect(() => {
    let isMounted = true;

    async function updateIndicativePrice() {
      if (!bestPrice) {
        return;
      }

      if (displayCurrency === nativeCurrency) {
        if (!isMounted) {
          return;
        }

        setDisplayUnitPrice(nativeUnitPrice);
        setExchangeRateDate(null);
        return;
      }

      const converted = await convertCurrencyWithFallback(
        nativeUnitPrice,
        nativeCurrency,
        displayCurrency
      );
      const rates = await getExchangeRates();

      if (!isMounted) {
        return;
      }

      setDisplayUnitPrice(converted);
      setExchangeRateDate(rates?.date ?? null);
    }

    void updateIndicativePrice();

    return () => {
      isMounted = false;
    };
  }, [bestPrice, displayCurrency, nativeCurrency, nativeUnitPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const data = {
      filmId: film.id,
      cinemaId: selectedCinemaId,
      roomId: selectedRoomId,
      screeningCount,
      startDate,
      endDate,
      note,
    };

    try {
      setSubmissionError(null);
      const result = isDirect ? await addToCart(data) : await createRequest(data);

      if ("error" in result) {
        const translatedError = tErrors(result.error as Parameters<typeof tErrors>[0]);
        setSubmissionError(translatedError);
        toast.error(translatedError);
      } else {
        if (isDirect) {
          queryClient.invalidateQueries({ queryKey: ["cart-items-count"] });
        }
        toast.success(isDirect ? tSuccess("addedToCart") : tSuccess("requestSent"));
        onClose();
      }
    } catch (error) {
      console.error("Failed to submit:", error);
      toast.error(tErrors("DATABASE_ERROR"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{film.title}</DialogTitle>
            <DialogDescription>
              {isDirect ? tModal("addToCart") : tModal("sendRequest")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Cinema selector */}
            <div className="space-y-2">
              <Label htmlFor="cinema">
                {tModal("cinemaLabel")} <span className="text-destructive">*</span>
              </Label>
              {compatibleCinemas.length === 0 ? (
                <div className="text-sm text-destructive">{tModal("noCinemas")}</div>
              ) : (
                <Select value={selectedCinemaId} onValueChange={setSelectedCinemaId}>
                  <SelectTrigger id="cinema">
                    <SelectValue placeholder={tModal("cinemaPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {compatibleCinemas.map((cinema) => (
                      <SelectItem key={cinema.id} value={cinema.id}>
                        {cinema.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Room selector */}
            <div className="space-y-2">
              <Label htmlFor="room">
                {tModal("roomLabel")} <span className="text-destructive">*</span>
              </Label>
              {selectedCinemaId && availableRooms.length === 0 ? (
                <div className="text-sm text-destructive">{tModal("noRooms")}</div>
              ) : (
                <Select
                  value={selectedRoomId}
                  onValueChange={setSelectedRoomId}
                  disabled={!selectedCinemaId}
                >
                  <SelectTrigger id="room">
                    <SelectValue placeholder={tModal("roomPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name} ({room.capacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {!isDirect ? (
              <div className="space-y-2">
                <Label htmlFor="requestNote">{tModal("noteLabel")}</Label>
                <Input
                  id="requestNote"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={tModal("notePlaceholder")}
                  maxLength={1000}
                />
              </div>
            ) : null}

            {/* Screening count */}
            <div className="space-y-2">
              <Label htmlFor="screeningCount">
                {tModal("screeningCountLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="screeningCount"
                type="number"
                min={1}
                value={screeningCount}
                onChange={(e) => setScreeningCount(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder={tModal("screeningCountPlaceholder")}
                required
              />
            </div>

            {/* Start date */}
            <div className="space-y-2">
              <Label htmlFor="startDate">{tModal("startDateLabel")}</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End date */}
            <div className="space-y-2">
              <Label htmlFor="endDate">{tModal("endDateLabel")}</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </div>

            {/* Total */}
            {bestPrice && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="mb-3 space-y-2">
                  <Label htmlFor="displayCurrency">{tModal("displayCurrencyLabel")}</Label>
                  <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
                    <SelectTrigger id="displayCurrency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCurrencies.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{tModal("priceLabel")}</span>
                  <span className="text-xl font-bold">
                    {formatAmount(totalCents, displayCurrency, locale)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {displayCurrency}
                    </span>
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {tModal("finalPaymentNote", { currency: nativeCurrency })}
                  {exchangeRateDate
                    ? ` ${tModal("indicativeRateDate", { date: exchangeRateDate })}`
                    : ""}
                </p>
              </div>
            )}

            {existingRequests.length > 0 ? (
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="mb-2 text-sm font-medium">{tModal("existingRequestsTitle")}</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {existingRequests.map((requestItem) => (
                    <li key={requestItem.id}>
                      {tStatus(
                        requestItem.status as
                          | "pending"
                          | "approved"
                          | "rejected"
                          | "cancelled"
                          | "paid"
                      )}{" "}
                      - {requestItem.cinema.name} / {requestItem.room.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {submissionError && <p className="text-sm text-destructive">{submissionError}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {tModal("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !bestPrice ||
                compatibleCinemas.length === 0 ||
                !selectedCinemaId ||
                !selectedRoomId
              }
            >
              {isSubmitting
                ? tModal("submitting")
                : isDirect
                  ? tModal("addToCart")
                  : tModal("sendRequest")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
