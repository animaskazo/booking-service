// ============================================================================
// BookingReturn — Página de retorno tras pago en Flow
// ============================================================================
// Flow redirige aquí con ?token=XXX después de que el usuario paga.
// Esta página verifica el estado del pago y muestra el comprobante.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, CalendarIcon } from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type PaymentStatus = 'loading' | 'success' | 'failed' | 'pending' | 'error';

interface AppointmentData {
  shortId: string;
  serviceName: string;
  customerName: string;
  customerEmail: string;
  slotStart: string;
  slotEnd: string;
  paidAmount: number;
}

export default function BookingReturn() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No se encontró el token de pago.');
      return;
    }

    // Polling: esperar hasta 20 segundos a que confirm-flow-payment procese la notificación
    let attempts = 0;
    const maxAttempts = 10;

    const check = async () => {
      attempts++;
      try {
        // Consultar la reserva creada por confirm-flow-payment
        const { data } = await supabase
          .from('appointments')
          .select(`
            id,
            short_id,
            customer_name,
            customer_email,
            start_time,
            end_time,
            paid_amount,
            status,
            service:services(name)
          `)
          .eq('flow_token', token)
          .single();

        if (data && data.status === 'confirmed') {
          setAppointment({
            shortId: data.short_id,
            serviceName: (data.service as any)?.name ?? 'Servicio',
            customerName: data.customer_name,
            customerEmail: data.customer_email,
            slotStart: data.start_time,
            slotEnd: data.end_time,
            paidAmount: data.paid_amount ?? 0,
          });
          setStatus('success');
          return;
        }

        // Si aún no hay registro y no superamos los intentos, seguir esperando
        if (attempts < maxAttempts) {
          setTimeout(check, 2000);
        } else {
          // Timeout: puede que el webhook aún no llegó
          setStatus('pending');
        }
      } catch {
        if (attempts < maxAttempts) {
          setTimeout(check, 2000);
        } else {
          setStatus('error');
          setErrorMsg('No se pudo verificar el estado del pago. Guarda tu ID de transacción y contáctanos.');
        }
      }
    };

    // Dar 3 segundos de gracia para que Flow notifique al servidor
    setTimeout(check, 3000);
  }, [token]);

  const formatDateStr = (iso: string) =>
    format(parseISO(iso), "EEEE d 'de' MMMM, yyyy", { locale: es });

  const formatTimeStr = (iso: string) =>
    format(parseISO(iso), 'HH:mm', { locale: es });

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* LOADING */}
        {status === 'loading' && (
          <div className="text-center space-y-4 py-16">
            <Loader2 className="w-10 h-10 animate-spin text-slate-400 mx-auto" />
            <p className="text-slate-600 font-bold text-sm uppercase tracking-widest">Verificando pago...</p>
            <p className="text-slate-400 text-xs">Esto puede tomar unos segundos</p>
          </div>
        )}

        {/* SUCCESS */}
        {status === 'success' && appointment && (
          <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-xl">
            {/* Header */}
            <div className="text-center p-8 pb-6 border-b border-slate-100">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">¡Reserva Confirmada!</h1>
              <p className="text-slate-500 text-xs font-bold mt-1">
                Hola {appointment.customerName.split(' ')[0]}, tu pago fue procesado con éxito.
              </p>
            </div>

            {/* Details */}
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-start border-b pb-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Servicio</p>
                  <p className="text-xl font-bold text-slate-900">{appointment.serviceName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Pagado</p>
                  <p className="text-xl font-black text-slate-900">
                    ${appointment.paidAmount.toLocaleString('es-CL')} CLP
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-b pb-6 text-center">
                <div className="space-y-1 border-r border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha</p>
                  <p className="text-xs font-bold text-slate-900 capitalize">{formatDateStr(appointment.slotStart)}</p>
                </div>
                <div className="space-y-1 border-r border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horario</p>
                  <p className="text-xs font-bold text-slate-900">
                    {formatTimeStr(appointment.slotStart)} – {formatTimeStr(appointment.slotEnd)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID Reserva</p>
                  <p className="text-xs font-black text-slate-900 font-mono uppercase">{appointment.shortId}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                <p className="text-xs text-slate-600 font-medium">
                  Enviamos el comprobante a{' '}
                  <span className="font-bold text-slate-900">{appointment.customerEmail}</span>
                </p>
              </div>

              <a
                href="/"
                className="block w-full text-center bg-slate-900 hover:bg-slate-800 text-white h-10 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 leading-[40px]"
              >
                VOLVER AL INICIO
              </a>
            </div>
          </div>
        )}

        {/* PENDING — pago realizado pero notificación aún no procesada */}
        {status === 'pending' && (
          <div className="text-center space-y-5 border border-amber-200 rounded-3xl p-10">
            <CalendarIcon className="w-10 h-10 text-amber-500 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-lg font-black text-slate-900 uppercase">Pago en proceso</h2>
              <p className="text-slate-500 text-xs font-medium">
                Tu pago fue recibido. La confirmación puede tardar unos minutos más.
              </p>
              <p className="text-amber-600 text-xs font-bold pt-2">
                Revisa tu correo electrónico en unos minutos.
              </p>
            </div>
            <a
              href="/"
              className="block w-full text-center bg-slate-900 hover:bg-slate-800 text-white h-10 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 leading-[40px]"
            >
              VOLVER AL INICIO
            </a>
          </div>
        )}

        {/* FAILED / ERROR */}
        {(status === 'failed' || status === 'error') && (
          <div className="text-center space-y-5 border border-red-100 rounded-3xl p-10">
            <XCircle className="w-10 h-10 text-red-400 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-lg font-black text-slate-900 uppercase">Pago no completado</h2>
              <p className="text-slate-500 text-xs font-medium">
                {errorMsg || 'El pago fue rechazado o cancelado. No se realizó ningún cargo.'}
              </p>
            </div>
            <a
              href="/"
              className="block w-full text-center bg-slate-900 hover:bg-slate-800 text-white h-10 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 leading-[40px]"
            >
              INTENTAR NUEVAMENTE
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
