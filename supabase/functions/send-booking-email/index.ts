import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number) {
  const words = text.replace(/\r\n/g, '\n').split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    if (word === '') continue
    const testLine = currentLine ? currentLine + ' ' + word : word
    const width = font.widthOfTextAtSize(testLine, fontSize)
    if (width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    lines.push(currentLine)
  }
  return lines
}

async function generateTermsPdf(termsTitle: string, termsContent: string) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const margin = 50
  const maxWidth = 595.28 - margin * 2
  let y = 791.89

  page.drawText(termsTitle || 'Términos y condiciones', {
    x: margin,
    y: y,
    size: 18,
    font: fontBold,
  })
  y = y - 28

  const content = termsContent || ''
  const paragraphs = content.replace(/\r\n/g, '\n').split('\n')

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i]
    if (paragraph.trim() === '') {
      y = y - 10
      continue
    }
    const lines = wrapText(paragraph, font, 11, maxWidth)
    for (let j = 0; j < lines.length; j++) {
      page.drawText(lines[j], {
        x: margin,
        y: y,
        size: 11,
        font: font,
        color: { type: 'RGB', red: 0.1, green: 0.1, blue: 0.15 },
      })
      y = y - 16
    }
    y = y - 8
  }

  const pdfBytes = await pdfDoc.save()
  let binary = ''
  const bytes = new Uint8Array(pdfBytes)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const {
      type = 'booking',
      customerName,
      customerEmail,
      customerPhone,
      serviceName,
      date,
      time,
      shortId,
      notes,
      totalAmount,
      description,
      findings,
      servicePrice,
      techSupportEmail: reqTechSupportEmail
    } = body

    let techSupportEmail = reqTechSupportEmail || 'contacto@powerfix.cl'

    let appointmentUserId = null
    let termsTitle = null
    let termsContent = null

    if (shortId) {
      try {
        const { data: appointment } = await supabase
          .from('appointments')
          .select('user_id, terms_title_snapshot, terms_content_snapshot')
          .eq('short_id', shortId)
          .maybeSingle();

        if (appointment && appointment.user_id) {
          appointmentUserId = appointment.user_id
        }
        if (appointment && appointment.terms_title_snapshot && appointment.terms_title_snapshot.trim()) {
          termsTitle = appointment.terms_title_snapshot
        }
        if (appointment && appointment.terms_content_snapshot && appointment.terms_content_snapshot.trim()) {
          termsContent = appointment.terms_content_snapshot
        }

        if (appointmentUserId) {
          const { data: settings } = await supabase
            .from('business_settings')
            .select('notification_email, terms_title, terms_content')
            .eq('user_id', appointmentUserId)
            .maybeSingle();
          if (!reqTechSupportEmail && settings && settings.notification_email) {
            techSupportEmail = settings.notification_email;
          }
          if (!termsTitle && settings && settings.terms_title && settings.terms_title.trim()) {
            termsTitle = settings.terms_title
          }
          if (!termsContent && settings && settings.terms_content && settings.terms_content.trim()) {
            termsContent = settings.terms_content
          }
        }
      } catch (dbErr) {
        console.error('Error fetching business settings:', dbErr)
      }
    }

    if ((!termsTitle || !termsContent)) {
      try {
        const { data: settings } = await supabase
          .from('business_settings')
          .select('notification_email, terms_title, terms_content')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!reqTechSupportEmail && settings && settings.notification_email && !techSupportEmail) {
          techSupportEmail = settings.notification_email
        }
        if (!termsTitle && settings && settings.terms_title && settings.terms_title.trim()) {
          termsTitle = settings.terms_title
        }
        if (!termsContent && settings && settings.terms_content && settings.terms_content.trim()) {
          termsContent = settings.terms_content
        }
      } catch (dbErr) {
        console.error('Error fetching fallback business settings:', dbErr)
      }
    }

    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY')
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://booking.digital-solutions.work'

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
      }).format(price)
    }

    const isBudget = type === 'budget'
    const isTest = type === 'test'
    const isBookingEmailType = type === 'booking' && !isBudget && !isTest

    let subject = ''
    if (isTest) {
      subject = 'Prueba de Correo - Sistema de Reservas PowerFix'
    } else if (isBudget) {
      subject = 'Presupuesto Técnico para ' + customerName + ' - Ticket #' + shortId
    } else {
      subject = 'Confirmación de Reserva: ' + serviceName + ' para ' + customerName + ' (#' + shortId + ')'
    }

    const activePhone = customerPhone || body.customer_phone || ''
    const trackUrl = activePhone
      ? appUrl + '/track?code=' + shortId + '&phone=' + encodeURIComponent(activePhone)
      : appUrl + '/track'

    let termsLink = appUrl + '/'
    if (shortId) {
      try {
        const { data: appointment } = await supabase
          .from('appointments')
          .select('service_id, user_id')
          .eq('short_id', shortId)
          .maybeSingle()

        if (appointment?.service_id) {
          termsLink = appUrl + '/terminos/' + appointment.service_id
        } else if (appointment?.user_id) {
          const { data: svc } = await supabase
            .from('services')
            .select('id')
            .eq('user_id', appointment.user_id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          if (svc?.id) {
            termsLink = appUrl + '/terminos/' + svc.id
          }
        } else {
          const { data: svc } = await supabase
            .from('services')
            .select('id')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          if (svc?.id) {
            termsLink = appUrl + '/terminos/' + svc.id
          }
        }
      } catch (_) {}
    } else {
      try {
        const { data: svc } = await supabase
          .from('services')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (svc?.id) {
          termsLink = appUrl + '/terminos/' + svc.id
        }
      } catch (_) {}
    }

    const html = isBookingEmailType && termsTitle
      ? '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head><body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;"><tr><td style="background-color:#0f172a;border-radius:12px 12px 0 0;padding:40px 48px;text-align:center;"><div style="display:inline-block;background-color:rgba(255,255,255,0.1);border-radius:50%;width:52px;height:52px;line-height:52px;text-align:center;margin-bottom:20px;font-size:24px;">✓</div><h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Reserva Confirmada</h1><p style="margin:10px 0 0;color:#94a3b8;font-size:15px;line-height:1.5;">Hola <strong style="color:#e2e8f0;">' + customerName + '</strong>, tu cita está agendada.</p></td></tr><tr><td style="background-color:#1e293b;padding:16px 48px;text-align:center;"><span style="display:inline-block;background-color:#0f172a;border:1px solid #334155;border-radius:6px;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:6px 14px;">Código de reserva</span>&nbsp;<span style="display:inline-block;background-color:#2563eb;border-radius:6px;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.12em;font-family:monospace;padding:6px 16px;">' + shortId + '</span></td></tr><tr><td style="background-color:#ffffff;padding:40px 48px;border-radius:0 0 12px 12px;"><p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">Detalles de la cita</p><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;width:40%;">Servicio</td><td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">' + serviceName + '</td></tr><tr><td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;">Fecha</td><td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">' + date + '</td></tr><tr><td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;">Horario</td><td style="padding:14px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">' + time + '</td></tr></table>' + (notes ? '<div style="margin-top:28px;background-color:#f8fafc;border-left:3px solid #2563eb;border-radius:0 8px 8px 0;padding:16px 20px;"><p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">Notas</p><p style="margin:0;font-size:14px;color:#334155;line-height:1.6;font-style:italic;">"' + notes + '"</p></div>' : '') + '            <div style="margin-top:28px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;"><p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">Términos y condiciones</p><p style="margin:0 0 10px;font-size:13px;color:#475569;line-height:1.6;">Puedes revisar los términos y condiciones en el siguiente enlace:</p><a href="' + termsLink + '" target="_blank" style="display:inline-block;color:#2563eb;font-size:13px;font-weight:700;text-decoration:none;">Ver términos y condiciones</a></div><div style="margin-top:28px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;text-align:center;"><p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">Dónde te esperamos</p><p style="margin:0 0 10px;font-size:14px;color:#0f172a;font-weight:600;line-height:1.5;">Avenida Francisco Bilbao 4620 • Las Condes • Santiago</p><a href="https://www.google.com/maps/search/?api=1&query=Avenida+Francisco+Bilbao+4620+Las+Condes+Santiago" target="_blank" style="display:inline-block;color:#2563eb;font-size:13px;font-weight:700;text-decoration:none;border:1px solid #bfdbfe;border-radius:8px;padding:8px 18px;">Ver en el mapa</a></div><div style="margin-top:32px;background-color:#f8fafc;border:1px dashed #e2e8f0;border-radius:8px;padding:16px 20px;text-align:center;"><p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">📅 &nbsp;Te recomendamos llegar <strong>5 minutos antes</strong>.</p></div><div style="border-top:1px solid #f1f5f9;margin:32px 0;"></div><p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;line-height:1.6;">¿Tienes dudas? Estamos aquí para ayudarte respondiendo este correo.</p></td></tr><tr><td style="padding:24px 48px;text-align:center;"><p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.8;">© ' + new Date().getFullYear() + ' PowerFix System<br/>Este mensaje fue generado automáticamente.</p></td></tr></table></td></tr></table></body></html>'
      : '<html><body>Reserva</body></html>'

    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'no-reply@digital-solutions.work'
    const fromAddress = resendFromEmail.includes('<')
      ? resendFromEmail
      : isBudget
        ? 'Servicio Técnico <' + resendFromEmail + '>'
        : 'Reservas <' + resendFromEmail + '>'

    let attachments: any[] = []

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [customerEmail],
        bcc: type === 'test' ? [] : [techSupportEmail],
        reply_to: [techSupportEmail],
        subject: subject,
        html: html,
        attachments: attachments.length > 0 ? attachments : undefined,
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
