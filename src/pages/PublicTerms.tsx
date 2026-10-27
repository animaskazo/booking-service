import { useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Loader2, Printer } from 'lucide-react';
import { usePublicBookingTerms } from '../lib/supabase-client';

export default function PublicTerms() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const { data: terms, isLoading, error } = usePublicBookingTerms(serviceId);

  const hasTerms = Boolean(terms?.terms_title?.trim() && terms?.terms_content?.trim());
  const updatedAt = terms?.terms_updated_at
    ? format(parseISO(terms.terms_updated_at), "d 'de' MMMM 'de' yyyy", { locale: es })
    : null;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-start">
          <img src="/powerfix-negro.png" alt="Powerfix" className="h-5 w-auto" />
        </div>

        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          <header className="no-print border-b border-slate-100 px-6 py-8 sm:px-10">
            <div className="mb-4 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                <FileText className="h-3.5 w-3.5" />
                Términos del servicio
              </div>
              {hasTerms && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  title="Imprimir términos y condiciones"
                  aria-label="Imprimir términos y condiciones"
                >
                  <Printer className="h-4 w-4" />
                </button>
              )}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {isLoading ? 'Cargando…' : terms?.terms_title || 'Términos y condiciones'}
            </h1>
            {updatedAt && (
              <p className="mt-2 text-xs font-medium text-slate-400">
                Última actualización: {updatedAt}
              </p>
            )}
          </header>

          <div id="booking-terms-print" className="px-6 py-10 sm:px-12">
            {isLoading ? (
              <div className="no-print flex items-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando términos y condiciones…
              </div>
            ) : error ? (
              <p role="alert" className="no-print rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                No se pudieron cargar los términos y condiciones. Intenta nuevamente o contacta al negocio.
              </p>
            ) : hasTerms ? (
              <>
                <div className="mb-8 flex items-center justify-between">
                  <img src="/powerfix-negro.png" alt="Powerfix" className="h-6 w-auto print:h-6" />
                  <p className="text-xs text-slate-500 print:text-black">
                    Fecha de impresión: {new Date().toLocaleDateString('es-CL')}
                  </p>
                </div>
                <h1 className="mb-6 text-center text-2xl font-black uppercase tracking-widest text-slate-900 print:block print:text-black">{terms!.terms_title}</h1>
                {terms!.terms_content.trim().startsWith('<') ? (
                  <div className="prose prose-slate max-w-none text-sm leading-7 sm:text-base print:text-black" dangerouslySetInnerHTML={{ __html: terms!.terms_content }} />
                ) : (
                  <div className="text-sm leading-7 text-slate-700 sm:text-base print:text-black">
                    {terms!.terms_content.split('\n').map((paragraph, index) => (
                      <p key={index} className={paragraph.trim() ? 'mb-4 whitespace-pre-wrap' : 'h-3'}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}
                <div className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-400 print:text-black">
                  PowerFix • www.powerfix.cl
                </div>
              </>
            ) : (
              <p className="no-print rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Los términos y condiciones aún no están configurados.
              </p>
            )}
          </div>

          <footer className="no-print border-t border-slate-100 bg-slate-50/60 px-6 py-5 sm:px-10" />
        </article>
      </div>
    </div>
  );
}
