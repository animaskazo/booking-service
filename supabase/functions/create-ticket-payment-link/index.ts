// ============================================================================
// create-ticket-payment-link — Supabase Edge Function
// ============================================================================
// Genera un link de pago en Flow para un cobro adicional de ticket de soporte.
// Guarda el registro en ticket_payment_links para trazabilidad.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FLOW_API_KEY    = Deno.env.get("FLOW_API_KEY")    ?? "";
const FLOW_SECRET_KEY = Deno.env.get("FLOW_SECRET_KEY") ?? "";
const FLOW_ENV        = Deno.env.get("FLOW_ENV")        ?? "sandbox";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")    ?? "";
const SUPABASE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const FLOW_BASE = FLOW_ENV === "production"
  ? "https://www.flow.cl/api"
  : "https://sandbox.flow.cl/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSHA256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      ticket_id,
      description,
      amount,
      customer_email,
      customer_name,
      short_id,
    } = await req.json();

    if (!ticket_id || !description || !amount) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construir commerceOrder único prefijado con TKT para diferenciarlo de reservas normales
    const commerceOrder = `TKT-${ticket_id.slice(0, 8)}-${Date.now()}`;

    const confirmUrl = `${SUPABASE_URL}/functions/v1/confirm-flow-payment`;
    const returnUrl  = `${SUPABASE_URL}/functions/v1/confirm-flow-payment`;

    const params: Record<string, string> = {
      apiKey:        FLOW_API_KEY,
      amount:        String(Math.round(amount)),
      commerceOrder,
      currency:      "CLP",
      email:         customer_email,
      paymentMethod: "9",            // Todos los medios
      subject:       description.slice(0, 100),
      urlConfirmation: confirmUrl,
      urlReturn:       returnUrl,
    };

    const sortedKeys = Object.keys(params).sort();
    const toSign = sortedKeys.map(k => `${k}${params[k]}`).join("");
    const signature = await hmacSHA256(FLOW_SECRET_KEY, toSign);

    const body = new URLSearchParams({ ...params, s: signature });
    const flowRes = await fetch(`${FLOW_BASE}/payment/create`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const flowData = await flowRes.json();
    console.log("Flow response:", JSON.stringify(flowData));

    if (!flowData.token || !flowData.url) {
      return new Response(
        JSON.stringify({ error: flowData.message || "Error al crear el pago en Flow." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentUrl = `${flowData.url}?token=${flowData.token}`;

    // ── Guardar registro en ticket_payment_links ──────────────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { error: dbError } = await supabase
      .from("ticket_payment_links")
      .insert({
        ticket_id,
        description,
        amount: Math.round(amount),
        commerce_order: commerceOrder,
        flow_token: flowData.token,
        payment_url: paymentUrl,
        status: "pending",
      });

    if (dbError) {
      console.error("Error guardando ticket_payment_links:", dbError);
      // No abortamos: el link ya fue generado, lo devolvemos igual
    }

    return new Response(
      JSON.stringify({ paymentUrl, token: flowData.token, commerceOrder }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-ticket-payment-link error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
