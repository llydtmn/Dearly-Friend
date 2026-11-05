import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { X, AlertCircle, CheckCircle2, Mail } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  error: { icon: AlertCircle, accent: 'border-l-red-500', iconColor: 'text-red-400' },
  success: { icon: CheckCircle2, accent: 'border-l-green-500', iconColor: 'text-green-400' },
  info: { icon: Mail, accent: 'border-l-heart', iconColor: 'text-paper' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message, { type = 'info', duration = 4500 } = {}) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      show,
      dismiss,
      error: (msg, opts) => show(msg, { ...opts, type: 'error', duration: opts?.duration ?? 6000 }),
      success: (msg, opts) => show(msg, { ...opts, type: 'success' }),
      info: (msg, opts) => show(msg, { ...opts, type: 'info' }),
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="fixed left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {toasts.map((t) => {
          const s = STYLES[t.type] ?? STYLES.info;
          const Icon = s.icon;
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto w-full max-w-sm flex items-start gap-3 bg-[#2a2a2a] text-gray-100 border border-gray-700 border-l-4 ${s.accent} rounded-sm shadow-2xl px-4 py-3 font-sans text-sm animate-slide-up`}
            >
              <Icon size={18} className={`${s.iconColor} shrink-0 mt-0.5`} />
              <p className="flex-1 break-words">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="text-gray-400 hover:text-white shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
