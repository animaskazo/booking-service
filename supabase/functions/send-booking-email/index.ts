import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const {
      type = 'booking', // 'booking' o 'budget'
      customerName,
      customerEmail,
      serviceName,
      date,
      time,
      shortId,
      notes,
      totalAmount,
      description,
      findings,
      servicePrice,
      techSupportEmail = 'fernando.rg@live.cl'
    } = body

    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY')
    }

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
      }).format(price);
    };

    const isBudget = type === 'budget'
    const subject = isBudget
      ? `Presupuesto Servicio Técnico - Ticket #${shortId}`
      : `Confirmación de Reserva - ${serviceName} #${shortId}`

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${isBudget ? 'Presupuesto Técnico' : 'Confirmación de Reserva'}</title>
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
                ${isBudget ? '📋' : '✓'}
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
                ${isBudget ? 'Presupuesto Listo' : 'Reserva Confirmada'}
              </h1>
              <p style="margin:10px 0 0;color:#94a3b8;font-size:15px;line-height:1.5;">
                Hola <strong style="color:#e2e8f0;">${customerName}</strong>, 
                ${isBudget ? 'tu presupuesto está listo para ser revisado. A continuación el detalle de la evaluación.' : 'tu cita está agendada.'}
              </p>
            </td>
          </tr>

          <!-- ID Badge -->
          <tr>
            <td style="background-color:#1e293b;padding:16px 48px;text-align:center;">
              <span style="display:inline-block;background-color:#0f172a;border:1px solid #334155;border-radius:6px;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:6px 14px;">
                ${isBudget ? 'Ticket ID' : 'Código de reserva'}
              </span>
              &nbsp;
              <span style="display:inline-block;background-color:#2563eb;border-radius:6px;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.12em;font-family:monospace;padding:6px 16px;">${shortId}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 48px;border-radius:0 0 12px 12px;">

              <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">
                ${isBudget ? 'Detalle del Presupuesto' : 'Detalles de la cita'}
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${isBudget ? `
                  ${(findings || []).map((f: any) => `
                    <tr>
                      <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;">${f.description}</td>
                      <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${formatPrice(f.price)}</td>
                    </tr>
                  `).join('')}
                  <tr>
                    <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#3b82f6;font-size:14px;font-weight:600;">Abono Evaluación (Deducido)</td>
                    <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#3b82f6;font-size:14px;font-weight:600;text-align:right;">-${formatPrice(servicePrice || 0)}</td>
                  </tr>
                  <tr>
                    <td style="padding:24px 0;color:#0f172a;font-size:16px;font-weight:800;text-transform:uppercase;">Total Final a Pagar</td>
                    <td style="padding:24px 0;color:#2563eb;font-size:22px;font-weight:900;text-align:right;">${formatPrice(totalAmount)}</td>
                  </tr>
                ` : `
                  <tr>
                    <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;width:40%;">Servicio</td>
                    <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${serviceName}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;">Fecha</td>
                    <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${date}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;">Horario</td>
                    <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${time}</td>
                  </tr>
                `}
              </table>

              ${(isBudget ? description : notes) ? `
              <div style="margin-top:28px;background-color:#f8fafc;border-left:3px solid #2563eb;border-radius:0 8px 8px 0;padding:16px 20px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">
                  ${isBudget ? 'Descripción del Trabajo' : 'Notas'}
                </p>
                <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;font-style:italic;">
                  "${isBudget ? description : notes}"
                </p>
              </div>
              ` : ''}

              <div style="margin-top:32px;background-color:#eff6ff;border-radius:8px;padding:20px 24px;text-align:center;">
                <p style="margin:0;font-size:14px;color:#1d4ed8;line-height:1.6;">
                  ${isBudget ? '💡 &nbsp;Puedes aceptar o rechazar este presupuesto desde el panel de cliente o respondiendo este correo.' : '📅 &nbsp;Te recomendamos llegar <strong>5 minutos antes</strong>.'}
                </p>
              </div>

              <div style="border-top:1px solid #f1f5f9;margin:32px 0;"></div>

              <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;line-height:1.6;">
                ${isBudget ? '¿Tienes dudas? Estamos aquí para ayudarte.' : '¿Necesitas cancelar o reprogramar? Responde este correo.'}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.8;">
                © ${new Date().getFullYear()} BookingPro System<br/>
                ${isBudget ? 'Presupuesto válido por 15 días corridos.' : 'Este mensaje fue generado automáticamente.'}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: isBudget ? 'Servicio Técnico <no-reply@digital-solutions.work>' : 'Reservas <no-reply@digital-solutions.work>',
        to: [customerEmail],
        cc: [techSupportEmail],
        subject: subject,
        html: html,
      }),
    })

    const data = await res.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
