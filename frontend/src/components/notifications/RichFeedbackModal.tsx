import React, { useEffect, useRef } from 'react';
import { CheckCircle2, ShieldCheck, X, FileText, UserCheck, Building2 } from 'lucide-react';

export interface RichFeedbackOptions {
  title: string;
  complaintNumber?: string;
  staffName?: string;
  staffId?: string;
  departmentName?: string;
  details?: string;
  badgeText?: string;
  actionText?: string;
}

interface RichFeedbackModalProps {
  isOpen: boolean;
  options: RichFeedbackOptions | null;
  onDone: () => void;
}

export const RichFeedbackModal: React.FC<RichFeedbackModalProps> = ({
  isOpen,
  options,
  onDone
}) => {
  const doneBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => doneBtnRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' || e.key === 'Enter') onDone();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onDone]);

  if (!isOpen || !options) return null;

  const {
    title,
    complaintNumber,
    staffName,
    staffId,
    departmentName,
    details,
    badgeText = 'Verified',
    actionText = 'Done'
  } = options;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rich-feedback-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200 font-sans"
    >
      <div className="relative bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 transform transition-all animate-in zoom-in-95 duration-200">
        
        {/* CLOSE BUTTON */}
        <button
          onClick={onDone}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* HEADER ICON & TITLE */}
        <div className="text-center space-y-2 pt-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 id="rich-feedback-title" className="text-xl font-extrabold text-gray-900 font-outfit">
            {title}
          </h3>
          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{badgeText}</span>
          </span>
        </div>

        {/* KEY VALUE DETAILS */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3 text-xs">
          {complaintNumber && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-semibold flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                <span>Complaint ID</span>
              </span>
              <span className="font-extrabold text-gray-900 font-mono">{complaintNumber}</span>
            </div>
          )}

          {staffName && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-semibold flex items-center space-x-1.5">
                <UserCheck className="w-3.5 h-3.5 text-gray-400" />
                <span>Assigned Staff</span>
              </span>
              <span className="font-bold text-gray-900">
                {staffName} {staffId ? `(${staffId})` : ''}
              </span>
            </div>
          )}

          {departmentName && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-semibold flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                <span>Department</span>
              </span>
              <span className="font-bold text-gray-900">{departmentName}</span>
            </div>
          )}

          {details && (
            <div className="pt-2 border-t border-gray-200 text-gray-700 leading-relaxed font-medium">
              {details}
            </div>
          )}
        </div>

        {/* ACTION BUTTON */}
        <button
          ref={doneBtnRef}
          type="button"
          onClick={onDone}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm transition-all min-h-[44px]"
        >
          {actionText}
        </button>

      </div>
    </div>
  );
};
