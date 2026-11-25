import { ArrowLeft, CheckCheck, MoreVertical, Phone, Paperclip, Smile, Video } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function WhatsAppAssistantPreview() {
  return (
    <main className="min-h-screen bg-[#e9edef] px-3 py-5 text-slate-900 sm:grid sm:place-items-center sm:px-6">
      <div className="mx-auto w-full max-w-[430px]">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <span><strong>Simulación.</strong> Datos ficticios; no envía mensajes ni consulta tickets reales.</span>
          <Link to="/asistente" className="shrink-0 font-semibold underline">Volver</Link>
        </div>

        <section className="flex h-[min(780px,calc(100dvh-100px))] min-h-[560px] flex-col overflow-hidden rounded-2xl bg-[#efeae2] shadow-xl ring-1 ring-black/10">
          <header className="flex h-[68px] shrink-0 items-center gap-3 bg-[#075e54] px-4 text-white">
            <Link to="/asistente" aria-label="Volver al asistente" className="rounded-full p-1 hover:bg-white/10"><ArrowLeft size={20} /></Link>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/20 text-sm font-semibold">B</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium">Booking · Asistente</div>
              <div className="text-xs text-white/75">en línea</div>
            </div>
            <Video size={19} className="hidden sm:block" />
            <Phone size={18} />
            <MoreVertical size={20} />
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#efeae2] px-3 py-5 sm:px-5">
            <div className="mx-auto w-fit rounded-lg bg-[#fff4c7] px-3 py-1.5 text-[11px] leading-4 text-slate-600 shadow-sm">
              Vista previa de conversación · datos de ejemplo
            </div>
            <div className="ml-auto max-w-[86%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[14px] leading-[1.45] shadow-sm">
              Hola, quiero saber el estado de mi reparación. Mi orden es #000123.
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">12:41 <CheckCheck size={14} className="text-sky-600" /></div>
            </div>
            <div className="max-w-[94%] rounded-xl rounded-tl-sm bg-white px-3 py-3 text-[13px] leading-[1.5] shadow-sm">
              <p className="mb-3 font-semibold text-slate-900">Ticket de reparación · orden #000123</p>
              <div className="space-y-2.5">
                <Info label="Estado" value="En reparación" badge />
                <Info label="Equipo" value="Notebook de ejemplo" />
                <Info label="Problema informado" value="Falla de ejemplo para mostrar el formato del mensaje." />
                <Info label="Detalle registrado" value="Diagnóstico ficticio. En una consulta real se mostraría aquí únicamente la información registrada en el ticket." />
                <Info label="Presupuesto total" value="$45.000 · valor ficticio" />
                <Info label="Evaluación" value="Servicio de ejemplo — $45.000" />
              </div>
              <div className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400">Contenido simulado · Booking</div>
              <div className="mt-1 text-right text-[10px] text-slate-400">12:41</div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 bg-[#f0f2f5] px-3 py-3">
            <Smile size={22} className="shrink-0 text-slate-500" />
            <Paperclip size={20} className="shrink-0 rotate-[-35deg] text-slate-500" />
            <div className="flex-1 rounded-full bg-white px-4 py-2.5 text-sm text-slate-400">Escribe un mensaje</div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#075e54] text-white"><Phone size={17} /></div>
          </div>
        </section>
        <p className="mt-3 text-center text-xs text-slate-500">Previsualización visual de WhatsApp. Los controles son decorativos.</p>
      </div>
    </main>
  );
}

function Info({ label, value, badge = false }: { label: string; value: string; badge?: boolean }) {
  return (
    <section>
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      {badge
        ? <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">{value}</span>
        : <p className="whitespace-pre-line text-[13px] leading-[1.45] text-slate-800">{value}</p>}
    </section>
  );
}
