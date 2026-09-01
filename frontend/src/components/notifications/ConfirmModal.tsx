import React, { useEffect, useRef } from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'info' | 'warning' | 'danger';
}

interface ConfirmModalProps {
  isOpen: boolean;
  options: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  options,
  onConfirm,
  onCancel
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || !options) return null;

  const { title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'danger' } = options;

  let icon = <AlertTriangle className="w-6 h-6 text-amber-600" />;
  let iconBg = 'bg-amber-100 border-amber-200';
  let confirmBtnClass = 'bg-amber-600 hover:bg-amber-700 text-white';

  if (variant === 'danger') {
    icon = <AlertCircle className="w-6 h-6 text-rose-600" />;
    iconBg = 'bg-rose-100 border-rose-200';
    confirmBtnClass = 'bg-rose-600 hover:bg-rose-700 text-white';
  } else if (variant === 'info') {
    icon = <Info className="w-6 h-6 text-blue-600" />;
    iconBg = 'bg-blue-100 border-blue-200';
    confirmBtnClass = 'bg-blue-600 hover:bg-blue-700 text-white';
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200 font-sans"
    >
      <div className="relative bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-5 transform transition-all animate-in zoom-in-95 duration-200">
        
        {/* CLOSE BUTTON */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* HEADER */}
        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-2xl border shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <div className="space-y-1 pr-6">
            <h3 id="confirm-dialog-title" className="text-lg font-extrabold text-gray-900 font-outfit">
              {title}
            </h3>
            <p id="confirm-dialog-desc" className="text-xs text-gray-600 leading-relaxed break-words">
              {message}
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-extrabold text-xs uppercase tracking-wider transition-all min-h-[44px]"
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-sm transition-all min-h-[44px] ${confirmBtnClass}`}
          >
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
};
