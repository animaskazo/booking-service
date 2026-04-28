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
    if (RESEND_API_KEY && customerEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Reservas <no-reply@bookingpro.cl>",
            to: [customerEmail],
            subject: `✅ Reserva confirmada #${shortId}`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                <h1 style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;margin-bottom:4px;">¡Reserva Confirmada!</h1>
                <p style="color:#64748b;font-size:13px;margin-bottom:32px;">Hola ${customerName?.split(" ")[0]}, tu pago fue procesado exitosamente.</p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:12px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;">Servicio</td>
                    <td style="padding:12px 0;font-size:14px;font-weight:700;text-align:right;">${serviceName}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:12px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;">Fecha</td>
                    <td style="padding:12px 0;font-size:14px;font-weight:700;text-align:right;">${formatDate(slotStart)}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:12px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;">Horario</td>
                    <td style="padding:12px 0;font-size:14px;font-weight:700;text-align:right;">${formatTime(slotStart)} – ${formatTime(slotEnd)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;">ID Reserva</td>
                    <td style="padding:12px 0;font-size:14px;font-weight:900;text-align:right;font-family:monospace;">#${shortId}</td>
                  </tr>
                </table>
                <div style="background:#f8fafc;border-radius:12px;padding:16px;text-align:center;color:#64748b;font-size:12px;">
                  Monto pagado: <strong>$${Number(payment.amount).toLocaleString("es-CL")} CLP</strong>
                </div>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.error("Email error (non-fatal):", emailErr);
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("confirm-flow-payment error:", err);
    // Siempre retornar 200 para que Flow no reintente
    return new Response("ok", { status: 200 });
  }
});
