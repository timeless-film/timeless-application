import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { accounts, orders, orderItems, cartItems, requests } from "@/lib/db/schema";
import {
  sendOrderConfirmationEmail,
  sendRightsHolderOrderNotificationEmail,
  sendOpsOrderNotificationEmail,
} from "@/lib/email/order-emails";
import {
  sendPayoutFailedEmail,
  sendPayoutPaidEmail,
  sendOpsPayoutFailedEmail,
} from "@/lib/email/wallet-emails";
import { calculateRightsHolderTaxAmount } from "@/lib/pricing";
import { isStripeConnectComplete } from "@/lib/services/rights-holder-service";
import { stripe, transferToRightsHolder } from "@/lib/stripe";

import type { NextRequest } from "next/server";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.warn(
          `Checkout session expired: ${session.id} (exhibitor: ${session.metadata?.exhibitor_account_id})`
        );
        break;
      }

      case "account.updated": {
        // Stripe Connect — update rights holder onboarding status
        const account = event.data.object;
        const onboardingComplete = isStripeConnectComplete(account);

        const updated = await db
          .update(accounts)
          .set({ stripeConnectOnboardingComplete: onboardingComplete, updatedAt: new Date() })
          .where(eq(accounts.stripeConnectAccountId, account.id))
          .returning({ id: accounts.id });

        if (updated.length > 0) {
          revalidatePath("/", "layout");
        }
        break;
      }

      case "payout.paid": {
        await handlePayoutPaid(event.data.object as Stripe.Payout, event.account);
        break;
      }

      case "payout.failed": {
        await handlePayoutFailed(event.data.object as Stripe.Payout, event.account);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ─── checkout.session.completed handler ───────────────────────────────────────

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const exhibitorAccountId = session.metadata?.exhibitor_account_id;
  const requestId = session.metadata?.request_id;
  const cartItemIdsJson = session.metadata?.cart_item_ids;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!exhibitorAccountId || !paymentIntentId) {
    console.error("Checkout session missing required metadata:", session.id);
    return;
  }

  // Idempotence: check if order already exists for this PaymentIntent
  const existingOrder = await db.query.orders.findFirst({
    where: eq(orders.stripePaymentIntentId, paymentIntentId),
  });

  if (existingOrder) {
    console.warn(`Order already exists for PaymentIntent ${paymentIntentId}, skipping`);
    return;
  }

  // Extract invoice ID (available when invoice_creation is enabled)
  const stripeInvoiceId =
    typeof session.invoice === "string" ? session.invoice : (session.invoice?.id ?? null);

  // Dispatch: request payment vs cart payment
  if (requestId) {
    await handleRequestPayment(
      session,
      exhibitorAccountId,
      requestId,
      paymentIntentId,
      stripeInvoiceId
    );
  } else if (cartItemIdsJson) {
    await handleCartPayment(
      session,
      exhibitorAccountId,
      cartItemIdsJson,
      paymentIntentId,
      stripeInvoiceId
    );
  } else {
    console.error("Checkout session has neither request_id nor cart_item_ids:", session.id);
  }
}

// ─── Request payment handler ──────────────────────────────────────────────────

async function handleRequestPayment(
  session: Stripe.Checkout.Session,
  exhibitorAccountId: string,
  requestId: string,
  paymentIntentId: string,
  stripeInvoiceId: string | null
) {
  // Fetch the request with relations
  const request = await db.query.requests.findFirst({
    where: eq(requests.id, requestId),
    with: {
      film: true,
      cinema: true,
      room: true,
      rightsHolderAccount: {
        columns: {
          id: true,
          companyName: true,
          contactEmail: true,
          stripeConnectAccountId: true,
        },
      },
    },
  });

  if (!request) {
    console.error(`Request ${requestId} not found for checkout session ${session.id}`);
    return;
  }

  if (request.status !== "approved") {
    console.error(`Request ${requestId} is not approved (status: ${request.status}), skipping`);
    return;
  }

  const taxAmount = session.total_details?.amount_tax ?? 0;
  const subtotal = request.displayedPrice * request.screeningCount;
  const deliveryFeesTotal = request.deliveryFees; // 1 film per request
  const total = subtotal + deliveryFeesTotal + taxAmount;

  // Agent model: calculate RH's share of VAT proportional to their HT amount
  const rightsHolderTaxAmount = calculateRightsHolderTaxAmount({
    taxAmount,
    rightsHolderAmount: request.rightsHolderAmount,
    screeningCount: request.screeningCount,
    subtotal,
    deliveryFeesTotal,
  });

  const exhibitorAccount = await db.query.accounts.findFirst({
    where: eq(accounts.id, exhibitorAccountId),
  });

  // Create order + order item + transition request status in a single transaction
  const createdOrder = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        exhibitorAccountId,
        stripePaymentIntentId: paymentIntentId,
        stripeInvoiceId,
        status: "paid",
        subtotal,
        deliveryFeesTotal,
        taxAmount,
        total,
        currency: request.currency,
        taxRate: taxAmount > 0 ? ((taxAmount / subtotal) * 100).toFixed(2) : null,
        vatNumber: exhibitorAccount?.vatNumber || null,
        paidAt: new Date(),
      })
      .returning();

    if (!order) {
      throw new Error("Failed to create order for request");
    }

    // Insert single order item from request snapshot
    await tx.insert(orderItems).values({
      orderId: order.id,
      filmId: request.filmId,
      cinemaId: request.cinemaId,
      roomId: request.roomId,
      rightsHolderAccountId: request.rightsHolderAccountId,
      screeningCount: request.screeningCount,
      startDate: request.startDate,
      endDate: request.endDate,
      catalogPrice: request.catalogPrice,
      platformMarginRate: request.platformMarginRate,
      deliveryFees: request.deliveryFees,
      commissionRate: request.commissionRate,
      displayedPrice: request.displayedPrice,
      rightsHolderAmount: request.rightsHolderAmount,
      rightsHolderTaxAmount,
      timelessAmount: request.timelessAmount,
      currency: request.currency,
      originalCatalogPrice: request.originalCatalogPrice,
      originalCurrency: request.originalCurrency,
      exchangeRate: request.exchangeRate,
      requestId: request.id,
    });

    // Transition request status: approved → paid
    await tx
      .update(requests)
      .set({
        status: "paid",
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(requests.id, requestId));

    return order;
  });

  // After commit — Stripe Connect transfer to rights holder (best-effort)
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const chargeId =
      typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id;

    if (chargeId && request.rightsHolderAccount.stripeConnectAccountId) {
      const createdItems = await db.query.orderItems.findMany({
        where: eq(orderItems.orderId, createdOrder.id),
      });

      const createdItem = createdItems[0];
      if (createdItem) {
        try {
          const transfer = await transferToRightsHolder({
            amount: request.rightsHolderAmount * request.screeningCount + rightsHolderTaxAmount,
            currency: request.currency,
            stripeConnectAccountId: request.rightsHolderAccount.stripeConnectAccountId,
            chargeId,
            orderItemId: createdItem.id,
          });

          await db
            .update(orderItems)
            .set({ stripeTransferId: transfer.id })
            .where(eq(orderItems.id, createdItem.id));
        } catch (error) {
          console.error(`Transfer failed for request order item ${createdItem.id}:`, error);
        }
      }
    } else {
      console.error(`No charge ID or Connect account for request ${requestId}`);
    }
  } catch (error) {
    console.error(`Failed to process transfers for request order ${createdOrder.id}:`, error);
  }

  // Best-effort email notifications
  const { getPlatformPricingSettings } = await import("@/lib/pricing");
  const settings = await getPlatformPricingSettings();

  await sendOrderEmails({
    order: createdOrder,
    orderItemsData: [
      {
        filmTitle: request.film.title,
        cinemaName: request.cinema.name,
        roomName: request.room.name,
        screeningCount: request.screeningCount,
        displayedPrice: request.displayedPrice,
        rightsHolderAmount: request.rightsHolderAmount,
        rightsHolderAccountId: request.rightsHolderAccountId,
        currency: request.currency,
      },
    ],
    exhibitorAccount,
    settings,
  });

  revalidatePath("/", "layout");
}

// ─── Cart payment handler ─────────────────────────────────────────────────────

async function handleCartPayment(
  session: Stripe.Checkout.Session,
  exhibitorAccountId: string,
  cartItemIdsJson: string,
  paymentIntentId: string,
  stripeInvoiceId: string | null
) {
  // Parse cart item IDs from metadata
  let cartItemIds: string[];
  try {
    cartItemIds = JSON.parse(cartItemIdsJson) as string[];
  } catch {
    console.error("Failed to parse cart_item_ids from session metadata:", cartItemIdsJson);
    return;
  }

  // Fetch cart items with full details
  const cartItemsData = await db.query.cartItems.findMany({
    where: eq(cartItems.exhibitorAccountId, exhibitorAccountId),
    with: {
      film: {
        with: {
          prices: true,
          account: true,
        },
      },
      cinema: true,
      room: true,
    },
  });

  // Filter to only the items that were in this checkout session
  const relevantItems = cartItemsData.filter((item) => cartItemIds.includes(item.id));

  if (relevantItems.length === 0) {
    console.error("No matching cart items found for checkout session:", session.id);
    return;
  }

  // Calculate tax totals from Stripe
  const taxAmount = session.total_details?.amount_tax ?? 0;
  const currency = (session.currency || "eur").toUpperCase();

  // Get exhibitor account for preferred currency
  const exhibitorAccount = await db.query.accounts.findFirst({
    where: eq(accounts.id, exhibitorAccountId),
  });
  const preferredCurrency = exhibitorAccount?.preferredCurrency || currency;

  // Calculate subtotal from validated items
  // We recalculate using the same logic as checkout to ensure accuracy
  const { getPlatformPricingSettings, resolveCommissionRate, calculatePricing } =
    await import("@/lib/pricing");
  const { convertCurrency } = await import("@/lib/services/exchange-rate-service");

  const settings = await getPlatformPricingSettings();

  // Build order items data
  interface OrderItemData {
    filmId: string;
    filmTitle: string;
    cinemaId: string;
    cinemaName: string;
    roomId: string;
    roomName: string;
    rightsHolderAccountId: string;
    screeningCount: number;
    startDate: string | null;
    endDate: string | null;
    catalogPrice: number;
    platformMarginRate: string;
    deliveryFees: number;
    commissionRate: string;
    displayedPrice: number;
    rightsHolderAmount: number;
    rightsHolderTaxAmount: number;
    timelessAmount: number;
    currency: string;
    originalCatalogPrice: number | null;
    originalCurrency: string | null;
    exchangeRate: string | null;
    stripeConnectAccountId: string;
  }

  const orderItemsData: OrderItemData[] = [];
  let subtotal = 0;

  for (const item of relevantItems) {
    const territory = item.cinema.country;
    const filmPrice = item.film.prices.find((p) => p.countries.includes(territory));
    if (!filmPrice) continue;

    const commissionRate = resolveCommissionRate(
      item.film.account.commissionRate,
      settings.defaultCommissionRate
    );

    const filmCurrency = filmPrice.currency;
    const needsConversion = filmCurrency !== preferredCurrency;

    let catalogPriceInExhibitorCurrency = filmPrice.price;
    let exchangeRate: string | null = null;

    if (needsConversion) {
      const converted = await convertCurrency(filmPrice.price, filmCurrency, preferredCurrency);
      if (converted === null) {
        console.error(
          `Currency conversion failed for item ${item.id}: ${filmCurrency} → ${preferredCurrency}`
        );
        continue;
      }
      catalogPriceInExhibitorCurrency = converted;
      exchangeRate = (converted / filmPrice.price).toFixed(6);
    }

    const pricing = calculatePricing({
      catalogPrice: catalogPriceInExhibitorCurrency,
      currency: preferredCurrency,
      platformMarginRate: settings.platformMarginRate,
      deliveryFees: settings.deliveryFees,
      commissionRate,
    });

    subtotal += pricing.displayedPrice * item.screeningCount;

    orderItemsData.push({
      filmId: item.filmId,
      filmTitle: item.film.title,
      cinemaId: item.cinemaId,
      cinemaName: item.cinema.name,
      roomId: item.roomId,
      roomName: item.room.name,
      rightsHolderAccountId: item.film.accountId,
      screeningCount: item.screeningCount,
      startDate: item.startDate,
      endDate: item.endDate,
      catalogPrice: catalogPriceInExhibitorCurrency,
      platformMarginRate: pricing.platformMarginRate.toString(),
      deliveryFees: pricing.deliveryFees,
      commissionRate: pricing.commissionRate.toString(),
      displayedPrice: pricing.displayedPrice,
      rightsHolderAmount: pricing.rightsHolderAmount,
      rightsHolderTaxAmount: 0, // Calculated after subtotal + deliveryFeesTotal are known
      timelessAmount: pricing.timelessAmount,
      currency: preferredCurrency,
      originalCatalogPrice: needsConversion ? filmPrice.price : null,
      originalCurrency: needsConversion ? filmCurrency : null,
      exchangeRate,
      stripeConnectAccountId: item.film.account.stripeConnectAccountId || "",
    });
  }

  const deliveryFeesPerItem = settings.deliveryFees;
  const deliveryFeesTotal = deliveryFeesPerItem * orderItemsData.length;
  const total = subtotal + deliveryFeesTotal + taxAmount;

  // Agent model: calculate each item's RH tax share proportional to their HT amount
  for (const item of orderItemsData) {
    item.rightsHolderTaxAmount = calculateRightsHolderTaxAmount({
      taxAmount,
      rightsHolderAmount: item.rightsHolderAmount,
      screeningCount: item.screeningCount,
      subtotal,
      deliveryFeesTotal,
    });
  }

  // Create order + items + clear cart in a single transaction
  const createdOrder = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        exhibitorAccountId,
        stripePaymentIntentId: paymentIntentId,
        stripeInvoiceId,
        status: "paid",
        subtotal,
        deliveryFeesTotal,
        taxAmount,
        total,
        currency: preferredCurrency,
        taxRate: session.total_details?.amount_tax
          ? ((taxAmount / (subtotal + deliveryFeesTotal)) * 100).toFixed(2)
          : null,
        vatNumber: exhibitorAccount?.vatNumber || null,
        paidAt: new Date(),
      })
      .returning();

    if (!order) {
      throw new Error("Failed to create order");
    }

    // Insert all order items
    if (orderItemsData.length > 0) {
      await tx.insert(orderItems).values(
        orderItemsData.map((item) => ({
          orderId: order.id,
          filmId: item.filmId,
          cinemaId: item.cinemaId,
          roomId: item.roomId,
          rightsHolderAccountId: item.rightsHolderAccountId,
          screeningCount: item.screeningCount,
          startDate: item.startDate,
          endDate: item.endDate,
          catalogPrice: item.catalogPrice,
          platformMarginRate: item.platformMarginRate,
          deliveryFees: item.deliveryFees,
          commissionRate: item.commissionRate,
          displayedPrice: item.displayedPrice,
          rightsHolderAmount: item.rightsHolderAmount,
          rightsHolderTaxAmount: item.rightsHolderTaxAmount,
          timelessAmount: item.timelessAmount,
          currency: item.currency,
          originalCatalogPrice: item.originalCatalogPrice,
          originalCurrency: item.originalCurrency,
          exchangeRate: item.exchangeRate,
        }))
      );
    }

    // Clear cart items for this exhibitor
    await tx.delete(cartItems).where(eq(cartItems.exhibitorAccountId, exhibitorAccountId));

    return order;
  });

  // After commit — Stripe Connect transfers (best-effort)
  // If Stripe API is unavailable (e.g., fake keys in E2E), order remains valid
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const chargeId =
      typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id;

    if (chargeId) {
      // Fetch created order items for transfer mapping
      const createdItems = await db.query.orderItems.findMany({
        where: eq(orderItems.orderId, createdOrder.id),
      });

      for (let i = 0; i < orderItemsData.length; i++) {
        const itemData = orderItemsData[i]!;
        const createdItem = createdItems[i];

        if (!itemData.stripeConnectAccountId || !createdItem) continue;

        try {
          const transfer = await transferToRightsHolder({
            amount:
              itemData.rightsHolderAmount * itemData.screeningCount +
              itemData.rightsHolderTaxAmount,
            currency: itemData.currency,
            stripeConnectAccountId: itemData.stripeConnectAccountId,
            chargeId,
            orderItemId: createdItem.id,
          });

          // Store transfer ID on the order item
          await db
            .update(orderItems)
            .set({ stripeTransferId: transfer.id })
            .where(eq(orderItems.id, createdItem.id));
        } catch (error) {
          // Transfer failed — order is valid, transfer can be retried
          console.error(`Transfer failed for order item ${createdItem.id}:`, error);
        }
      }
    } else {
      console.error(`No charge ID found for PaymentIntent ${paymentIntentId}`);
    }
  } catch (error) {
    console.error(`Failed to process transfers for cart order ${createdOrder.id}:`, error);
  }

  // Best-effort email notifications
  await sendOrderEmails({
    order: createdOrder,
    orderItemsData,
    exhibitorAccount,
    settings,
  });

  // Revalidate pages
  revalidatePath("/", "layout");
}

// ─── Email notifications ──────────────────────────────────────────────────────

async function sendOrderEmails(params: {
  order: {
    id: string;
    orderNumber: number;
    subtotal: number;
    deliveryFeesTotal: number;
    taxAmount: number;
    total: number;
    currency: string;
  };
  orderItemsData: Array<{
    filmTitle: string;
    cinemaName: string;
    roomName: string;
    screeningCount: number;
    displayedPrice: number;
    rightsHolderAmount: number;
    rightsHolderAccountId: string;
    currency: string;
  }>;
  exhibitorAccount: { companyName: string; contactEmail: string | null } | undefined;
  settings: { opsEmail: string };
}) {
  const { order, orderItemsData, exhibitorAccount, settings } = params;

  try {
    // 1. Exhibitor confirmation
    if (exhibitorAccount?.contactEmail) {
      await sendOrderConfirmationEmail({
        orderNumber: order.orderNumber,
        exhibitorEmail: exhibitorAccount.contactEmail,
        exhibitorCompanyName: exhibitorAccount.companyName,
        items: orderItemsData.map((item) => ({
          filmTitle: item.filmTitle,
          cinemaName: item.cinemaName,
          roomName: item.roomName,
          screeningCount: item.screeningCount,
          displayedPrice: item.displayedPrice,
          currency: item.currency,
        })),
        subtotal: order.subtotal,
        deliveryFeesTotal: order.deliveryFeesTotal,
        taxAmount: order.taxAmount,
        total: order.total,
        currency: order.currency,
      });
    }

    // 2. Rights holder notifications (grouped by rights holder)
    const byRightsHolder = new Map<string, { items: typeof orderItemsData; totalAmount: number }>();

    for (const item of orderItemsData) {
      const existing = byRightsHolder.get(item.rightsHolderAccountId);
      if (existing) {
        existing.items.push(item);
        existing.totalAmount += item.rightsHolderAmount;
      } else {
        byRightsHolder.set(item.rightsHolderAccountId, {
          items: [item],
          totalAmount: item.rightsHolderAmount,
        });
      }
    }

    for (const [rhAccountId, group] of byRightsHolder) {
      const rhAccount = await db.query.accounts.findFirst({
        where: eq(accounts.id, rhAccountId),
      });

      if (rhAccount?.contactEmail) {
        await sendRightsHolderOrderNotificationEmail({
          rightsHolderEmail: rhAccount.contactEmail,
          rightsHolderCompanyName: rhAccount.companyName,
          exhibitorCompanyName: exhibitorAccount?.companyName || "",
          orderNumber: order.orderNumber,
          items: group.items.map((item) => ({
            filmTitle: item.filmTitle,
            cinemaName: item.cinemaName,
            roomName: item.roomName,
            screeningCount: item.screeningCount,
            rightsHolderAmount: item.rightsHolderAmount,
            currency: item.currency,
          })),
          totalAmount: group.totalAmount,
          currency: order.currency,
        });
      }
    }

    // 3. Ops notification
    if (settings.opsEmail) {
      await sendOpsOrderNotificationEmail({
        opsEmail: settings.opsEmail,
        orderNumber: order.orderNumber,
        exhibitorCompanyName: exhibitorAccount?.companyName || "",
        itemCount: orderItemsData.length,
        total: order.total,
        currency: order.currency,
      });
    }
  } catch (error) {
    // Emails are best-effort — log but don't fail the webhook
    console.error("Failed to send order emails:", error);
  }
}

// ─── Payout paid handler ──────────────────────────────────────────────────────

async function handlePayoutPaid(payout: Stripe.Payout, connectAccountId?: string) {
  if (!connectAccountId) return;

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.stripeConnectAccountId, connectAccountId),
  });

  if (!account) {
    console.error(`No account found for Stripe Connect ID ${connectAccountId} (payout.paid)`);
    return;
  }

  const email = account.contactEmail;
  if (!email) return;

  try {
    await sendPayoutPaidEmail({
      to: email,
      name: account.companyName ?? "Rights Holder",
      amount: payout.amount,
      currency: payout.currency,
      arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Failed to send payout paid email:", error);
  }
}

// ─── Payout failed handler ────────────────────────────────────────────────────

async function handlePayoutFailed(payout: Stripe.Payout, connectAccountId?: string) {
  if (!connectAccountId) return;

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.stripeConnectAccountId, connectAccountId),
  });

  if (!account) {
    console.error(`No account found for Stripe Connect ID ${connectAccountId} (payout.failed)`);
    return;
  }

  const failureCode = payout.failure_code ?? "unknown";
  const failureMessage = payout.failure_message ?? "Unknown failure";

  // Notify the rights holder
  const email = account.contactEmail;
  if (email) {
    try {
      await sendPayoutFailedEmail({
        to: email,
        name: account.companyName ?? "Rights Holder",
        amount: payout.amount,
        currency: payout.currency,
        failureMessage,
      });
    } catch (error) {
      console.error("Failed to send payout failed email to rights holder:", error);
    }
  }

  // Notify ops
  try {
    const { getPlatformPricingSettings } = await import("@/lib/pricing");
    const settings = await getPlatformPricingSettings();

    if (settings.opsEmail) {
      await sendOpsPayoutFailedEmail({
        opsEmail: settings.opsEmail,
        connectAccountId,
        amount: payout.amount,
        currency: payout.currency,
        failureCode,
        failureMessage,
      });
    }
  } catch (error) {
    console.error("Failed to send payout failed email to ops:", error);
  }
}
