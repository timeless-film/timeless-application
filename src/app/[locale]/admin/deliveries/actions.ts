"use server";

import { eq } from "drizzle-orm";

import { getCurrentMembership } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { accountMembers, betterAuthUsers } from "@/lib/db/schema";
import { sendDeliveryConfirmationEmail } from "@/lib/email/order-emails";
import {
  getDeliveryEmailContext,
  listDeliveriesForAdmin,
  updateDeliveryNotes,
  updateDeliveryStatus,
} from "@/lib/services/admin-delivery-service";

import type { AdminDeliveryRow } from "@/lib/services/admin-delivery-service";

type DeliveryStatus = "pending" | "in_progress" | "delivered";

interface ListDeliveriesInput {
  search?: string;
  status?: DeliveryStatus;
  urgencyOnly?: boolean;
  page: number;
  limit: number;
  deliveryUrgencyDaysBeforeStart?: number;
}

export async function getDeliveriesPaginated(
  input: ListDeliveriesInput
): Promise<{ deliveries: AdminDeliveryRow[]; total: number } | { error: string }> {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" };

  const result = await listDeliveriesForAdmin({
    page: input.page,
    limit: input.limit,
    search: input.search,
    status: input.status,
    urgencyOnly: input.urgencyOnly,
    deliveryUrgencyDaysBeforeStart: input.deliveryUrgencyDaysBeforeStart,
  });

  return { deliveries: result.deliveries, total: result.total };
}

export async function updateDeliveryStatusAction(
  orderItemId: string,
  status: DeliveryStatus,
  notes?: string,
  labOrderNumber?: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" };

  if (!orderItemId) return { error: "INVALID_INPUT" };

  const validStatuses: DeliveryStatus[] = ["pending", "in_progress", "delivered"];
  if (!validStatuses.includes(status)) return { error: "INVALID_INPUT" };

  try {
    const result = await updateDeliveryStatus(orderItemId, {
      status,
      notes,
      labOrderNumber,
      adminUserId: ctx.session.user.id,
    });

    if ("error" in result) return result;

    // Send delivery confirmation email when marked as delivered
    if (status === "delivered") {
      try {
        const emailContext = await getDeliveryEmailContext(orderItemId);
        if (emailContext) {
          // Get exhibitor owner/admin emails
          const members = await db
            .select({
              email: betterAuthUsers.email,
            })
            .from(accountMembers)
            .innerJoin(betterAuthUsers, eq(accountMembers.userId, betterAuthUsers.id))
            .where(eq(accountMembers.accountId, emailContext.exhibitorAccountId));

          const recipientEmails = members.map((m) => m.email).filter((e): e is string => !!e);

          if (recipientEmails.length > 0) {
            await sendDeliveryConfirmationEmail({
              recipientEmails,
              filmTitle: emailContext.filmTitle,
              cinemaName: emailContext.cinemaName,
              roomName: emailContext.roomName,
              orderNumber: emailContext.orderNumber,
              deliveryNotes: emailContext.deliveryNotes,
              deliveredAt: emailContext.deliveredAt ?? new Date(),
            });
          }
        }
      } catch (error) {
        // Email is best-effort — don't fail the action
        console.error("Failed to send delivery confirmation email:", error);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to update delivery status:", error);
    return { error: "INTERNAL_ERROR" };
  }
}

export async function updateDeliveryNotesAction(
  orderItemId: string,
  notes: string,
  labOrderNumber?: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" };

  if (!orderItemId) return { error: "INVALID_INPUT" };

  try {
    const result = await updateDeliveryNotes(orderItemId, {
      notes,
      labOrderNumber,
      adminUserId: ctx.session.user.id,
    });

    if ("error" in result) return result;
    return { success: true };
  } catch (error) {
    console.error("Failed to update delivery notes:", error);
    return { error: "INTERNAL_ERROR" };
  }
}
