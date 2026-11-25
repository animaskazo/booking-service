import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCheck, MoreVertical, Phone, Paperclip, Smile, Video, Send, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';

type Message = { role: 'user' | 'assistant'; text: string; ticket?: boolean; id: number };
const ticketText = 'Ticket de reparación · orden #000123';
const initial: Message[] = [
  { role: 'user', text: 'Hola, quiero saber el estado de mi reparación. Mi orden es #000123.', id: 1 },
  { role: 'assistant', text: ticketText, ticket: true, id: 2 },
];
function reply(input: string) {
  const text = input.toLowerCase();
  if (/hola|buenos|buenas/.test(text)) return '¡Hola! Puedo mostrarte el estado, presupuesto o detalle de una reparación. Esta conversación usa datos ficticios.';
  if (/presupuesto|valor|cu[aá]nto|precio|pagar|costo/.test(text)) return 'En este ejemplo, el presupuesto total es $45.000. Es ficticio; una consulta real mostraría el valor registrado en tu ticket.';
  if (/estado|avance|listo|reparaci[oó]n|seguimiento/.test(text)) return 'El ticket de ejemplo #000123 aparece “En reparación”. Este estado es ficticio y solo sirve para probar la conversación.';
  if (/detalle|diagn[oó]stico|problema|evaluaci[oó]n|equipo/.test(text)) return 'El ticket corresponde a un notebook ficticio. En una consulta real, aquí verías el detalle y la evaluación registrados en tu ticket.';
  return 'Puedo ayudarte con el estado, presupuesto o detalle de reparación. Escribe una de esas consultas para probar. No consulto tickets reales.';
}
export default function WhatsAppAssistantPreview() {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState('');
  const [nextId, setNextId] = useState(3);
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, { role: 'user', text, id: nextId }, { role: 'assistant', text: reply(text), id: nextId + 1 }]);
    setNextId((id) => id + 2);
    setDraft('');
  }
  return <main className="min-h-screen bg-[#e9edef] px-3 py-5 text-slate-900 sm:grid sm:place-items-center sm:px-6">
    <div className="mx-auto w-full max-w-[430px]">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
        <span><strong>Simulación.</strong> Interactúa aquí; respuestas y datos ficticios, sin conexión a WhatsApp ni tickets reales.</span><Link to="/asistente" className="shrink-0 font-semibold underline">Volver</Link>
      </div>
      <section className="flex h-[min(780px,calc(100dvh-100px))] min-h-[560px] flex-col overflow-hidden rounded-2xl bg-[#efeae2] shadow-xl ring-1 ring-black/10">
        <header className="flex h-[68px] shrink-0 items-center gap-3 bg-[#075e54] px-4 text-white">
          <Link to="/asistente" aria-label="Volver" className="rounded-full p-1 hover:bg-white/10"><ArrowLeft size={20} /></Link><div className="grid h-10 w-10 place-items-center rounded-full bg-white/20 text-sm font-semibold">B</div>
          <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-medium">Booking · Asistente</div><div className="text-xs text-white/75">en línea · simulación</div></div><Video size={19} className="hidden sm:block" /><Phone size={18} /><MoreVertical size={20} />
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto bg-[#efeae2] px-3 py-5 sm:px-5">
          <div className="mx-auto w-fit rounded-lg bg-[#fff4c7] px-3 py-1.5 text-center text-[11px] text-slate-600 shadow-sm">Conversación interactiva · datos de ejemplo</div>
          {messages.map((m) => <div key={m.id} className={m.role === 'user' ? 'ml-auto max-w-[86%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[14px] leading-[1.45] shadow-sm' : 'max-w-[94%] rounded-xl rounded-tl-sm bg-white px-3 py-3 text-[13px] leading-[1.5] shadow-sm'}>
            {m.ticket ? <Ticket /> : <p className="whitespace-pre-wrap">{m.text}</p>}
            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">{m.ticket ? '12:41' : 'ahora'}{m.role === 'user' && <CheckCheck size={14} className="text-sky-600" />}</div>
          </div>)}
        </div>
        <form onSubmit={send} className="flex shrink-0 items-center gap-2 bg-[#f0f2f5] px-3 py-3">
          <Smile size={22} className="shrink-0 text-slate-500" /><Paperclip size={20} className="shrink-0 rotate-[-35deg] text-slate-500" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escribe un mensaje" aria-label="Escribe un mensaje" className="min-w-0 flex-1 rounded-full bg-white px-4 py-2.5 text-sm outline-none placeholder:text-slate-400" />
          <button type="submit" disabled={!draft.trim()} aria-label="Enviar mensaje" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#075e54] text-white disabled:opacity-50">{draft.trim() ? <Send size={17} /> : <Mic size={18} />}</button>
        </form>
      </section>
      <p className="mt-3 text-center text-xs text-slate-500">Prueba: “¿cuál es el presupuesto?” o “¿en qué estado está?”</p>
    </div>
  </main>;
}
function Ticket() { return <><p className="mb-3 font-semibold text-slate-900">{ticketText}</p><div className="space-y-2.5">
  <Info label="Estado" value="En reparación" badge /><Info label="Equipo" value="Notebook de ejemplo" /><Info label="Problema informado" value="Falla de ejemplo para mostrar el formato del mensaje." />
  <Info label="Detalle registrado" value="Diagnóstico ficticio. Una consulta real mostraría únicamente la información registrada en el ticket." /><Info label="Presupuesto total" value="$45.000 · valor ficticio" /><Info label="Evaluación" value="Servicio de ejemplo — $45.000" />
</div><div className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400">Contenido simulado · Booking</div></>; }
function Info({ label, value, badge = false }: { label: string; value: string; badge?: boolean }) { return <section><div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>{badge ? <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">{value}</span> : <p className="whitespace-pre-line text-[13px] leading-[1.45] text-slate-800">{value}</p>}</section>; }
