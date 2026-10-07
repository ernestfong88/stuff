/**
 * More back office building blocks: stat tiles that filter a list, a
 * labelled field, a styled select, small caps captions and an icon button
 * for table rows.
 */
import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx } from '../../../ui';
import s from './controls.module.css';

/** Big number with a caption; pressing it filters the list below (aria-pressed shows which). */
export function BoStatTile({ value, label, tone, active, onClick }: { value: ReactNode; label: ReactNode; tone?: 'danger' | 'ocean' | 'clay' | 'green'; active?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <span className={cx(s.statValue, tone && s[`tone_${tone}`])}>{value}</span>
      <span className={s.statLabel}>{label}</span>
    </>
  );
  return onClick ? (
    <button className={cx(s.stat, s.statButton, active && s.statOn)} aria-pressed={active} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={s.stat}>{body}</div>
  );
}

/** Row of stat tiles that wraps on narrow pages. */
export function BoStatRow({ children }: { children: ReactNode }) {
  return <div className={s.statRow}>{children}</div>;
}

/** Native select with the back office look. */
export const BoSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function BoSelect({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(s.select, className)} {...rest}>
      {children}
    </select>
  );
});

/** A label over its control, with an optional hint. The render prop gets the id to put on the control. */
export function BoField({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.fieldLabel}>
        {label}
      </label>
      {children(id)}
      {hint && <div className={s.fieldHint}>{hint}</div>}
    </div>
  );
}

/** Small caps caption over a group ("NEEDS YOUR ATTENTION", "WHAT IS DRIVING IT"). */
export function BoCaption({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(s.caption, className)}>{children}</div>;
}

/** Compact square icon button for table rows (edit, retire ...). Always pass aria-label. */
export function BoIconButton({ tone = 'quiet', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'quiet' | 'danger'; 'aria-label': string }) {
  return <button type="button" className={cx(s.iconBtn, tone === 'danger' && s.iconDanger, className)} title={rest['aria-label']} {...rest} />;
}

/** "Label 12" pill used as a filter (aria-pressed). */
export function BoFilterChip({ active, onClick, children, color, bg }: { active?: boolean; onClick: () => void; children: ReactNode; color?: string; bg?: string }) {
  return (
    <button className={cx(s.chip, active && s.chipOn)} aria-pressed={!!active} onClick={onClick} style={{ color, background: bg }}>
      {children}
    </button>
  );
}
