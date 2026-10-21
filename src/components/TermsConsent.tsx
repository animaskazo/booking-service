import { useId, useState } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';

interface TermsConsentProps {
  title?: string | null;
  content?: string | null;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  acceptanceLabel?: string;
  disabled?: boolean;
}

export default function TermsConsent({
  title,
  content,
  accepted,
  onAcceptedChange,
  acceptanceLabel = 'He leído y acepto',
  disabled = false,
}: TermsConsentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const checkboxId = useId();
  const hasTerms = Boolean(title?.trim() && content?.trim());

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        {hasTerms ? (
          <div className="flex items-start gap-3 text-sm text-slate-700">
            <input
              id={checkboxId}
              type="checkbox"
              checked={accepted}
              onChange={(event) => onAcceptedChange(event.target.checked)}
              disabled={disabled}
              required
              className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900"
            />
            <div>
              <label htmlFor={checkboxId} className="cursor-pointer">{acceptanceLabel}</label>{' '}
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-1 font-bold text-slate-900 underline underline-offset-2 hover:text-slate-600"
              >
                {title}
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm font-medium text-amber-800">
            Los términos y condiciones aún no están configurados. No es posible confirmar el agendamiento.
          </p>
        )}
      </div>

      {isOpen && hasTerms && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsOpen(false);
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-terms-title"
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-slate-900 p-2 text-white"><FileText className="h-4 w-4" /></span>
                <h2 id="booking-terms-title" className="text-lg font-bold text-slate-900">{title}</h2>
              </div>
              <button type="button" aria-label="Cerrar términos y condiciones" onClick={() => setIsOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="overflow-y-auto px-5 py-5 text-sm leading-6 text-slate-700">
              {content?.split('\n').map((paragraph, index) => (
                <p key={index} className={paragraph.trim() ? 'mb-3 whitespace-pre-wrap' : 'h-2'}>{paragraph}</p>
              ))}
            </div>
            <footer className="border-t border-slate-100 p-4 text-right">
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700">
                Cerrar
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
