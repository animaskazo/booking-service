// ============================================================================
// create-flow-payment — Supabase Edge Function
// ============================================================================
// Recibe los datos de la reserva, firma la petición con HMAC-SHA256 y
// llama a payment/create en Flow. Devuelve { url, token } al frontend.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


// HMAC-SHA256 usando Web Crypto API (disponible en Deno)
async function hmacSHA256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildSignedParams(params: Record<string, string>): Record<string, string> {
  const sorted = Object.keys(params).sort();
  const toSign = sorted.map((k) => `${k}${params[k]}`).join("");
  return { toSign, sorted: sorted.join(",") };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Read secrets inside handler to ensure they are always current
  const FLOW_API_KEY = Deno.env.get("FLOW_API_KEY") ?? "";
  const FLOW_SECRET_KEY = Deno.env.get("FLOW_SECRET_KEY") ?? "";
  const FLOW_ENV = Deno.env.get("FLOW_ENV") ?? "sandbox";
  const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:5173";
  const FLOW_BASE = FLOW_ENV === "production"
    ? "https://www.flow.cl/api"
    : "https://sandbox.flow.cl/api";

  console.log("FLOW_API_KEY present:", !!FLOW_API_KEY, "| FLOW_ENV:", FLOW_ENV);

  try {
    const body = await req.json();
    const {
      serviceId,
      serviceName,
      amount,
      customerEmail,
      customerName,
      slotStart,
      slotEnd,
      notes,
      phone,
    } = body;

    if (!amount || !customerEmail || !serviceName) {
      return new Response(
        JSON.stringify({ error: "Faltan datos requeridos" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generar commerceOrder único para Flow y shortId corto (6 caracteres) para DB
    const commerceOrder = `BK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const shortId = Math.random().toString(36).slice(2, 8).toUpperCase();
    
    // Crear reserva con pago pendiente en Supabase
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Obtener el user_id del dueño del servicio
    const { data: serviceData } = await supabase
      .from("services")
      .select("user_id")
      .eq("id", serviceId)
      .single();

    const { data: appt, error: dbError } = await supabase
      .from("appointments")
      .insert({
        service_id: serviceId,
        user_id: serviceData?.user_id || null,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: phone ?? "",
        start_time: slotStart,
        end_time: slotEnd,
        notes: notes ?? "",
        status: "pending",
        short_id: shortId,
        flow_commerce_order: commerceOrder,
        paid: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error creating pending appointment:", dbError);
      return new Response(
        JSON.stringify({ error: "Error al registrar reserva preliminar", detail: dbError }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const params: Record<string, string> = {
      apiKey: FLOW_API_KEY,
      amount: String(Math.round(amount)),
      commerceOrder,
      currency: "CLP",
      email: customerEmail,
      subject: `Reserva #${shortId}: ${serviceName.slice(0, 30)}`,
      urlConfirmation: `${Deno.env.get("SUPABASE_URL")}/functions/v1/confirm-flow-payment`,
      urlReturn: `${Deno.env.get("SUPABASE_URL")}/functions/v1/flow-return-handler`,
      optional: commerceOrder, // Sólo guardamos el commerceOrder
    };

    // Firmar
    const sortedKeys = Object.keys(params).sort();
    const toSign = sortedKeys.map((k) => `${k}${params[k]}`).join("");
    const signature = await hmacSHA256(FLOW_SECRET_KEY, toSign);
    params.s = signature;

    // POST a Flow
    const formBody = new URLSearchParams(params).toString();
    const flowRes = await fetch(`${FLOW_BASE}/payment/create`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    });

    if (!flowRes.ok) {
      const errText = await flowRes.text();
      console.error("Flow error:", errText);
      return new Response(
        JSON.stringify({ error: "Error al crear pago en Flow", detail: errText }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const flowData = await flowRes.json();

    // Flow devuelve: { token, url, flowOrder }
    if (!flowData.url || !flowData.token) {
      return new Response(
        JSON.stringify({ error: "Respuesta inválida de Flow", detail: flowData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // La URL final de pago es: flowData.url + "?token=" + flowData.token
    const paymentUrl = `${flowData.url}?token=${flowData.token}`;

    // Guardar el token en la reserva para que BookingReturn pueda encontrarla
    await supabase
      .from("appointments")
      .update({ flow_token: flowData.token })
      .eq("id", appt.id);

    return new Response(
      JSON.stringify({ url: paymentUrl, token: flowData.token, commerceOrder }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-flow-payment error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno", detail: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
