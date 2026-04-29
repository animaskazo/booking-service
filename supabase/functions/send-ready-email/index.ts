import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ticket_id } = await req.json();
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: 'Missing ticket_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY');
    }

    // Obtener información completa del ticket
    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select(`
        id,
        status,
        description,
        total_budget,
        appointment: appointments(customer_name, customer_email, short_id, customer_phone),
        findings: ticket_findings(id, description, price),
        history: ticket_history(id, description, created_at)
      `)
      .eq('id', ticket_id)
      .single();

    if (ticketErr || !ticket) {
      console.error('Error fetching ticket for ready-email:', ticketErr);
      return new Response(JSON.stringify({ error: 'Ticket not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appointment = ticket.appointment as any;
    if (!appointment || !appointment.customer_email) {
      return new Response(JSON.stringify({ error: 'Customer email not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
      }).format(price);
    };

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    };

    const findingsHtml = ticket.findings && ticket.findings.length > 0
      ? ticket.findings.map((f: any) => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding:12px 0;font-size:14px;color:#334155;">${f.description}</td>
            <td style="padding:12px 0;font-size:14px;color:#1e293b;font-weight:600;text-align:right;">${formatPrice(f.price)}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="2" style="padding:12px 0;font-size:14px;color:#64748b;text-align:center;">Sin ítems adicionales.</td></tr>`;

    const historyHtml = ticket.history && ticket.history.length > 0
      ? ticket.history.map((h: any) => `
          <div style="border-left:2px solid #2563eb;padding-left:12px;margin-bottom:16px;">
            <span style="font-size:11px;color:#94a3b8;font-weight:600;">${formatDate(h.created_at)}</span>
            <p style="margin:4px 0 0;font-size:14px;color:#334155;">${h.description}</p>
          </div>
        `).join('')
      : `<p style="font-size:14px;color:#64748b;text-align:center;margin:0;">Sin registros históricos disponibles.</p>`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Equipo Listo para Retiro</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#10b981;border-radius:12px 12px 0 0;padding:40px 48px;text-align:center;">
              <div style="display:inline-block;background-color:rgba(255,255,255,0.2);border-radius:50%;width:52px;height:52px;line-height:52px;text-align:center;margin-bottom:20px;font-size:24px;">
                🎉
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
                ¡Tu equipo está listo!
              </h1>
              <p style="margin:10px 0 0;color:#e1f5fe;font-size:15px;line-height:1.5;">
                Hola <strong>${appointment.customer_name}</strong>,<br>
                La reparación ha concluido satisfactoriamente y tu equipo está listo para ser retirado.
              </p>
            </td>
          </tr>

          <!-- ID Badge -->
          <tr>
            <td style="background-color:#0f172a;padding:16px 48px;text-align:center;">
              <span style="display:inline-block;background-color:#1e293b;border:1px solid #334155;border-radius:6px;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:6px 14px;">
                CÓDIGO DE RESERVA
              </span>
              &nbsp;
              <span style="display:inline-block;background-color:#10b981;border-radius:6px;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.12em;font-family:monospace;padding:6px 16px;">${appointment.short_id}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 48px;border-radius:0 0 12px 12px;">

              <!-- Trabajo realizado -->
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">
                Detalle del trabajo realizado
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:30px;">
                ${findingsHtml}
                <tr>
                  <td style="padding:16px 0 0;font-size:15px;font-weight:700;color:#0f172a;">Total presupuestado</td>
                  <td style="padding:16px 0 0;font-size:18px;font-weight:800;color:#10b981;text-align:right;">${formatPrice(ticket.total_budget)}</td>
                </tr>
              </table>

              <!-- Evidencias / Historial -->
              <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">
                Evidencias e historial del servicio
              </p>
              <div style="margin-bottom:30px;background-color:#f8fafc;border-radius:8px;padding:20px;">
                ${historyHtml}
              </div>

              <!-- Retiro instructions -->
              <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#0f172a;">¿Dónde retirar?</p>
              <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">
                Te esperamos en nuestras instalaciones. Recuerda indicar tu código <strong>${appointment.short_id}</strong> al momento de retirar.
              </p>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

    // Enviar email vía Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Servicio Técnico <no-reply@digital-solutions.work>',
        to: [appointment.customer_email],
        subject: `¡Equipo listo para retiro! #${appointment.short_id}`,
        html: html,
      }),
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error('Error sending email via Resend:', errData);
      return new Response(JSON.stringify({ error: 'Error sending email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-ready-email error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
