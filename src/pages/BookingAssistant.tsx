import { type FormEvent, useMemo, useState } from 'react';
import { ArrowLeft, Bot, Send, ShieldCheck, UserRound } from 'lucide-react';
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
      {title && <p className="font-semibold text-slate-900">{title}</p>}
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

  function choose(question: string) {
    if (busy) return;
    setMessages((current) => [...current, { role: 'user', content: question }]);
    if (isPrivateQuery(question)) {
      if (!reservationCode) {
        setPendingQuestion(question);
        setStep('code');
        addAssistant(isDemoCodeOnly() ? 'Claro, dime el número de orden y lo reviso.' : 'Para verificar tu reserva, dime primero el número de orden.');
        return;
      }
      if (!isDemoCodeOnly() && !phone) {
        setPendingQuestion(question);
        setStep('phone');
        addAssistant('Dime el teléfono usado al agendar para verificar la orden.');
        return;
      }
    }
    void askAssistant(question, messages, reservationCode, phone);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
          <ArrowLeft size={18} /> Volver a Booking
        </Link>
        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Asistente en línea
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-6xl gap-5 px-4 pb-8 sm:px-8 lg:grid-cols-[270px_1fr]">
        <aside className="hidden rounded-3xl bg-white p-6 shadow-sm lg:block">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white"><Bot size={22} /></div>
            <div><div className="font-semibold">Booking</div><div className="text-xs text-slate-500">Asistente de servicio</div></div>
          </div>
          <div className="mt-8 text-xs font-semibold uppercase tracking-wider text-slate-400">Te puedo ayudar con</div>
          <div className="mt-3 space-y-2">
            {[
              ['Estado de mi ticket', 'Quiero consultar el estado de mi ticket.'],
              ['Presupuesto y reparación', 'Quiero consultar el presupuesto y detalle de reparación.'],
              ['Agendar un servicio', 'Quiero agendar un servicio.'],
              ['Pagos', 'Quiero consultar un pago asociado a mi reserva.'],
            ].map(([label, question]) => (
              <button key={label} onClick={() => choose(question)} className="w-full rounded-xl px-3 py-3 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-950">{label}</button>
            ))}
          </div>
          <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            <div className="mb-1 flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck size={15} /> Privacidad primero</div>
{isDemoCodeOnly() ? 'Modo demo: consulta con el número de orden, escrito con o sin #.' : 'Para proteger tus datos, verificamos el número de orden y el teléfono asociado.'}
          </div>
        </aside>

        <section className="flex min-h-[72vh] flex-col overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-7">
            <div className="font-semibold">Asistente de Booking</div>
            <div className="mt-1 text-xs text-slate-500">Consultas de reservas, reparación y pagos</div>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-7">
            {messages.map((message, index) => (
              <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-950 text-white"><Bot size={18} /></div>}
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  <AssistantMessage content={message.content} />
                  {message.note && <p className="mt-2 text-xs text-slate-500">{message.note}</p>}
                </div>
                {message.role === 'user' && <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600"><UserRound size={18} /></div>}
              </div>
            ))}
            {busy && <div className="text-sm text-slate-500">Estoy consultando Booking…</div>}
          </div>

          {error && <div role="alert" className="mx-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:mx-7">{error}</div>}
          <form onSubmit={submit} className="border-t border-slate-100 p-4 sm:p-6">
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={placeholder}
                disabled={busy}
                autoComplete={step === 'phone' ? 'tel' : 'off'}
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                aria-label={placeholder}
              />
              <button type="submit" disabled={busy || !draft.trim()} aria-label="Enviar mensaje" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
                <Send size={18} />
              </button>
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck size={13} /> Tu código y teléfono se usan solo para verificar la reserva.</p>
          </form>
        </section>
      </section>
    </main>
  );
}
