import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      customerName,
      customerEmail,
      serviceName,
      date,
      time,
      shortId,
      notes,
      techSupportEmail = 'fernando.rg@live.cl' // Email por defecto si no viene
    } = await req.json()

    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY')
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Reservas <no-reply@tu-dominio.com>', // Cambia esto por tu dominio verificado
        to: [customerEmail],
        cc: [techSupportEmail], // Copia al servicio técnico
        subject: `Confirmación de Reserva - ${serviceName} #${shortId}`,
        html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Confirmación de Reserva</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;border-radius:12px 12px 0 0;padding:40px 48px;text-align:center;">
              <div style="display:inline-block;background-color:rgba(255,255,255,0.1);border-radius:50%;width:52px;height:52px;line-height:52px;text-align:center;margin-bottom:20px;font-size:24px;">✓</div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Reserva Confirmada</h1>
              <p style="margin:10px 0 0;color:#94a3b8;font-size:15px;line-height:1.5;">Hola <strong style="color:#e2e8f0;">${customerName}</strong>, tu cita está agendada.</p>
            </td>
          </tr>

          <!-- Booking ID Badge -->
          <tr>
            <td style="background-color:#1e293b;padding:16px 48px;text-align:center;">
              <span style="display:inline-block;background-color:#0f172a;border:1px solid #334155;border-radius:6px;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:6px 14px;">Código de reserva</span>
              &nbsp;
              <span style="display:inline-block;background-color:#2563eb;border-radius:6px;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.12em;font-family:monospace;padding:6px 16px;">${shortId}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 48px;border-radius:0 0 12px 12px;">

              <!-- Section Title -->
              <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">Detalles de la cita</p>

              <!-- Detail rows -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
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
                <tr>
                  <td style="padding:14px 0;color:#64748b;font-size:14px;">Cliente</td>
                  <td style="padding:14px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${customerName}</td>
                </tr>
              </table>

              ${notes ? `
              <!-- Notes -->
              <div style="margin-top:28px;background-color:#f8fafc;border-left:3px solid #2563eb;border-radius:0 8px 8px 0;padding:16px 20px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">Notas</p>
                <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;font-style:italic;">"${notes}"</p>
              </div>
              ` : ''}

              <!-- Reminder box -->
              <div style="margin-top:32px;background-color:#eff6ff;border-radius:8px;padding:20px 24px;text-align:center;">
                <p style="margin:0;font-size:14px;color:#1d4ed8;line-height:1.6;">📅 &nbsp;Te recomendamos llegar <strong>5 minutos antes</strong>.<br/>Guarda este correo como comprobante.</p>
              </div>

              <!-- Divider -->
              <div style="border-top:1px solid #f1f5f9;margin:32px 0;"></div>

              <!-- Footer message -->
              <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;line-height:1.6;">¿Necesitas cancelar o reprogramar? Responde este correo y te ayudaremos.</p>

            </td>
          </tr>

          <!-- Legal Footer -->
          <tr>
            <td style="padding:24px 48px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.8;">
                © ${new Date().getFullYear()} Sistema de Reservas · Todos los derechos reservados<br/>
                Este mensaje fue generado automáticamente, por favor no respondas directamente.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`,
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
