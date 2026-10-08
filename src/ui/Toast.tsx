import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { createSharedStore, useShared } from '../lib/sharedStore';
import s from './Toast.module.css';
import { cx } from './cx';

export interface ToastOptions {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  /** Optional action, e.g. Undo. */
  action?: { label: string; onClick: () => void };
  /** ms before it hides; default 4s, 8s when there is an action. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

const toasts = createSharedStore<ToastItem[]>([]);
let nextId = 1;

/**
 * Show a short message at the bottom of the screen. Returns a dismiss
 * function. A toast with an action (Undo) replaces any older one with an
 * action: only the latest change can be undone from a toast, so a stale
 * Undo is never offered and the toasts don't stack over the screen.
 */
export function toast(message: string, opts: ToastOptions = {}): () => void {
  const id = nextId++;
  toasts.set((list) => [...list.filter((t) => !(opts.action && t.action)).slice(-2), { id, message, ...opts }]);
  return () => dismiss(id);
}

function dismiss(id: number) {
  toasts.set((list) => list.filter((t) => t.id !== id));
}

function ToastView({ t }: { t: ToastItem }) {
  useEffect(() => {
    const ms = t.duration ?? (t.action ? 8000 : 4000);
    const timer = setTimeout(() => dismiss(t.id), ms);
    return () => clearTimeout(timer);
  }, [t]);
  const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'warning' || t.tone === 'danger' ? TriangleAlert : Info;
  return (
    <div className={cx(s.toast, t.tone && s[t.tone])} role="status">
      <Icon size={18} strokeWidth={2.2} className={s.icon} />
      <span className={s.msg}>{t.message}</span>
      {t.action && (
        <button
          className={s.action}
          onClick={() => {
            t.action!.onClick();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}

/** Mount once near the app root. */
export function Toaster() {
  const list = useShared(toasts);
  if (!list.length) return null;
  return createPortal(
    <div className={s.stack} aria-live="polite">
      {list.map((t) => (
        <ToastView key={t.id} t={t} />
      ))}
    </div>,
    document.getElementById('root') ?? document.body,
  );
}
