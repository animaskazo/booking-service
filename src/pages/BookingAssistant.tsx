import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCheck, MoreVertical, Paperclip, Phone, Send, ShieldCheck, Smile, Video } from 'lucide-react';
import { Link } from 'react-router-dom';

type ChatMessage = { role: 'user' | 'assistant'; content: string; note?: string; sensitive?: boolean };
type Step = 'chat' | 'code' | 'phone';

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
    'Seguimiento', 'Servicio', 'Fecha de atención',
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

export default function BookingAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [step, setStep] = useState<Step>('chat');
  const [draft, setDraft] = useState('');
  const [reservationCode, setReservationCode] = useState('');
  const [phone, setPhone] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const placeholder = useMemo(() => {
    if (step === 'code') return 'Número de orden (ej. #000004)';
    if (step === 'phone') return 'Teléfono usado al agendar';
    return 'Escribe tu consulta…';
  }, [step]);

  const addAssistant = (content: string, note?: string) =>
    setMessages((current) => [...current, { role: 'assistant', content, note }]);

  async function askAssistant(message: string, history: ChatMessage[] = messages, code = reservationCode, phoneNumber = phone) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/booking-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Reservation credentials are sent separately and never enter Claude's chat history.
        body: JSON.stringify({
          message,
          history: history.filter((item) => !item.sensitive && (item.role === 'user' || item.role === 'assistant')).slice(-8),
          short_id: code,
          phone: phoneNumber,
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
      addAssistant(result.reply || 'No tengo una respuesta disponible para esa consulta.', result.verified ? 'Ticket validado en Booking; información obtenida de sus datos.' : undefined);
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

    const inlineCode = isDemoCodeOnly() ? extractInlineOrderCode(value) : '';
    const effectiveCode = inlineCode || reservationCode;
    setMessages((current) => [...current, { role: 'user', content: value }]);
    if (inlineCode) setReservationCode(inlineCode);

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

        <form onSubmit={submit} className="shrink-0 bg-[#f0f2f5] px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <Smile size={22} className="hidden shrink-0 text-slate-500 sm:block" aria-hidden="true" />
            <Paperclip size={20} className="hidden shrink-0 rotate-[-35deg] text-slate-500 sm:block" aria-hidden="true" />
            <input
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError('');
              }}
              placeholder={placeholder}
              disabled={busy}
              autoComplete={step === 'phone' ? 'tel' : 'off'}
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
              ? 'Escribe tu consulta; para ver un ticket, el bot te pedirá el número de orden.'
              : 'Escribe tu consulta; para ver un ticket, el bot te pedirá el número de orden y el teléfono de reserva.'}
          </p>
        </form>
      </section>
    </main>
  );
}
