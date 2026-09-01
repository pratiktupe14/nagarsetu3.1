import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col space-y-3 max-w-sm w-full px-4 sm:px-0 pointer-events-none font-sans"
    >
      {toasts.map((toast) => {
        let bgClass = 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100';
        let icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />;
        let titleClass = 'text-emerald-300';

        if (toast.type === 'error') {
          bgClass = 'bg-rose-950/90 border-rose-500/40 text-rose-100';
          icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />;
          titleClass = 'text-rose-300';
        } else if (toast.type === 'warning') {
          bgClass = 'bg-amber-950/90 border-amber-500/40 text-amber-100';
          icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />;
          titleClass = 'text-amber-300';
        } else if (toast.type === 'info') {
          bgClass = 'bg-blue-950/90 border-blue-500/40 text-blue-100';
          icon = <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />;
          titleClass = 'text-blue-300';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border backdrop-blur-md shadow-xl flex items-start space-x-3 transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-bottom-5 ${bgClass}`}
          >
            {icon}
            <div className="flex-1 min-w-0 pr-2">
              {toast.title && (
                <h4 className={`text-xs font-extrabold uppercase tracking-wider mb-0.5 font-outfit ${titleClass}`}>
                  {toast.title}
                </h4>
              )}
              <p className="text-xs font-semibold leading-relaxed break-words">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center shrink-0"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
