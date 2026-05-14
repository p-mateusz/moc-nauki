// Stripe Billing Portal - self-service do zarządzania subskrypcją
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: account } = await admin
      .from("user_accounts")
      .select("email, stripe_customer_id")
      .eq("id", userId)
      .single();

    let customerId = account?.stripe_customer_id ?? null;
    if (!customerId && account?.email) {
      const found = await stripe.customers.list({ email: account.email, limit: 1 });
      if (found.data.length) {
        customerId = found.data[0].id;
        await admin.from("user_accounts").update({ stripe_customer_id: customerId }).eq("id", userId);
      }
    }

    if (!customerId) {
      return new Response(JSON.stringify({ error: "Brak konta w Stripe — najpierw kup plan." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const origin = req.headers.get("origin") || "https://moc-nauki.lovable.app";
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard`,
    });

    return new Response(JSON.stringify({ url: portal.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-portal-link error:", e);
    return new Response(JSON.stringify({ error: "Wystąpił błąd — spróbuj ponownie" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
