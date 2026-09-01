import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, AlertCircle } from 'lucide-react';

export interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  inputType?: 'text' | 'textarea';
  required?: boolean;
  confirmText?: string;
  cancelText?: string;
  validate?: (val: string) => string | null;
}

interface FormPromptModalProps {
  isOpen: boolean;
  options: PromptOptions | null;
  onSubmit: (val: string) => void;
  onCancel: () => void;
}

export const FormPromptModal: React.FC<FormPromptModalProps> = ({
  isOpen,
  options,
  onSubmit,
  onCancel
}) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && options) {
      setValue(options.defaultValue || '');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, options]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || !options) return null;

  const {
    title,
    message,
    placeholder = 'Type here...',
    inputType = 'text',
    required = true,
    confirmText = 'Submit',
    cancelText = 'Cancel',
    validate
  } = options;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (required && !trimmed) {
      setError('This field cannot be empty.');
      return;
    }
    if (validate) {
      const err = validate(trimmed);
      if (err) {
        setError(err);
        return;
      }
    }
    onSubmit(trimmed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-dialog-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200 font-sans"
    >
      <div className="relative bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 transform transition-all animate-in zoom-in-95 duration-200">
        
        {/* CLOSE BUTTON */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* HEADER */}
        <div className="flex items-start space-x-3.5">
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="space-y-1 pr-6">
            <h3 id="prompt-dialog-title" className="text-lg font-extrabold text-gray-900 font-outfit">
              {title}
            </h3>
            {message && (
              <p className="text-xs text-gray-600 leading-relaxed">
                {message}
              </p>
            )}
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            {inputType === 'textarea' ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                rows={3}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                placeholder={placeholder}
                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-2xl text-xs text-gray-900 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white font-semibold"
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                placeholder={placeholder}
                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-2xl text-xs text-gray-900 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white font-semibold"
              />
            )}

            {error && (
              <div className="flex items-center space-x-1 mt-1.5 text-xs text-rose-600 font-bold">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
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
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm transition-all min-h-[44px]"
            >
              {confirmText}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
