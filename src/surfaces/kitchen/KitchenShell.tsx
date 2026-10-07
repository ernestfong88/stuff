import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ModeChip, TextZoom } from '../../shell/controls';
import { cx } from '../../ui';
import s from './KitchenShell.module.css';

/** The dark full-screen frame of a kitchen display. */
export function KitchenShell({ children }: { children: ReactNode }) {
  return <div className={s.shell}>{children}</div>;
}

/**
 * Kitchen header: big title, small subtitle, then whatever the screen
 * needs (filters, screen picker), its buttons, and the text size and mode
 * controls at the end.
 */
export function KitchenHeader({
  title,
  subtitle,
  lead,
  children,
  actions,
  ownRow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Before the title (a back button). */
  lead?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Below a wide screen, put the middle part on its own row (a long filter bar). */
  ownRow?: boolean;
}) {
  return (
    <header className={s.header}>
      {lead}
      <div className={s.titles}>
        <h1 className={s.title}>{title}</h1>
        {subtitle && <span className={s.subtitle}>{subtitle}</span>}
      </div>
      {children && <div className={cx(s.middle, ownRow && s.ownRow)}>{children}</div>}
      <div className={s.actions}>
        {actions}
        <TextZoom dark tall />
        <ModeChip dark tall />
      </div>
    </header>
  );
}

export interface HeaderButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  /** Shown pressed (an open menu or the current filter). */
  on?: boolean;
  /** Count pill after the label. */
  count?: number;
  countTone?: 'neutral' | 'green' | 'blue' | 'amber';
  /** Gold outline, for the one filter that is a different kind of list. */
  outlined?: boolean;
}

/** A dark header button, at least 40px tall for gloved fingers. */
export const HeaderButton = forwardRef<HTMLButtonElement, HeaderButtonProps>(function HeaderButton(
  { icon, on, count, countTone = 'neutral', outlined, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx(s.btn, on && s.on, outlined && s.outlined, className)} {...rest}>
      {icon}
      {children}
      {count != null && <span className={cx(s.count, count > 0 ? s[`count_${countTone}`] : s.countZero)}>{count}</span>}
    </button>
  );
});

/** The scrolling ticket area. Bump bar row navigation looks for data-kscroll. */
export function TicketArea({ children, label }: { children: ReactNode; label: string }) {
  return (
    <main className={s.area} data-kscroll="" aria-label={label}>
      {children}
    </main>
  );
}

/** Auto-filling grid of tickets; each child sits in a slot the bump bar can find. */
export function TicketGrid({ children }: { children: ReactNode }) {
  return <div className={s.grid}>{children}</div>;
}

export function TicketSlot({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className={s.slot} data-kticket={index}>
      {children}
    </div>
  );
}

/** Whole-grid message: "Line is clear." */
export function GridMessage({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={s.message} role="status">
      {icon && <span className={s.messageIcon}>{icon}</span>}
      <span className={s.messageTitle}>{title}</span>
      {children && <span className={s.messageBody}>{children}</span>}
    </div>
  );
}
