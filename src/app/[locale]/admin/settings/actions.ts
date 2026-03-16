"use server";

import { eq } from "drizzle-orm";

import { getCurrentMembership } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { platformSettings, platformSettingsHistory } from "@/lib/db/schema";
import { listGenres, seedMissingGenres } from "@/lib/services/film-service";

import type { PlatformSettingsUpdate } from "@/lib/services/admin-settings-service";

export async function updatePlatformSettings(input: PlatformSettingsUpdate) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  // Validation
  if (input.platformMarginRate < 0 || input.platformMarginRate > 100) {
    return { error: "INVALID_MARGIN_RATE" as const, field: "platformMarginRate" as const };
  }
  if (input.deliveryFees < 0) {
    return { error: "INVALID_DELIVERY_FEES" as const, field: "deliveryFees" as const };
  }
  if (input.defaultCommissionRate < 0 || input.defaultCommissionRate > 100) {
    return { error: "INVALID_COMMISSION_RATE" as const, field: "defaultCommissionRate" as const };
  }
  if (!input.opsEmail.trim() || !input.opsEmail.includes("@")) {
    return { error: "INVALID_OPS_EMAIL" as const, field: "opsEmail" as const };
  }
  if (input.requestExpirationDays < 1 || input.requestExpirationDays > 365) {
    return { error: "INVALID_EXPIRATION_DAYS" as const, field: "requestExpirationDays" as const };
  }
  if (input.requestUrgencyDaysBeforeStart < 1 || input.requestUrgencyDaysBeforeStart > 90) {
    return {
      error: "INVALID_URGENCY_DAYS" as const,
      field: "requestUrgencyDaysBeforeStart" as const,
    };
  }
  if (input.deliveryUrgencyDaysBeforeStart < 1 || input.deliveryUrgencyDaysBeforeStart > 90) {
    return {
      error: "INVALID_DELIVERY_URGENCY_DAYS" as const,
      field: "deliveryUrgencyDaysBeforeStart" as const,
    };
  }

  try {
    // Fetch current settings for history tracking
    const current = await db.query.platformSettings.findFirst({
      where: (s, { eq: eqOp }) => eqOp(s.id, "global"),
    });

    if (!current) return { error: "SETTINGS_NOT_FOUND" as const };

    // Track changes in history
    const changes: { field: string; oldValue: string; newValue: string }[] = [];

    const newMarginRate = (input.platformMarginRate / 100).toFixed(4);
    if (current.platformMarginRate !== newMarginRate) {
      changes.push({
        field: "platformMarginRate",
        oldValue: current.platformMarginRate,
        newValue: newMarginRate,
      });
    }

    const newDeliveryFees = Math.round(input.deliveryFees * 100);
    if (current.deliveryFees !== newDeliveryFees) {
      changes.push({
        field: "deliveryFees",
        oldValue: String(current.deliveryFees),
        newValue: String(newDeliveryFees),
      });
    }

    const newCommissionRate = (input.defaultCommissionRate / 100).toFixed(4);
    if (current.defaultCommissionRate !== newCommissionRate) {
      changes.push({
        field: "defaultCommissionRate",
        oldValue: current.defaultCommissionRate,
        newValue: newCommissionRate,
      });
    }

    if (current.opsEmail !== input.opsEmail.trim()) {
      changes.push({
        field: "opsEmail",
        oldValue: current.opsEmail,
        newValue: input.opsEmail.trim(),
      });
    }

    if (current.requestExpirationDays !== input.requestExpirationDays) {
      changes.push({
        field: "requestExpirationDays",
        oldValue: String(current.requestExpirationDays),
        newValue: String(input.requestExpirationDays),
      });
    }

    if (current.requestUrgencyDaysBeforeStart !== input.requestUrgencyDaysBeforeStart) {
      changes.push({
        field: "requestUrgencyDaysBeforeStart",
        oldValue: String(current.requestUrgencyDaysBeforeStart),
        newValue: String(input.requestUrgencyDaysBeforeStart),
      });
    }

    if (current.deliveryUrgencyDaysBeforeStart !== input.deliveryUrgencyDaysBeforeStart) {
      changes.push({
        field: "deliveryUrgencyDaysBeforeStart",
        oldValue: String(current.deliveryUrgencyDaysBeforeStart),
        newValue: String(input.deliveryUrgencyDaysBeforeStart),
      });
    }

    if (changes.length === 0) {
      return { success: true as const };
    }

    // Update settings + insert history in a transaction
    await db.transaction(async (tx) => {
      await tx
        .update(platformSettings)
        .set({
          platformMarginRate: newMarginRate,
          deliveryFees: newDeliveryFees,
          defaultCommissionRate: newCommissionRate,
          opsEmail: input.opsEmail.trim(),
          requestExpirationDays: input.requestExpirationDays,
          requestUrgencyDaysBeforeStart: input.requestUrgencyDaysBeforeStart,
          deliveryUrgencyDaysBeforeStart: input.deliveryUrgencyDaysBeforeStart,
          updatedAt: new Date(),
          updatedById: ctx.session.user.id,
        })
        .where(eq(platformSettings.id, "global"));

      // Insert one history row per changed field
      for (const change of changes) {
        await tx.insert(platformSettingsHistory).values({
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          changedById: ctx.session.user.id,
        });
      }
    });

    return { success: true as const };
  } catch (error) {
    console.error("Failed to update platform settings:", error);
    return { error: "INTERNAL_ERROR" as const };
  }
}

export async function getSettingsHistory() {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  try {
    const history = await db.query.platformSettingsHistory.findMany({
      orderBy: (h, { desc }) => desc(h.changedAt),
      limit: 50,
    });

    return { data: history };
  } catch (error) {
    console.error("Failed to fetch settings history:", error);
    return { error: "INTERNAL_ERROR" as const };
  }
}

export async function getGenresStatusAction() {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  const allGenres = await listGenres();
  return { data: { total: allGenres.length } };
}

export async function seedGenresAction() {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  try {
    const result = await seedMissingGenres();
    return { success: true as const, data: result };
  } catch (error) {
    console.error("Failed to seed genres:", error);
    return { error: "INTERNAL_ERROR" as const };
  }
}
