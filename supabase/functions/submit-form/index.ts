import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory per-IP rate limiter (per edge instance)
const HITS = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;
const MAX_BODY_BYTES = 10_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    HITS.set(ip, arr);
    return true;
  }
  arr.push(now);
  HITS.set(ip, arr);
  return false;
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = clientIp(req);
    if (rateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Zbyt wiele zgłoszeń. Spróbuj ponownie za chwilę." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cl = Number(req.headers.get("content-length") || "0");
    if (cl > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any;
    try { body = JSON.parse(raw); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, email, learning, achievements, motivation } = body || {};

    const isStr = (v: any, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
    if (!isStr(name, 200) || !isStr(email, 320) || !isStr(learning, 2000) || !isStr(achievements, 2000) || !isStr(motivation, 2000)) {
      return new Response(JSON.stringify({ error: "Wszystkie pola są wymagane" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Nieprawidłowy email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settingRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "webhook_form")
      .maybeSingle();

    const webhookUrl = settingRow?.value;
    if (!webhookUrl) {
      return new Response(JSON.stringify({ error: "Webhook nie jest skonfigurowany" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, learning, achievements, motivation }),
    });

    const result = await response.text();
    return new Response(result, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("submit-form error:", e);
    return new Response(JSON.stringify({ error: "Wystąpił błąd serwera" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
