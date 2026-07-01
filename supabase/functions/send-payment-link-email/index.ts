// ============================================================================
// send-payment-link-email — Supabase Edge Function
// ============================================================================
// Envía por correo (Resend) el link de pago Flow al cliente del ticket.
// Recibe: { customer_name, customer_email, short_id, description, amount, payment_url, tech_support_email }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const RESEND_FROM    = Deno.env.get("RESEND_FROM_EMAIL") || "no-reply@digital-solutions.work";

  try {
    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const body = await req.json();
    const {
      customer_name,
      customer_email,
      short_id,
      description,
      amount,
      payment_url,
      tech_support_email = "contacto@powerfix.cl",
    } = body;

    if (!customer_email || !payment_url || !amount) {
      return new Response(
        JSON.stringify({ error: "Faltan datos requeridos: customer_email, payment_url, amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formatPrice = (price: number) =>
      new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        minimumFractionDigits: 0,
      }).format(price);

    const amountFormatted = formatPrice(Number(amount));
    const subject = `Solicitud de Abono - Ticket #${short_id}`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Solicitud de Abono</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;border-radius:12px 12px 0 0;padding:40px 48px;text-align:center;">
              <div style="display:inline-block;background-color:rgba(255,255,255,0.1);border-radius:50%;width:52px;height:52px;line-height:52px;text-align:center;margin-bottom:20px;font-size:24px;">
                💳
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
                Solicitud de Pago
              </h1>
              <p style="margin:10px 0 0;color:#94a3b8;font-size:15px;line-height:1.5;">
                Hola <strong style="color:#e2e8f0;">${customer_name}</strong>, hemos generado un link de pago seguro para realizar tu abono.
              </p>
            </td>
          </tr>

          <!-- Ticket ID Badge -->
          <tr>
            <td style="background-color:#1e293b;padding:16px 48px;text-align:center;">
              <span style="display:inline-block;background-color:#0f172a;border:1px solid #334155;border-radius:6px;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:6px 14px;">
                Ticket ID
              </span>
              &nbsp;
              <span style="display:inline-block;background-color:#2563eb;border-radius:6px;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.12em;font-family:monospace;padding:6px 16px;">${short_id}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 48px;border-radius:0 0 12px 12px;">

              <p style="margin:0 0 24px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">
                Detalle del Abono
              </p>

              <!-- Descripción -->
              <div style="margin-bottom:24px;background-color:#f8fafc;border-left:3px solid #2563eb;border-radius:0 8px 8px 0;padding:16px 20px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">
                  Concepto del Cobro
                </p>
                <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;font-style:italic;">
                  "${description}"
                </p>
              </div>

              <!-- Monto -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td style="padding:20px;background-color:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;text-align:center;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#3b82f6;">
                      Monto a Pagar
                    </p>
                    <p style="margin:0;font-size:32px;font-weight:900;color:#1e40af;letter-spacing:-1px;">
                      ${amountFormatted}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${payment_url}" target="_blank"
                  style="display:inline-block;background-color:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:10px;box-shadow:0 4px 12px rgba(37,99,235,0.3);text-transform:uppercase;letter-spacing:0.05em;">
                  Pagar Ahora
                </a>
              </div>

              <!-- Security note -->
              <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
                <p style="margin:0;font-size:12px;color:#166534;line-height:1.6;">
                  🔒 &nbsp;Este link de pago es seguro y está procesado por <strong>Flow</strong>, plataforma de pagos certificada en Chile.
                </p>
              </div>

              <div style="background-color:#f8fafc;border:1px dashed #e2e8f0;border-radius:8px;padding:16px 20px;text-align:center;">
                <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
                  💡 &nbsp;Si tienes dudas sobre este cobro, puedes responder directamente este correo.
                </p>
              </div>

              <div style="border-top:1px solid #f1f5f9;margin:32px 0;"></div>

              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
                Si el botón no funciona, copia y pega este link en tu navegador:<br/>
                <a href="${payment_url}" style="color:#2563eb;word-break:break-all;font-size:11px;">${payment_url}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.8;">
                © ${new Date().getFullYear()} PowerFix System<br/>
                Servicio Técnico Especializado
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

    const fromAddress = RESEND_FROM.includes("<")
      ? RESEND_FROM
      : `Servicio Técnico <${RESEND_FROM}>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [customer_email],
        bcc: [tech_support_email],
        reply_to: [tech_support_email],
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", data);
      return new Response(
        JSON.stringify({ error: "Error al enviar email", detail: data }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("send-payment-link-email error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
