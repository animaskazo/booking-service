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
      <div className="relative z-10 bg-white w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Top accent bar */}
        <div className={`h-1 w-full ${
          config.type === 'error' ? 'bg-red-500' : 
          (config.type === 'confirm' && config.isDanger) ? 'bg-red-500' : 'bg-slate-900'
        }`} />

        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-4">
            <DialogIcon type={config.type} isDanger={config.isDanger} />
            <div className="flex-1 pt-1">
              <h2 className="font-bold text-slate-900 text-base leading-tight">{config.title}</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{config.message}</p>
            </div>
          </div>

          {/* Actions */}
          <div className={`flex gap-3 pt-2 ${config.type === 'confirm' ? 'flex-row-reverse' : ''}`}>
            {config.type === 'confirm' && (
              <Button
                onClick={handleConfirm}
                className={`flex-1 text-white ${config.isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}
              >
                {config.confirmLabel ?? 'ELIMINAR'}
              </Button>
            )}
            <Button
              variant={config.type === 'confirm' ? 'outline' : 'default'}
              onClick={config.type === 'confirm' ? handleCancel : handleConfirm}
              className={`${config.type === 'confirm' ? 'flex-1' : 'w-full'}`}
            >
              {config.type === 'confirm'
                ? (config.cancelLabel ?? 'CANCELAR')
                : 'ACEPTAR'}
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
