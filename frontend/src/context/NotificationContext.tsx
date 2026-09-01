import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ToastContainer, ToastItem, ToastType } from '../components/notifications/ToastContainer';
import { ConfirmModal, ConfirmOptions } from '../components/notifications/ConfirmModal';
import { FormPromptModal, PromptOptions } from '../components/notifications/FormPromptModal';
import { RichFeedbackModal, RichFeedbackOptions } from '../components/notifications/RichFeedbackModal';

interface NotificationContextType {
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
  };
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
  showRichFeedback: (options: RichFeedbackOptions) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const recentToastsRef = useRef<Map<string, number>>(new Map());

  // Confirm Modal state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions | null;
    resolver: ((val: boolean) => void) | null;
  }>({ isOpen: false, options: null, resolver: null });

  // Form Prompt Modal state
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    options: PromptOptions | null;
    resolver: ((val: string | null) => void) | null;
  }>({ isOpen: false, options: null, resolver: null });

  // Rich Feedback Modal state
  const [richFeedbackState, setRichFeedbackState] = useState<{
    isOpen: boolean;
    options: RichFeedbackOptions | null;
    resolver: (() => void) | null;
  }>({ isOpen: false, options: null, resolver: null });

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, title?: string, duration = 4000) => {
    if (!message) return;
    
    // Deduplication check (same type + message within 2 seconds)
    const dedupeKey = `${type}:${message}`;
    const now = Date.now();
    const lastSeen = recentToastsRef.current.get(dedupeKey);
    if (lastSeen && now - lastSeen < 2000) {
      return;
    }
    recentToastsRef.current.set(dedupeKey, now);

    const id = 'toast-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const newToast: ToastItem = { id, type, title, message, duration };

    setToasts((prev) => [...prev.slice(-4), newToast]);

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, [dismissToast]);

  const toastObj = {
    success: useCallback((msg: string, title?: string, duration?: number) => showToast('success', msg, title || 'Success', duration), [showToast]),
    error: useCallback((msg: string, title?: string, duration?: number) => showToast('error', msg, title || 'Error', duration), [showToast]),
    warning: useCallback((msg: string, title?: string, duration?: number) => showToast('warning', msg, title || 'Warning', duration), [showToast]),
    info: useCallback((msg: string, title?: string, duration?: number) => showToast('info', msg, title || 'Notice', duration), [showToast])
  };

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolver: resolve
      });
    });
  }, []);

  const handleConfirmAction = (result: boolean) => {
    if (confirmState.resolver) {
      confirmState.resolver(result);
    }
    setConfirmState({ isOpen: false, options: null, resolver: null });
  };

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({
        isOpen: true,
        options,
        resolver: resolve
      });
    });
  }, []);

  const handlePromptSubmit = (val: string) => {
    if (promptState.resolver) {
      promptState.resolver(val);
    }
    setPromptState({ isOpen: false, options: null, resolver: null });
  };

  const handlePromptCancel = () => {
    if (promptState.resolver) {
      promptState.resolver(null);
    }
    setPromptState({ isOpen: false, options: null, resolver: null });
  };

  const showRichFeedback = useCallback((options: RichFeedbackOptions): Promise<void> => {
    return new Promise((resolve) => {
      setRichFeedbackState({
        isOpen: true,
        options,
        resolver: resolve
      });
    });
  }, []);

  const handleRichFeedbackDone = () => {
    if (richFeedbackState.resolver) {
      richFeedbackState.resolver();
    }
    setRichFeedbackState({ isOpen: false, options: null, resolver: null });
  };

  return (
    <NotificationContext.Provider
      value={{
        toast: toastObj,
        showToast,
        confirm,
        prompt,
        showRichFeedback
      }}
    >
      {children}

      {/* GLOBAL RENDERERS */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        options={confirmState.options}
        onConfirm={() => handleConfirmAction(true)}
        onCancel={() => handleConfirmAction(false)}
      />

      <FormPromptModal
        isOpen={promptState.isOpen}
        options={promptState.options}
        onSubmit={handlePromptSubmit}
        onCancel={handlePromptCancel}
      />

      <RichFeedbackModal
        isOpen={richFeedbackState.isOpen}
        options={richFeedbackState.options}
        onDone={handleRichFeedbackDone}
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
