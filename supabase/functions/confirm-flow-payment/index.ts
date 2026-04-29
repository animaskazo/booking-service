// ============================================================================
// confirm-flow-payment — Supabase Edge Function
// ============================================================================
// Flow llama a esta función vía POST con un `token`.
// Verifica el estado del pago, crea la reserva en Supabase y envía email.
// IMPORTANTE: debe retornar 200 OK para que Flow no reintente la notificación.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FLOW_API_KEY = Deno.env.get("FLOW_API_KEY") ?? "";
const FLOW_SECRET_KEY = Deno.env.get("FLOW_SECRET_KEY") ?? "";
const FLOW_ENV = Deno.env.get("FLOW_ENV") ?? "sandbox";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const FLOW_BASE =
  FLOW_ENV === "production"
    ? "https://www.flow.cl/api"
    : "https://sandbox.flow.cl/api";

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

function generateShortId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

serve(async (req) => {
  // Flow envía POST con application/x-www-form-urlencoded
  let token = "";
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    token = params.get("token") ?? "";
  } catch {
    return new Response("ok", { status: 200 });
  }

  if (!token) {
    return new Response("ok", { status: 200 });
  }

  try {
    // 1. Obtener estado del pago desde Flow
    const getStatusParams: Record<string, string> = {
      apiKey: FLOW_API_KEY,
      token,
    };
    const sortedKeys = Object.keys(getStatusParams).sort();
    const toSign = sortedKeys.map((k) => `${k}${getStatusParams[k]}`).join("");
    const signature = await hmacSHA256(FLOW_SECRET_KEY, toSign);

    const statusUrl = `${FLOW_BASE}/payment/getStatus?${new URLSearchParams({
      ...getStatusParams,
      s: signature,
    })}`;

    const statusRes = await fetch(statusUrl);
    if (!statusRes.ok) {
      console.error("Flow getStatus error:", await statusRes.text());
      return new Response("ok", { status: 200 });
    }

    const payment = await statusRes.json();
    console.log("Flow payment status:", JSON.stringify(payment));

    // status: 1=pendiente, 2=pagado, 3=rechazado, 4=anulado
    if (payment.status !== 2) {
      console.log("Payment not successful, status:", payment.status);
      return new Response("ok", { status: 200 });
    }

    // 2. Buscar la reserva con pago pendiente en Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const { data: appointment, error: dbError } = await supabase
      .from("appointments")
      .select("*, service:services(name)")
      .eq("flow_commerce_order", payment.commerceOrder)
      .single();

    if (dbError || !appointment) {
      console.error("No pending appointment found for commerceOrder:", payment.commerceOrder);
      return new Response("ok", { status: 200 });
    }

    // Si ya está confirmada, ignorar (idempotencia)
    if (appointment.status === "confirmed") {
      console.log("Appointment already confirmed");
      return new Response("ok", { status: 200 });
    }

    // 3. Actualizar reserva a Confirmada y Pagada
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        status: "confirmed",
        paid: true,
        paid_amount: payment.amount,
        flow_token: token,
      })
      .eq("id", appointment.id);

    if (updateError) {
      console.error("Error updating appointment to confirmed:", updateError);
      return new Response("ok", { status: 200 });
    }

    // Mapear variables para el email
    const customerName = appointment.customer_name;
    const customerEmail = appointment.customer_email;
    const serviceName = appointment.service?.name || "Servicio";
    const slotStart = appointment.start_time;
    const shortId = appointment.short_id;
    const slotEnd = appointment.end_time;
    console.log("Appointment confirmed in Supabase:", appointment.id);

    // 4. Enviar email de confirmación vía Resend
    // 4. Enviar email de confirmación llamando a la función existente send-booking-email
    if (customerEmail) {
      try {
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-booking-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            type: "booking",
            customerName: customerName,
            customerEmail: customerEmail,
            serviceName: serviceName,
            date: formatDate(slotStart),
            time: `${formatTime(slotStart)} – ${formatTime(slotEnd)}`,
            shortId: shortId,
            notes: appointment.notes ?? "",
          }),
        });

        if (!res.ok) {
          const errData = await res.text();
          console.error("Error calling send-booking-email:", errData);
        } else {
          console.log("Send-booking-email called successfully!");
        }
      } catch (emailErr) {
        console.error("Error invoking send-booking-email:", emailErr);
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("confirm-flow-payment error:", err);
    // Siempre retornar 200 para que Flow no reintente
    return new Response("ok", { status: 200 });
  }
});
