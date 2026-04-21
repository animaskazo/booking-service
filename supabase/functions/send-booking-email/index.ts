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
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #0f172a; padding: 32px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 24px;">¡Reserva Confirmada!</h1>
              <p style="opacity: 0.8; margin-top: 8px;">Hola ${customerName}, tu cita ha sido agendada con éxito.</p>
            </div>
            
            <div style="padding: 32px; background-color: white;">
              <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Detalles de la Cita</h2>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Servicio</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #0f172a;">${serviceName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Fecha</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #0f172a;">${date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Horario</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #0f172a;">${time}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Código de Orden</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #0f172a; font-family: monospace;">${shortId}</td>
                  </tr>
                </table>
              </div>

              ${notes ? `
              <div style="margin-bottom: 24px;">
                <h3 style="font-size: 12px; margin-bottom: 8px; color: #64748b; text-transform: uppercase;">Notas adicionales</h3>
                <p style="margin: 0; font-size: 14px; color: #334155; font-style: italic; border-left: 3px solid #e2e8f0; padding-left: 12px;">"${notes}"</p>
              </div>
              ` : ''}

              <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px;">
                <p style="font-size: 12px; color: #94a3b8; margin: 0;">Si necesitas cancelar o reprogramar, por favor contáctanos respondiendo a este correo.</p>
              </div>
            </div>
            
            <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b;">
              &copy; ${new Date().getFullYear()} Sistema de Reservas. Todos los derechos reservados.
            </div>
          </div>
        `,
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
