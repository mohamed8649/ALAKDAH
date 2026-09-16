'use client';

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/cn';

/**
 * Toasts.
 *
 * For short-lived confirmations only ("order status updated"). Anything the
 * merchant must read or correct — a validation error, a failed upload they can
 * retry — belongs inline next to the thing that failed, not in a notice that
 * disappears after four seconds.
 */

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastRecord extends Required<Pick<ToastOptions, 'title' | 'tone'>> {
  id: string;
  description?: string;
  durationMs: number;
  action?: ToastOptions['action'];
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const record: ToastRecord = {
      id: Math.random().toString(36).slice(2),
      title: options.title,
      description: options.description,
      tone: options.tone ?? 'success',
      durationMs: options.durationMs ?? (options.tone === 'error' ? 7000 : 4000),
      action: options.action,
    };
    setToasts((current) => [...current.slice(-3), record]);
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // polite: a success confirmation must not interrupt a screen reader
        // mid-sentence.
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-4 sm:end-4 sm:items-end"
      >
        {toasts.map((item) => (
          <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  const Icon = ICONS[toast.tone];

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-lg)] border bg-surface-elevated p-3 shadow-overlay',
        'animate-slide-up',
        TONE_BORDER[toast.tone],
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', TONE_TEXT[toast.tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{toast.description}</p>
        ) : null}
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="إغلاق"
        className="shrink-0 rounded-[var(--radius-sm)] p-0.5 text-subtle-foreground transition-colors duration-fast hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const TONE_TEXT = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
} as const;

const TONE_BORDER = {
  success: 'border-[var(--success)]/30',
  error: 'border-[var(--danger)]/30',
  warning: 'border-[var(--warning)]/30',
  info: 'border-[var(--info)]/30',
} as const;

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside a ToastProvider.');
  return value;
}
