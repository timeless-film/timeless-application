import { NextResponse } from "next/server";

import { sendDeliveryAlertEmail } from "@/lib/email/order-emails";
import { getPlatformPricingSettings } from "@/lib/pricing";
import { listDeliveriesForAdmin } from "@/lib/services/admin-delivery-service";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing CRON_SECRET" } },
      { status: 401 }
    );
  }

  try {
    const settings = await getPlatformPricingSettings();
    const threshold = settings.deliveryUrgencyDaysBeforeStart;

    const { deliveries } = await listDeliveriesForAdmin({
      page: 1,
      limit: 100,
      urgencyOnly: true,
      deliveryUrgencyDaysBeforeStart: threshold,
    });

    if (deliveries.length === 0) {
      return NextResponse.json({ data: { sent: false, reason: "no_urgent_deliveries" } });
    }

    const urgentDeliveries = deliveries.map((d) => ({
      filmTitle: d.filmTitle,
      cinemaName: d.cinemaName,
      orderNumber: d.orderNumber,
      startDate: d.startDate ?? "N/A",
      daysRemaining: d.urgencyDays ?? 0,
      deliveryStatus: d.deliveryStatus,
    }));

    await sendDeliveryAlertEmail({
      opsEmail: settings.opsEmail,
      urgentDeliveries,
    });

    return NextResponse.json({
      data: { sent: true, count: urgentDeliveries.length },
    });
  } catch (error) {
    console.error("[cron/delivery-alerts] Failed to send alerts:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process delivery alerts" } },
      { status: 500 }
    );
  }
}
