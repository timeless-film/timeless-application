"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  fetchPayoutSchedule,
  updatePayoutSettings,
} from "@/components/account/stripe-connect-actions";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  PayoutSchedule,
  PayoutScheduleInput,
  WeeklyAnchor,
} from "@/lib/services/wallet-service";

const INTERVALS = ["manual", "daily", "weekly", "monthly"] as const;
const WEEK_DAYS: WeeklyAnchor[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export function PayoutScheduleSection() {
  const t = useTranslations("stripeConnect.payoutSchedule");
  const [isPending, startTransition] = useTransition();
  const [schedule, setSchedule] = useState<PayoutSchedule | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchPayoutSchedule().then((result) => {
      if ("success" in result && result.success) {
        setSchedule(result.schedule);
      }
      setLoaded(true);
    });
  }, []);

  const handleIntervalChange = useCallback(
    (interval: string) => {
      const typedInterval = interval as PayoutScheduleInput["interval"];
      let input: PayoutScheduleInput;

      if (typedInterval === "weekly") {
        input = { interval: "weekly", weeklyAnchor: schedule?.weeklyAnchor ?? "monday" };
      } else if (typedInterval === "monthly") {
        input = { interval: "monthly", monthlyAnchor: schedule?.monthlyAnchor ?? 1 };
      } else {
        input = { interval: typedInterval };
      }

      setSchedule({
        interval: typedInterval,
        weeklyAnchor:
          typedInterval === "weekly"
            ? (input as { weeklyAnchor: WeeklyAnchor }).weeklyAnchor
            : undefined,
        monthlyAnchor:
          typedInterval === "monthly"
            ? (input as { monthlyAnchor: number }).monthlyAnchor
            : undefined,
      });

      startTransition(async () => {
        const result = await updatePayoutSettings(input);
        if ("error" in result) {
          toast.error(t("error"));
        } else {
          toast.success(t("success"));
        }
      });
    },
    [schedule, startTransition, t]
  );

  const handleWeeklyAnchorChange = useCallback(
    (anchor: string) => {
      const typedAnchor = anchor as WeeklyAnchor;
      const input: PayoutScheduleInput = { interval: "weekly", weeklyAnchor: typedAnchor };
      setSchedule({ interval: "weekly", weeklyAnchor: typedAnchor });

      startTransition(async () => {
        const result = await updatePayoutSettings(input);
        if ("error" in result) {
          toast.error(t("error"));
        } else {
          toast.success(t("success"));
        }
      });
    },
    [startTransition, t]
  );

  const handleMonthlyAnchorChange = useCallback(
    (day: string) => {
      const typedDay = parseInt(day, 10);
      const input: PayoutScheduleInput = { interval: "monthly", monthlyAnchor: typedDay };
      setSchedule({ interval: "monthly", monthlyAnchor: typedDay });

      startTransition(async () => {
        const result = await updatePayoutSettings(input);
        if ("error" in result) {
          toast.error(t("error"));
        } else {
          toast.success(t("success"));
        }
      });
    },
    [startTransition, t]
  );

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!schedule) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{t("title")}</h3>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-48 space-y-2">
          <Label htmlFor="payout-interval">{t("interval")}</Label>
          <Select
            value={schedule.interval}
            onValueChange={handleIntervalChange}
            disabled={isPending}
          >
            <SelectTrigger id="payout-interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVALS.map((interval) => (
                <SelectItem key={interval} value={interval}>
                  {t(interval)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {schedule.interval === "weekly" && (
          <div className="w-48 space-y-2">
            <Label htmlFor="payout-weekly-anchor">{t("weeklyAnchor")}</Label>
            <Select
              value={schedule.weeklyAnchor ?? "monday"}
              onValueChange={handleWeeklyAnchorChange}
              disabled={isPending}
            >
              <SelectTrigger id="payout-weekly-anchor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEK_DAYS.map((day) => (
                  <SelectItem key={day} value={day}>
                    {t(day)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {schedule.interval === "monthly" && (
          <div className="w-48 space-y-2">
            <Label htmlFor="payout-monthly-anchor">{t("monthlyAnchor")}</Label>
            <Select
              value={String(schedule.monthlyAnchor ?? 1)}
              onValueChange={handleMonthlyAnchorChange}
              disabled={isPending}
            >
              <SelectTrigger id="payout-monthly-anchor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
    </div>
  );
}
