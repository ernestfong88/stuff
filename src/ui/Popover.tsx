import { useEffect, useRef, useState, type ReactNode } from 'react';
import s from './Popover.module.css';
import { cx } from './cx';

export interface PopoverProps {
  /** Renders the trigger; call toggle() from its onClick. */
  trigger: (api: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode | ((api: { close: () => void }) => ReactNode);
  align?: 'left' | 'right' | 'center';
  /** Open above the trigger instead of below. */
  above?: boolean;
  className?: string;
  minWidth?: number;
}

/** Click-to-open floating panel anchored to its trigger (menus, pickers). */
export function Popover({ trigger, children, align = 'right', above, className, minWidth = 200 }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <span ref={root} className={s.root}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div className={cx(s.panel, s[align], above && s.above, className)} style={{ minWidth }} role="menu">
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </span>
  );
}

export interface MenuItemProps {
  onClick?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  /** Right-aligned hint, e.g. a count or a check mark. */
  end?: ReactNode;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

export function MenuItem({ onClick, icon, children, end, active, danger, disabled }: MenuItemProps) {
  return (
    <button role="menuitem" className={cx(s.item, active && s.itemActive, danger && s.itemDanger)} onClick={onClick} disabled={disabled}>
      {icon && <span className={s.itemIcon}>{icon}</span>}
      <span className={s.itemLabel}>{children}</span>
      {end}
    </button>
  );
}

export function MenuDivider() {
  return <div className={s.divider} role="separator" />;
}
