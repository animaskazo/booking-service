import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type DialogType = 'alert' | 'confirm' | 'error';

interface DialogConfig {
  type: DialogType;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface DialogContextValue {
  showAlert: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string, isDanger?: boolean) => void;
  showError: (title: string, message: string) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}

// ============================================================================
// ICON PER TYPE
// ============================================================================

function DialogIcon({ type, isDanger }: { type: DialogType, isDanger?: boolean }) {
  if (type === 'confirm') {
    if (isDanger) {
      return (
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
          <Trash2 className="w-5 h-5 text-red-500" />
        </div>
      );
    }
    return (
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 className="w-5 h-5 text-slate-600" />
      </div>
    );
  }
  if (type === 'error') {
    return (
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
        <AlertCircle className="w-5 h-5 text-red-500" />
      </div>
    );
  }
  return (
    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
      <CheckCircle2 className="w-5 h-5 text-blue-500" />
    </div>
  );
}

// ============================================================================
// MODAL COMPONENT
// ============================================================================

function DialogModal({ config, onClose }: { config: DialogConfig; onClose: () => void }) {
  const handleConfirm = () => {
    config.onConfirm?.();
    onClose();
  };

  const handleCancel = () => {
    config.onCancel?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={config.type === 'alert' || config.type === 'error' ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative z-10 bg-white w-full max-w-sm rounded-[32px] shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
        
        <div className="p-8 space-y-6 flex flex-col items-center text-center">
          {/* Icon */}
          <div className="transform scale-110">
            <DialogIcon type={config.type} isDanger={config.isDanger} />
          </div>

          {/* Header */}
          <div className="space-y-2">
            <h2 className="font-black text-slate-900 text-lg tracking-tight leading-snug">
              {config.title}
            </h2>
            <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-[280px]">
              {config.message}
            </p>
          </div>

          {/* Actions */}
          <div className={`flex flex-col gap-2.5 w-full pt-2`}>
            {config.type === 'confirm' && (
              <Button
                onClick={handleConfirm}
                className={`w-full text-white font-bold h-11 rounded-2xl shadow-sm border-none ${
                  config.isDanger 
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-200' 
                    : 'bg-slate-900 hover:bg-slate-800 shadow-slate-200'
                }`}
              >
                {config.confirmLabel ?? 'Eliminar'}
              </Button>
            )}
            <Button
              variant={config.type === 'confirm' ? 'outline' : 'default'}
              onClick={config.type === 'confirm' ? handleCancel : handleConfirm}
              className={`w-full font-bold h-11 rounded-2xl border-none ${
                config.type === 'confirm' 
                  ? 'bg-slate-50 text-slate-600 hover:bg-slate-100' 
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-900/10'
              }`}
            >
              {config.type === 'confirm'
                ? (config.cancelLabel ?? 'Cancelar')
                : 'Aceptar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROVIDER
// ============================================================================

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogConfig | null>(null);

  const closeDialog = useCallback(() => setDialog(null), []);

  const showAlert = useCallback((title: string, message: string) => {
    setDialog({ type: 'alert', title, message });
  }, []);

  const showError = useCallback((title: string, message: string) => {
    setDialog({ type: 'error', title, message });
  }, []);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
    isDanger: boolean = true
  ) => {
    setDialog({ type: 'confirm', title, message, onConfirm, confirmLabel, isDanger });
  }, []);

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showError }}>
      {children}
      {dialog && <DialogModal config={dialog} onClose={closeDialog} />}
    </DialogContext.Provider>
  );
}
