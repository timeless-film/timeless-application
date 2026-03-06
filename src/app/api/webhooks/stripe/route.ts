import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { orders, orderItems, requests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { trackEvent, CioEvents } from "@/lib/customerio";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
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

          // TODO: déclencher les transfers Stripe Connect vers les ayants droits
          // TODO: notifier l'équipe ops (email + dashboard)
          // TODO: tracker event Customer.io
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        // TODO: notifier l'exploitant de l'échec
        console.error("Payment failed:", paymentIntent.id);
        break;
      }

      case "account.updated": {
        // Stripe Connect — mise à jour statut onboarding ayant droit
        const account = event.data.object;
        const onboardingComplete =
          account.details_submitted && account.charges_enabled;

        // TODO: mettre à jour le statut en base pour l'ayant droit concerné
        console.log(
          `Connect account ${account.id} onboarding: ${onboardingComplete}`
        );
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
