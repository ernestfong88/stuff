import type { ReactNode } from 'react';
import s from './Tabs.module.css';
import { cx } from './cx';

export interface TabOption<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Count shown in a small pill after the label. */
  count?: number;
  /** Tone of the count pill. */
  countTone?: 'neutral' | 'success' | 'danger' | 'plum' | 'info';
  disabled?: boolean;
}

export interface TabsProps<T extends string> {
  value: T;
  onChange: (id: T) => void;
  options: Array<TabOption<T>>;
  /** pills: separate rounded buttons (dark when on). segmented: one grouped control. underline: page tabs. */
  variant?: 'pills' | 'segmented' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  /** Dark theme for kitchen screens. */
  dark?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function Tabs<T extends string>({ value, onChange, options, variant = 'pills', size = 'md', dark, className, ...aria }: TabsProps<T>) {
  return (
    <div role="tablist" className={cx(s.tabs, s[variant], s[size], dark && s.dark, className)} aria-label={aria['aria-label']}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={on}
            disabled={o.disabled}
            className={cx(s.tab, on && s.on)}
            onClick={() => onChange(o.id)}
          >
            {o.icon}
            <span>{o.label}</span>
            {o.count != null && <span className={cx(s.count, o.countTone && s[`count_${o.countTone}`])}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
