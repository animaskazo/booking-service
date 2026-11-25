import { useMemo, useState } from 'react';
import { ArrowLeft, Bot, Send, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

type ChatMessage = { role: 'user' | 'assistant'; content: string; note?: string };
type Step = 'chat' | 'code' | 'phone';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const initialMessage: ChatMessage = {
  role: 'assistant',
  content: '¡Hola! Soy el asistente de Booking. Puedo ayudarte con el estado de tu ticket, presupuesto, reparación, pagos o agendamiento. ¿Qué necesitas consultar?',
};

const isPrivateQuery = (text: string) =>
  /ticket|presupuesto|reparaci|seguimiento|pago|reserva|estado/i.test(text);

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
    if (step === 'code') return 'Código de reserva';
    if (step === 'phone') return 'Teléfono usado al agendar';
    return 'Escribe tu consulta…';
  }, [step]);

  const addAssistant = (content: string, note?: string) =>
    setMessages((current) => [...current, { role: 'assistant', content, note }]);

  async function askAssistant(message: string, history: ChatMessage[] = messages, code = '', phoneNumber = '') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/booking-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        // Reservation credentials are sent separately and never enter Claude's chat history.
        body: JSON.stringify({
          message,
          history: history.filter((item) => item.role === 'user' || item.role === 'assistant').slice(-8),
          short_id: code,
          phone: phoneNumber,
        }),
      });
      const result = await response.json();
      if (result.needs_verification) {
        setPendingQuestion(message);
        setStep('code');
        addAssistant('Para proteger tu información, primero necesito verificar la reserva. ¿Cuál es el código de reserva?');
        return;
      }
      if (!response.ok || result.error) throw new Error(result.error || 'No pude conectar con Booking. Inténtalo nuevamente.');
      addAssistant(result.reply || 'No tengo una respuesta disponible para esa consulta.', result.verified ? 'Información consultada en Booking tras verificar la reserva.' : undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ocurrió un error al consultar Booking.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    if (!value || busy) return;
    setDraft('');

    if (step === 'code') {
      setReservationCode(value);
      setStep('phone');
      addAssistant('Gracias. Ahora ingresa el teléfono que usaste al agendar. Verificaremos ambos datos juntos.');
      return;
    }

    if (step === 'phone') {
      const safeHistory = messages.filter((message) => message.content !== reservationCode && message.content !== value);
      setPhone(value);
      setStep('chat');
      await askAssistant(pendingQuestion || 'Quiero consultar mi reserva.', safeHistory, reservationCode, value);
      setReservationCode('');
      setPhone('');
      setPendingQuestion('');
      return;
    }

    setMessages((current) => [...current, { role: 'user', content: value }]);
    if (isPrivateQuery(value) && (!reservationCode || !phone)) {
      setPendingQuestion(value);
      setStep('code');
      addAssistant('Para consultar información privada de una reserva necesito verificar primero el código de reserva y el teléfono asociado.');
      return;
    }
    await askAssistant(value, messages);
  }

  function choose(question: string) {
    if (busy) return;
    setMessages((current) => [...current, { role: 'user', content: question }]);
    if (isPrivateQuery(question)) {
      setPendingQuestion(question);
      setStep('code');
      addAssistant('Para consultar información privada de una reserva necesito verificar primero el código de reserva y el teléfono asociado.');
      return;
    }
    void askAssistant(question, messages);
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
            Antes de mostrar información de una reserva, verificamos el código y el teléfono asociado.
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
                  <p>{message.content}</p>
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
