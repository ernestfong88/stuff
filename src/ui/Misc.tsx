import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import s from './Misc.module.css';
import { cx } from './cx';

/** Small uppercase label above a section ("OLDER ORDERS · 15 CLOSED"). */
export function Eyebrow({ children, className, style, dark }: { children: ReactNode; className?: string; style?: CSSProperties; dark?: boolean }) {
  return (
    <div className={cx(s.eyebrow, dark && s.eyebrowDark, className)} style={style}>
      {children}
    </div>
  );
}

/** Page title in the Fraunces serif. */
export function PageTitle({ children, sub, actions, className }: { children: ReactNode; sub?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx(s.pageTitle, className)}>
      <div className={s.pageTitleText}>
        <h1>{children}</h1>
        {sub && <span className={s.pageSub}>{sub}</span>}
      </div>
      {actions && <div className={s.pageActions}>{actions}</div>}
    </div>
  );
}

/** Friendly placeholder for an empty list. */
export function EmptyState({ icon, title, children, action, compact, dark }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; compact?: boolean; dark?: boolean }) {
  return (
    <div className={cx(s.empty, compact && s.emptyCompact, dark && s.emptyDark)}>
      {icon && <div className={s.emptyIcon}>{icon}</div>}
      <div className={s.emptyTitle}>{title}</div>
      {children && <div className={s.emptyBody}>{children}</div>}
      {action && <div className={s.emptyAction}>{action}</div>}
    </div>
  );
}

/** Big number with a caption, for summary strips. */
export function Stat({ value, label, tone, className }: { value: ReactNode; label: ReactNode; tone?: 'ocean' | 'clay' | 'flora' | 'danger' | 'teal' | 'plum'; className?: string }) {
  return (
    <div className={cx(s.stat, className)}>
      <div className={cx(s.statValue, tone && s[`tone_${tone}`])}>{value}</div>
      <div className={s.statLabel}>{label}</div>
    </div>
  );
}

/** On/off switch. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx(s.toggleRow, disabled && s.toggleDisabled)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={cx(s.toggle, checked && s.toggleOn)}
        onClick={() => onChange(!checked)}
      >
        <span className={s.knob} />
      </button>
      {label && <span>{label}</span>}
    </label>
  );
}

/** - 3 + quantity picker. */
export function Stepper({ value, onChange, min = 0, max = 99, size = 'md' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; size?: 'sm' | 'md' }) {
  return (
    <span className={cx(s.stepper, s[`stepper_${size}`])}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Less">
        −
      </button>
      <span className={s.stepValue}>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="More">
        +
      </button>
    </span>
  );
}

/** Horizontal row with gap; avoids one-off flex styles. */
export function Row({ gap = 8, align = 'center', wrap, className, style, ...rest }: HTMLAttributes<HTMLDivElement> & { gap?: number; align?: CSSProperties['alignItems']; wrap?: boolean }) {
  return <div className={className} style={{ display: 'flex', alignItems: align, gap, flexWrap: wrap ? 'wrap' : undefined, minWidth: 0, ...style }} {...rest} />;
}

/** Vertical stack with gap. */
export function Stack({ gap = 8, className, style, ...rest }: HTMLAttributes<HTMLDivElement> & { gap?: number }) {
  return <div className={className} style={{ display: 'flex', flexDirection: 'column', gap, minWidth: 0, ...style }} {...rest} />;
}

/** Flexible spacer inside a Row. */
export function Spacer() {
  return <span style={{ flex: 1, minWidth: 6 }} />;
}
