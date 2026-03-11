import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { accounts, orders } from "@/lib/db/schema";
import { isStripeConnectComplete } from "@/lib/services/rights-holder-service";
import { stripe } from "@/lib/stripe";

import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata?.order_id;

        if (orderId) {
          await db
            .update(orders)
            .set({ status: "paid", paidAt: new Date() })
            .where(eq(orders.id, orderId));

          // TODO: trigger Stripe Connect transfers to rights holders
          // TODO: notify the ops team (email + dashboard)
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        // TODO: notify the exhibitor of the failure
        console.error("Payment failed:", paymentIntent.id);
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

      default:
        console.warn(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
