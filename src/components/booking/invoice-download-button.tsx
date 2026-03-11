"use client";

import { Download, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { getOrderInvoiceUrl } from "@/components/booking/actions";
import { Button } from "@/components/ui/button";

interface InvoiceDownloadButtonProps {
  orderId: string;
}

export function InvoiceDownloadButton({ orderId }: InvoiceDownloadButtonProps) {
  const t = useTranslations("orders");
  const [isLoading, setIsLoading] = useState(false);

  async function handleDownload() {
    setIsLoading(true);
    const result = await getOrderInvoiceUrl(orderId);
    setIsLoading(false);

    if ("error" in result) {
      toast.error(t("invoiceUnavailable"));
      return;
    }

    if (!("invoiceUrl" in result)) {
      toast.error(t("invoiceUnavailable"));
      return;
    }

    // Open invoice PDF in a new tab
    window.open(result.invoiceUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {t("downloadInvoice")}
    </Button>
  );
}
