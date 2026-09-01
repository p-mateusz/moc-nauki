// Tworzy Stripe Checkout Session dla planu 30-dniowego (sub) lub 90-dniowego (one-off).
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_30 = "price_1TTStLAJNxOGa1N8vDlJBIH6";
const PRICE_90 = "price_1TTStQAJNxOGa1N8IbJSOIvU";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: claims } = await supabase.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { plan } = await req.json();
    if (plan !== "30" && plan !== "90") {
      return new Response(JSON.stringify({ error: "Invalid plan" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Admin może nadpisać checkout własnym linkiem płatności (app_settings).
    const overrideKey = plan === "30" ? "payment_link_30" : "payment_link_90";
    const { data: overrideRow } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", overrideKey)
      .maybeSingle();
    const overrideUrl = typeof overrideRow?.value === "string" ? overrideRow.value.trim() : "";
    if (overrideUrl && /^https:\/\//i.test(overrideUrl)) {
      const withRef = new URL(overrideUrl);
      withRef.searchParams.set("client_reference_id", userId);
      return new Response(JSON.stringify({ url: withRef.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: account } = await admin
      .from("user_accounts")
      .select("email, stripe_customer_id")
      .eq("id", userId)
      .single();

    let customerId = account?.stripe_customer_id ?? null;
    if (!customerId && account?.email) {
      const found = await stripe.customers.list({ email: account.email, limit: 1 });
      if (found.data.length) customerId = found.data[0].id;
    }

    const origin = "https://www.moc-nauki.pl";
    const session = await stripe.checkout.sessions.create({
      mode: plan === "30" ? "subscription" : "payment",
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : account?.email,
      line_items: [{ price: plan === "30" ? PRICE_30 : PRICE_90, quantity: 1 }],
      success_url: `${origin}/pricing?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      metadata: { user_id: userId, plan },
      subscription_data: plan === "30" ? { metadata: { user_id: userId, plan: "30" } } : undefined,
      payment_intent_data: plan === "90" ? { metadata: { user_id: userId, plan: "90" } } : undefined,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    return new Response(JSON.stringify({ error: "Wystąpił błąd — spróbuj ponownie" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
