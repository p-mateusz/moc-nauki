// Stripe webhook - obsługuje checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_failed
// Public endpoint - weryfikacja przez podpis Stripe
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PRICE_30 = "price_1TTStLAJNxOGa1N8vDlJBIH6";
const PRICE_90 = "price_1TTStQAJNxOGa1N8IbJSOIvU";

async function findUserId(opts: {
  metadataUserId?: string | null;
  customerId?: string | null;
  email?: string | null;
}): Promise<string | null> {
  if (opts.metadataUserId) return opts.metadataUserId;
  if (opts.customerId) {
    const { data } = await supabase
      .from("user_accounts")
      .select("id")
      .eq("stripe_customer_id", opts.customerId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  if (opts.email) {
    const { data } = await supabase
      .from("user_accounts")
      .select("id")
      .eq("email", opts.email)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature header", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Signature verification failed:", err);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  console.log(`✅ Stripe event: ${event.type} (id=${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = (session.customer as string) || null;
        const email = session.customer_email ?? session.customer_details?.email ?? null;
        const userId = await findUserId({
          metadataUserId: session.metadata?.user_id,
          customerId,
          email,
        });
        if (!userId) { console.warn("checkout.session.completed: no user matched"); break; }

        const plan = session.metadata?.plan || (session.mode === "subscription" ? "30" : "90");
        const updates: Record<string, unknown> = {
          stripe_customer_id: customerId,
          subscription_plan: plan === "90" ? "90d" : "30d",
          subscription_status: "active",
          payment_date: new Date().toISOString(),
          payment_method: "stripe",
        };

        if (plan === "90") {
          const expires = new Date();
          expires.setDate(expires.getDate() + 90);
          updates.subscription_expires_at = expires.toISOString();
          updates.subscription_end_date = expires.toISOString();
          updates.cancel_at_period_end = false;
          updates.stripe_subscription_id = null;
        } else {
          updates.stripe_subscription_id = (session.subscription as string) || null;
        }

        await supabase.from("user_accounts").update(updates).eq("id", userId);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const userId = await findUserId({
          metadataUserId: sub.metadata?.user_id,
          customerId,
        });
        if (!userId) { console.warn("subscription.updated: no user matched"); break; }

        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        const isCanceling = sub.cancel_at_period_end === true;

        let status = "active";
        if (sub.status === "past_due" || sub.status === "unpaid") status = "inactive";
        else if (sub.status === "canceled") status = "canceled";
        else if (sub.status === "active" || sub.status === "trialing") status = "active";

        await supabase.from("user_accounts").update({
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          subscription_plan: "30d",
          subscription_status: status,
          subscription_expires_at: periodEnd,
          subscription_end_date: periodEnd,
          cancel_at_period_end: isCanceling,
        }).eq("id", userId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const userId = await findUserId({
          metadataUserId: sub.metadata?.user_id,
          customerId,
        });
        if (!userId) break;
        const expiresAt = new Date(sub.current_period_end * 1000).toISOString();
        await supabase.from("user_accounts").update({
          subscription_status: "canceled",
          subscription_expires_at: expiresAt,
          subscription_end_date: expiresAt,
          cancel_at_period_end: true,
          stripe_subscription_id: null,
        }).eq("id", userId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const userId = await findUserId({ customerId });
        if (!userId) break;
        await supabase.from("user_accounts").update({
          subscription_status: "inactive",
        }).eq("id", userId);
        break;
      }

      default:
        console.log(`Nieobsługiwany event: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
