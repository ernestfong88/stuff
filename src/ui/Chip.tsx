import type { HTMLAttributes, ReactNode } from 'react';
import s from './Chip.module.css';
import { cx } from './cx';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'plum' | 'gold' | 'dark' | 'outline';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: 'xs' | 'sm' | 'md';
  icon?: ReactNode;
  /** Use a solid fill instead of the soft tint. */
  solid?: boolean;
}

/** Small status label: allergies, diets, counts, states. */
export function Chip({ tone = 'neutral', size = 'sm', icon, solid, className, children, ...rest }: ChipProps) {
  return (
    <span className={cx(s.chip, s[tone], s[size], solid && s.solid, className)} {...rest}>
      {icon}
      {children}
    </span>
  );
}

/** Round count badge, e.g. the red "3" on Notices. */
export function CountBadge({ count, tone = 'danger', className }: { count: number; tone?: Tone; className?: string }) {
  if (!count) return null;
  return (
    <span className={cx(s.count, s[tone], s.solid, className)} aria-label={`${count}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
