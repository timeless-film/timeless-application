"use client";

import { Download, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { exportTransactionsCsv } from "./wallet-actions";

function getMonthRange(offset: number): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offset;
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return {
    start: first.toISOString().split("T")[0] ?? "",
    end: last.toISOString().split("T")[0] ?? "",
  };
}

export function CsvExportButton() {
  const t = useTranslations("wallet.csv");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function handleExport(start: string, end: string) {
    if (!start || !end) return;
    setLoading(true);
    try {
      const result = await exportTransactionsCsv(start, end);
      if ("error" in result) {
        console.error("CSV export error:", result.error);
        return;
      }
      // Trigger browser download
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transactions_${start}_${end}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  const currentMonth = getMonthRange(0);
  const previousMonth = getMonthRange(-1);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {t("download")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            disabled={loading}
            onClick={() => handleExport(currentMonth.start, currentMonth.end)}
          >
            {t("currentMonth")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            disabled={loading}
            onClick={() => handleExport(previousMonth.start, previousMonth.end)}
          >
            {t("previousMonth")}
          </Button>
        </div>

        <hr />

        <div className="space-y-2">
          <p className="text-sm font-medium">{t("custom")}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="csv-start">{t("startDate")}</Label>
              <Input
                id="csv-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="csv-end">{t("endDate")}</Label>
              <Input
                id="csv-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={loading || !startDate || !endDate}
            onClick={() => handleExport(startDate, endDate)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("export")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
