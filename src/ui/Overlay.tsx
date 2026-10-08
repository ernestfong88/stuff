import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import s from './Overlay.module.css';
import { cx } from './cx';

/**
 * Overlays render into #root (not body) so the text-size zoom applied to
 * #root also applies to dialogs and sheets.
 */
function portalTarget(): HTMLElement {
  return document.getElementById('root') ?? document.body;
}

let openCount = 0;

/** Close on Escape, lock background scroll, and restore focus on close. */
function useOverlayBehaviour(open: boolean, onClose: () => void, panel: React.RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    openCount++;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    // Only an explicit data-autofocus takes focus: focusing an input on open
    // would pop the on-screen keyboard over the sheet on tablets.
    const target = panel.current?.querySelector<HTMLElement>('[data-autofocus]');
    (target ?? panel.current)?.focus({ preventScroll: true });
    return () => {
      openCount--;
      window.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, panel]);
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Small text under the title. */
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sticky footer, usually the action buttons. */
  footer?: ReactNode;
  width?: number | string;
  /** Hide the close (X) button. */
  hideClose?: boolean;
  /** Tapping the backdrop does not close (for flows that must be finished). */
  persistent?: boolean;
  className?: string;
  /** Full height dialog (lists, menus). */
  tall?: boolean;
}

/** Centred dialog. */
export function Modal({ open, onClose, title, subtitle, children, footer, width = 520, hideClose, persistent, className, tall }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlayBehaviour(open, onClose, panel);
  if (!open) return null;
  return createPortal(
    <div className={s.backdrop} onMouseDown={(e) => e.target === e.currentTarget && !persistent && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(s.modal, tall && s.tall, className)}
        style={{ width }}
      >
        {(title || !hideClose) && (
          <header className={s.header}>
            <div className={s.titles}>
              {title && (
                <h2 id={titleId} className={s.title}>
                  {title}
                </h2>
              )}
              {subtitle && <div className={s.subtitle}>{subtitle}</div>}
            </div>
            {!hideClose && (
              <button className={s.close} onClick={onClose} aria-label="Close">
                <X size={18} strokeWidth={2.4} />
              </button>
            )}
          </header>
        )}
        <div className={s.body}>{children}</div>
        {footer && <footer className={s.footer}>{footer}</footer>}
      </div>
    </div>,
    portalTarget(),
  );
}

export interface SheetProps extends Omit<ModalProps, 'tall'> {
  /** Which edge the sheet slides from. */
  side?: 'right' | 'bottom';
}

/** Panel that slides in from the right (details) or bottom (phone-style). */
export function Sheet({ open, onClose, title, subtitle, children, footer, width = 460, hideClose, persistent, className, side = 'right' }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlayBehaviour(open, onClose, panel);
  if (!open) return null;
  return createPortal(
    <div className={cx(s.backdrop, s.sheetBackdrop, s[side])} onMouseDown={(e) => e.target === e.currentTarget && !persistent && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(s.sheet, s[`sheet_${side}`], className)}
        style={side === 'right' ? { width } : undefined}
      >
        {(title || !hideClose) && (
          <header className={s.header}>
            <div className={s.titles}>
              {title && (
                <h2 id={titleId} className={s.title}>
                  {title}
                </h2>
              )}
              {subtitle && <div className={s.subtitle}>{subtitle}</div>}
            </div>
            {!hideClose && (
              <button className={s.close} onClick={onClose} aria-label="Close">
                <X size={18} strokeWidth={2.4} />
              </button>
            )}
          </header>
        )}
        <div className={s.body}>{children}</div>
        {footer && <footer className={s.footer}>{footer}</footer>}
      </div>
    </div>,
    portalTarget(),
  );
}

export function isOverlayOpen(): boolean {
  return openCount > 0;
}
