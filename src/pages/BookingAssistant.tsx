import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, Clock3, ExternalLink, Loader2, MoreVertical, Paperclip, Phone, Send, ShieldCheck, Smile, Video, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { addDays, startOfDay } from 'date-fns';
import {
  calculateAvailableSlots,
  formatDateForDisplay,
  formatRut,
  formatTimeRange,
  prepareAppointmentData,
  validateAppointment,
  type ServiceWithAvailability,
} from '../lib/utils-booking';
import {
  checkSlotAvailability,
  sendBookingEmail,
  useAvailability,
  useBusinessSettings,
  useCreateAppointment,
  usePublicBookingTerms,
  useServices,
  supabase,
} from '../lib/supabase-client';

type ChatMessage = { role: 'user' | 'assistant'; content: string; note?: string; sensitive?: boolean };
type Step = 'chat' | 'code' | 'phone' | 'email';

const initialMessage: ChatMessage = {
  role: 'assistant',
  content: '¡Hola! Soy el asistente de Booking. Puedo ayudarte con el estado de tu ticket, presupuesto, reparación, pagos o agendamiento. ¿Qué necesitas consultar?',
};

const isPrivateQuery = (text: string) =>
  /ticket|presupuesto|reparaci|seguimiento|pago|reserva|estado/i.test(text);

const DEMO_CODE_ONLY_UNTIL = Date.parse('2026-11-26T23:59:59-03:00');
const isDemoCodeOnly = () => Date.now() <= DEMO_CODE_ONLY_UNTIL;
const normalizeOrderCode = (raw: string) => {
  const digits = raw.trim().replace(/\D/g, '');
  return digits.length > 0 && digits.length <= 6 ? digits.padStart(6, '0') : '';
};
const extractInlineOrderCode = (raw: string) => {
  const byHash = raw.match(/#\s*(\d{1,6})\b/)?.[1];
  const byContext = raw.match(/\b(?:orden|reserva|ticket|c[oó]digo)\b.{0,16}?\b(\d{1,6})\b/i)?.[1];
  const exact = raw.match(/^\s*(\d{1,6})\s*$/)?.[1];
  const code = byHash ?? byContext ?? exact;
  return code ? normalizeOrderCode(code) : '';
};

function AssistantMessage({ content }: { content: string }) {
  const normalized = content.replace(/\\n/g, '\n').replace(/\r\n?/g, '\n').replace(/\*\*/g, '').trim();
  const lines = normalized.split('\n');
  const title = lines.shift()?.trim() ?? '';
  const sectionLabels = new Set([
    'Estado', 'Equipo', 'Problema informado', 'Detalle registrado', 'Detalle de reparación',
    'Resultado de la revisión', 'Presupuesto total', 'Evaluación', 'Pagos asociados',
    'Seguimiento', 'Servicio', 'Fecha de atención', 'Fecha y hora', 'Código de reserva', 'Pago',
  ]);
  const sections: { label: string; items: string[] }[] = [];
  let current: { label: string; items: string[] } | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const label = line.endsWith(':') ? line.slice(0, -1).trim() : '';
    if (label && sectionLabels.has(label)) {
      if (current && current.items.length === 0) {
        current.label = current.label + ' · ' + label;
      } else {
        current = { label, items: [] };
        sections.push(current);
      }
      continue;
    }
    if (!line) {
      if (current && current.items.length && current.items[current.items.length - 1] !== '') current.items.push('');
      continue;
    }
    if (current) current.items.push(line);
  }

  return (
    <div className="space-y-3">
      {sections.length === 0 ? <p className="whitespace-pre-wrap text-sm leading-5 text-slate-800">{normalized}</p> : title && <p className="font-semibold text-slate-900">{title}</p>}
      {sections.map((section, index) => (
        <section key={section.label + '-' + index} className="rounded-xl border border-slate-200 bg-white/80 p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{section.label}</p>
          <div className="space-y-1.5">
            {section.items.filter(Boolean).map((item, itemIndex) => {
              const bullet = item.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
              return bullet ? (
                <div key={itemIndex} className="flex gap-2 text-sm leading-5 text-slate-700">
                  <span aria-hidden="true" className="text-slate-400">•</span>
                  <p>{bullet[1]}</p>
                </div>
              ) : (
                <p key={itemIndex} className={section.label === 'Estado' ? 'inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-800' : 'whitespace-pre-line text-sm leading-5 text-slate-700'}>{item}</p>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

type FlowStep = 'service' | 'time' | 'details' | 'confirm';
type BookingFlowProps = { onClose: () => void; onBooked: (message: string) => void };

function BookingFlowSimulation({ onClose, onBooked }: BookingFlowProps) {
  const [flowStep, setFlowStep] = useState<FlowStep>('service');
  const [selectedService, setSelectedService] = useState<ServiceWithAvailability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerRut, setCustomerRut] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [flowError, setFlowError] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: services = [], isLoading: loadingServices } = useServices();
  const { data: availability = [], isLoading: loadingAvailability, error: availabilityError } = useAvailability(selectedService?.id ?? null);
  const { data: businessSettings = { has_lunch_break: false, lunch_start: '13:00', lunch_end: '14:00' } } = useBusinessSettings();
  const { data: terms, isLoading: loadingTerms } = usePublicBookingTerms(selectedService?.id);
  const createAppointment = useCreateAppointment();
  const { dateRangeStart, dateRangeEnd } = useMemo(() => {
    const start = startOfDay(new Date());
    return { dateRangeStart: start, dateRangeEnd: addDays(start, 30) };
  }, []);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState('');
  useEffect(() => {
    let active = true;
    setLoadingAppointments(true);
    supabase.from('appointments')
      .select('service_id,start_time,end_time,status')
      .gte('start_time', dateRangeStart.toISOString())
      .lte('start_time', dateRangeEnd.toISOString())
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setAppointmentsError('No se pudieron consultar las reservas existentes.');
        else setAppointments(data ?? []);
        setLoadingAppointments(false);
      });
    return () => { active = false; };
  }, [dateRangeStart, dateRangeEnd]);

  const freeServices = services.filter((service) => Number(service.price) === 0);
  const paidServices = services.filter((service) => Number(service.price) > 0);
  const nextSlots = useMemo(() => {
    if (!selectedService) return [];
    const candidates: { start: Date; end: Date }[] = [];
    const relevantAppointments = appointments.filter((appointment) => appointment.service_id === selectedService.id) as any;
    const lunchBreak = {
      enabled: Boolean((businessSettings as any)?.has_lunch_break),
      start: String((businessSettings as any)?.lunch_start ?? '13:00').slice(0, 5),
      end: String((businessSettings as any)?.lunch_end ?? '14:00').slice(0, 5),
    };
    for (let offset = 0; offset <= 30 && candidates.length < 3; offset += 1) {
      const date = startOfDay(addDays(new Date(), offset));
      const slots = calculateAvailableSlots(date, selectedService, availability, relevantAppointments, lunchBreak);
      for (const slot of slots) {
        candidates.push({ start: slot.start, end: slot.end });
        if (candidates.length === 3) break;
      }
    }
    return candidates;
  }, [selectedService, appointments, availability, businessSettings]);

  const chooseFreeService = (service: ServiceWithAvailability) => {
    setSelectedService(service);
    setSelectedSlot(null);
    setFlowError('');
    setFlowStep('time');
  };

  const continueToConfirmation = () => {
    if (!selectedSlot || !selectedService) return;
    const validation = validateAppointment(customerName, customerEmail, customerPhone, customerRut, selectedSlot.start, selectedSlot.end);
    if (!validation.valid) {
      setFlowError(validation.errors[0] || 'Revisa los datos ingresados.');
      return;
    }
    setFlowError('');
    setFlowStep('confirm');
  };

  const confirmBooking = async () => {
    if (!selectedService || Number(selectedService.price) !== 0 || !selectedSlot) return;
    if (!termsAccepted || !terms?.terms_title?.trim() || !terms?.terms_content?.trim()) {
      setFlowError(loadingTerms ? 'Cargando términos y condiciones…' : 'Debes aceptar los términos y condiciones para continuar.');
      return;
    }
    setSaving(true);
    setFlowError('');
    try {
      const availableNow = await checkSlotAvailability(selectedService.id, selectedSlot.start, selectedSlot.end);
      if (!availableNow) {
        setFlowError('Ese horario acaba de ocuparse. Vuelve atrás y elige otro disponible.');
        setFlowStep('time');
        return;
      }
      const appointmentData = prepareAppointmentData(
        selectedService.id,
        customerName,
        customerEmail,
        customerPhone,
        customerRut,
        selectedSlot.start,
        selectedSlot.end,
        'Agendado desde el asistente web',
        selectedService.user_id,
      );
      const result = await createAppointment.mutateAsync({
        ...appointmentData,
        status: 'confirmed',
        paid: true,
        paid_amount: 0,
        terms_accepted_at: new Date().toISOString(),
        terms_title_snapshot: terms.terms_title,
        terms_content_snapshot: terms.terms_content,
      } as any);
      if (!result?.short_id) throw new Error('Booking no devolvió el código de reserva.');
      await sendBookingEmail({
        customerName,
        customerEmail,
        serviceName: selectedService.name,
        date: formatDateForDisplay(selectedSlot.start),
        time: formatTimeRange(selectedSlot.start, selectedSlot.end),
        shortId: result.short_id,
        notes: 'Agendado desde el asistente web',
      });
      onBooked(`¡Listo! Tu hora quedó agendada.\\n\\nServicio: ${selectedService.name}\\nFecha: ${formatDateForDisplay(selectedSlot.start)}\\nHora: ${formatTimeRange(selectedSlot.start, selectedSlot.end)}\\nCódigo de reserva: #${result.short_id}\\n\\nTe enviaremos la confirmación al correo ingresado.`);
    } catch (cause) {
      setFlowError(cause instanceof Error ? cause.message : 'No se pudo crear la reserva. Inténtalo nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const stepNumber = { service: 1, time: 2, details: 3, confirm: 4 }[flowStep];
  const heading = {
    service: 'Elige un servicio',
    time: 'Selecciona un horario',
    details: 'Tus datos',
    confirm: 'Confirma tu reserva',
  }[flowStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Simulación de Flow para agendar">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-[#f7f8fa] shadow-2xl">
        <header className="flex items-center gap-3 bg-[#075e54] px-5 py-4 text-white">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white/15 font-semibold">B</div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Booking</p>
            <p className="text-xs text-white/75">Simulación web de WhatsApp Flow</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/15" aria-label="Cerrar Flow"><X size={20} /></button>
        </header>
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-[11px] font-medium text-slate-500">
            <span>PASO {stepNumber} DE 4</span><span>Agendamiento en chat</span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#128c7e] transition-all" style={{ width: `${stepNumber * 25}%` }} />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{heading}</h2>
          <p className="mt-1 text-sm text-slate-500">Completa estos pasos para reservar desde el chat.</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {flowStep === 'service' && (
            <>
              {loadingServices ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 size={17} className="animate-spin" />Cargando servicios…</div> : (
                <>
                  {freeServices.length > 0 && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Servicios gratuitos · puedes reservar aquí</p>}
                  {freeServices.map((service) => (
                    <button key={service.id} type="button" onClick={() => chooseFreeService(service)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#128c7e] hover:shadow-sm">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Check size={18} /></span>
                      <span className="min-w-0 flex-1"><span className="block font-medium text-slate-900">{service.name}</span><span className="mt-1 block text-xs text-slate-500">{service.description?.trim() || service.category || 'Servicio gratuito'}</span></span>
                      <span className="text-xs font-semibold text-emerald-700">Gratis</span>
                    </button>
                  ))}
                  {paidServices.length > 0 && <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Servicios pagados · continuar en la agenda</p>}
                  {paidServices.map((service) => (
                    <a key={service.id} href="/" target="_blank" rel="noreferrer" className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 hover:shadow-sm">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><ExternalLink size={17} /></span>
                      <span className="min-w-0 flex-1"><span className="block font-medium text-slate-900">{service.name}</span><span className="mt-1 block text-xs text-slate-500">Servicio pagado · continuar en agenda web</span></span>
                      <ExternalLink size={16} className="shrink-0 text-slate-400" />
                    </a>
                  ))}
                  {!freeServices.length && !paidServices.length && <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">No hay servicios publicados en Booking.</p>}
                </>
              )}
            </>
          )}
          {flowStep === 'time' && (
            <>
              <div className="rounded-2xl bg-white p-4">
                <p className="font-medium text-slate-900">{selectedService?.name}</p>
                <p className="mt-1 text-xs text-slate-500">{selectedService?.duration_min} min · Gratis</p>
              </div>
              {loadingAvailability || loadingAppointments ? <div className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 size={17} className="animate-spin" />Buscando horarios libres…</div> : availabilityError || appointmentsError ? <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">No pude verificar la disponibilidad. Inténtalo nuevamente o usa la agenda web.</p> : nextSlots.length ? nextSlots.map((slot, index) => (
                <button key={slot.start.toISOString()} type="button" onClick={() => { setSelectedSlot(slot); setFlowError(''); setFlowStep('details'); }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-[#128c7e]">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-800">{index + 1}</span>
                  <span className="flex-1"><span className="block font-medium capitalize text-slate-900">{formatDateForDisplay(slot.start)}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={13} />{formatTimeRange(slot.start, slot.end)}</span></span>
                </button>
              )) : <p className="rounded-2xl bg-white p-4 text-sm text-slate-600">{selectedService && !loadingAvailability && !loadingAppointments ? 'No encontré horarios disponibles en los próximos 30 días para este servicio.' : 'Cargando disponibilidad…'}</p>}
            </>
          )}
          {flowStep === 'details' && (
            <>
              <div className="rounded-2xl bg-white p-4"><p className="font-medium">{selectedService?.name}</p><p className="mt-1 text-sm capitalize text-slate-500">{selectedSlot && formatDateForDisplay(selectedSlot.start)} · {selectedSlot && formatTimeRange(selectedSlot.start, selectedSlot.end)}</p></div>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">Nombre completo<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#128c7e]" autoComplete="name" /></label>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">Correo electrónico<input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#128c7e]" type="email" autoComplete="email" /></label>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">Teléfono<input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#128c7e]" type="tel" autoComplete="tel" /></label>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">RUT<input value={customerRut} onChange={(event) => setCustomerRut(formatRut(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#128c7e]" inputMode="text" autoComplete="off" /></label>
            </>
          )}
          {flowStep === 'confirm' && (
            <>
              <div className="space-y-3 rounded-2xl bg-white p-4">
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Servicio</p><p className="mt-1 font-medium">{selectedService?.name}</p></div>
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fecha y hora</p><p className="mt-1 capitalize font-medium">{selectedSlot && formatDateForDisplay(selectedSlot.start)} · {selectedSlot && formatTimeRange(selectedSlot.start, selectedSlot.end)}</p></div>
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Datos de contacto</p><p className="mt-1 text-sm">{customerName}<br />{customerEmail}<br />{customerPhone}</p></div>
                <p className="border-t border-slate-100 pt-3 text-sm font-semibold text-emerald-700">Total: Gratis</p>
              </div>
              {loadingTerms ? <p className="text-sm text-slate-500">Cargando términos y condiciones…</p> : terms?.terms_title && (
                <div className="flex items-start gap-2 rounded-2xl bg-white p-4 text-sm">
                  <input id="booking-flow-terms" type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1 accent-[#128c7e]" />
                  <label htmlFor="booking-flow-terms" className="text-slate-700">Acepto los <a href={`/terminos/${selectedService?.id}`} target="_blank" rel="noreferrer" className="font-medium text-[#087e72] underline">{terms.terms_title}</a>.</label>
                </div>
              )}
              {!terms?.terms_title && !loadingTerms && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">No se pudieron cargar los términos. No puedo confirmar la reserva ahora.</p>}
            </>
          )}
          {flowError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{flowError}</div>}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <button type="button" onClick={() => { setFlowError(''); if (flowStep === 'time') setFlowStep('service'); else if (flowStep === 'details') setFlowStep('time'); else if (flowStep === 'confirm') setFlowStep('details'); else onClose(); }} className="rounded-full px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            {flowStep === 'service' ? 'Cancelar' : 'Atrás'}
          </button>
          {flowStep === 'details' && <button type="button" onClick={continueToConfirmation} className="rounded-full bg-[#075e54] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#064e46]">Revisar reserva</button>}
          {flowStep === 'confirm' && <button type="button" onClick={confirmBooking} disabled={saving || loadingTerms || !termsAccepted} className="flex items-center gap-2 rounded-full bg-[#075e54] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#064e46] disabled:opacity-50">{saving && <Loader2 size={15} className="animate-spin" />}{saving ? 'Agendando…' : 'Confirmar y agendar'}</button>}
        </footer>
      </div>
    </div>
  );
}

export default function BookingAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [step, setStep] = useState<Step>('chat');
  const [draft, setDraft] = useState('');
  const [reservationCode, setReservationCode] = useState('');
  const [phone, setPhone] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flowOpen, setFlowOpen] = useState(false);

  const placeholder = useMemo(() => {
    if (step === 'code') return 'Número de orden (ej. #000004)';
    if (step === 'phone') return 'Teléfono usado al agendar';
    if (step === 'email') return 'Correo electrónico usado al agendar';
    return 'Escribe tu consulta…';
  }, [step]);

  const addAssistant = (content: string, note?: string) =>
    setMessages((current) => [...current, { role: 'assistant', content, note }]);

  async function askAssistant(message: string, history: ChatMessage[] = messages, code = reservationCode, phoneNumber = phone, action?: string, email?: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/booking-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Booking identifiers and the lookup email stay outside Claude's chat history.
        body: JSON.stringify({
          message,
          history: history.filter((item) => !item.sensitive && (item.role === 'user' || item.role === 'assistant')).slice(-8),
          short_id: code,
          phone: phoneNumber,
          action,
          email,
        }),
      });
      const result = await response.json();
      if (result.needs_verification) {
        setPendingQuestion(message);
        setStep('code');
        addAssistant(isDemoCodeOnly() ? 'Claro. Dime el número de orden; puedes escribirlo con o sin #.' : 'Para verificar tu reserva, dime primero el número de orden.');
        return;
      }
      if (!response.ok || result.error) throw new Error(result.error || 'No pude conectar con Booking. Inténtalo nuevamente.');
      addAssistant(result.reply || 'No tengo una respuesta disponible para esa consulta.', result.verified ? 'Ticket validado en Booking; información obtenida de sus datos.' : result.appointment_lookup ? 'Información consultada en las reservas de Booking.' : undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ocurrió un error al consultar Booking.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    if (!value || busy) return;
    setDraft('');

    if (step === 'code') {
      const code = normalizeOrderCode(value);
      if (!code) {
        setError('No pude reconocer el número de orden. Prueba con #000004 o 000004.');
        setDraft(value);
        return;
      }
      const codeMessage: ChatMessage = { role: 'user', content: value, sensitive: true };
      const safeHistory = [...messages, codeMessage];
      setMessages(safeHistory);
      setReservationCode(code);
      if (isDemoCodeOnly()) {
        setStep('chat');
        await askAssistant(pendingQuestion || 'Quiero consultar mi orden.', safeHistory, code, '');
      } else {
        setStep('phone');
        addAssistant('Gracias. Ahora necesito el teléfono que usaste al agendar para verificar la orden.');
      }
      setPendingQuestion('');
      return;
    }

    if (step === 'phone') {
      setPhone(value);
      setStep('chat');
      await askAssistant(pendingQuestion || 'Quiero consultar mi reserva.', messages, reservationCode, value);
      setPendingQuestion('');
      return;
    }

    if (step === 'email') {
      const email = value.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Ese correo no parece válido. Revísalo e inténtalo nuevamente.');
        setDraft(value);
        return;
      }
      setStep('chat');
      await askAssistant('Buscar mis horas agendadas.', messages, '', '', 'lookup_appointment_by_email', email);
      setPendingQuestion('');
      return;
    }

    const inlineCode = isDemoCodeOnly() ? extractInlineOrderCode(value) : '';
    const effectiveCode = inlineCode || reservationCode;
    setMessages((current) => [...current, { role: 'user', content: value }]);
    if (inlineCode) setReservationCode(inlineCode);

    const wantsAppointmentLookup = /(?:ver|consultar|revisar|mostrar|buscar).{0,35}(?:hora|cita|agendamiento|reserva)|(?:mi|mis).{0,18}(?:hora|cita|agendamiento|reserva)|hora.{0,12}agendada|cita.{0,12}agendada/i.test(value);
    if (wantsAppointmentLookup && !/ticket|presupuesto|reparaci|seguimiento/i.test(value)) {
      setPendingQuestion(value);
      setStep('email');
      addAssistant('Claro. Dime el correo electrónico que usaste al agendar y buscaré tus próximas horas.');
      return;
    }

    const wantsBooking = /\b(?:agendar|agendamiento|reservar|hacer una reserva|pedir una hora|tomar una hora|cita nueva)\b/i.test(value);
    if (wantsBooking && !/\b(?:estado|seguimiento|ticket|presupuesto)\b/i.test(value)) {
      addAssistant('Te mostraré el flujo de reserva. En esta simulación podrás completar una reserva real de un servicio gratuito; los pagados se continúan en la agenda web.');
      setFlowOpen(true);
      return;
    }

    if (isPrivateQuery(value)) {
      if (!effectiveCode) {
        setPendingQuestion(value);
        setStep('code');
        addAssistant(isDemoCodeOnly() ? 'Claro, ¿cuál es el número de orden? Acepto formatos como #000004 o 000004.' : 'Para proteger tu información, necesito el número de orden.');
        return;
      }
      if (!isDemoCodeOnly() && !phone) {
        setPendingQuestion(value);
        setStep('phone');
        addAssistant('Ya tengo el número de orden. Ahora dime el teléfono usado al agendar.');
        return;
      }
    }

    await askAssistant(value, messages, effectiveCode, phone);
  }

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  return (
    <main className="min-h-dvh bg-[#d1d7db] text-slate-900 sm:px-5 sm:py-5">
      <section className="mx-auto flex h-dvh w-full max-w-5xl flex-col overflow-hidden bg-[#efeae2] shadow-xl sm:h-[calc(100dvh-2.5rem)] sm:rounded-2xl">
        <header className="flex h-[68px] shrink-0 items-center gap-3 bg-[#075e54] px-4 text-white">
          <Link to="/" aria-label="Volver a Booking" className="rounded-full p-1 transition hover:bg-white/10">
            <ArrowLeft size={20} />
          </Link>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-semibold">B</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium">Booking · Asistente</div>
            <div className="text-xs text-white/75">{busy ? 'escribiendo…' : 'en línea'}</div>
          </div>
          <Video size={19} className="hidden sm:block" aria-hidden="true" />
          <Phone size={18} className="hidden sm:block" aria-hidden="true" />
          <MoreVertical size={20} aria-hidden="true" />
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto bg-[#efeae2] px-3 py-5 sm:px-8 sm:py-7">
          <div className="mx-auto mb-4 w-fit rounded-lg bg-[#fff4c7] px-3 py-1.5 text-center text-[11px] leading-4 text-slate-600 shadow-sm">
            Conversación con el asistente de Booking
          </div>
          {messages.map((message, index) => (
            <div key={index} ref={index === messages.length - 1 ? chatEndRef : undefined} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <article className={message.role === 'user'
                ? 'max-w-[92%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2.5 text-[14px] leading-[1.45] shadow-sm sm:max-w-[82%] sm:px-4 sm:py-3'
                : 'max-w-[92%] rounded-xl rounded-tl-sm bg-white px-3 py-2.5 text-[14px] leading-[1.45] shadow-sm sm:max-w-[82%] sm:px-4 sm:py-3'}>
                <AssistantMessage content={message.content} />
                {message.note && <p className="mt-2 border-t border-slate-100 pt-2 text-xs leading-5 text-slate-500">{message.note}</p>}
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                  {message.role === 'user' ? 'ahora' : 'Booking'}
                  {message.role === 'user' && <CheckCheck size={14} className="text-sky-600" aria-label="Enviado" />}
                </div>
              </article>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-xl rounded-tl-sm bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                Estoy consultando Booking…
              </div>
            </div>
          )}
          {error && (
            <div role="alert" className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        {flowOpen && <BookingFlowSimulation onClose={() => setFlowOpen(false)} onBooked={(message) => { setFlowOpen(false); addAssistant(message, 'Reserva real registrada en Booking.'); }} />}

        <form onSubmit={submit} className="shrink-0 bg-[#f0f2f5] px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <Smile size={22} className="hidden shrink-0 text-slate-500 sm:block" aria-hidden="true" />
            <Paperclip size={20} className="hidden shrink-0 rotate-[-35deg] text-slate-500 sm:block" aria-hidden="true" />
            <input
              type={step === 'email' ? 'email' : 'text'}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError('');
              }}
              placeholder={placeholder}
              disabled={busy}
              autoComplete={step === 'phone' ? 'tel' : step === 'email' ? 'email' : 'off'}
              className="min-w-0 flex-1 rounded-full bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#128c7e]/30 disabled:opacity-60"
              aria-label={placeholder}
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Enviar mensaje"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#075e54] text-white transition hover:bg-[#064e46] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
            <ShieldCheck size={12} />
            {isDemoCodeOnly()
              ? step === 'email' ? 'El correo se usa para buscar tus próximas horas agendadas.' : 'Escribe tu consulta; para ver un ticket, el bot te pedirá el número de orden.'
              : step === 'email' ? 'El correo se usa para buscar tus próximas horas agendadas.' : 'Escribe tu consulta; para ver un ticket, el bot te pedirá el número de orden y el teléfono de reserva.'}
          </p>
        </form>
      </section>
    </main>
  );
}
