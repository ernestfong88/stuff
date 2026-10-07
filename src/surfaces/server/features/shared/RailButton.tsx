import type { ReactNode } from 'react';
import { cx } from '../../../../ui';
import s from './RailButton.module.css';

/** Square icon-and-label button for the tablet's right rail (Notices, Voice). */
export function RailButton({
  icon,
  label,
  onClick,
  tone = 'ocean',
  badge,
  pulse,
  title,
  ariaLabel,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'ocean' | 'amber' | 'quiet';
  /** Count shown in a red badge on the corner. */
  badge?: number;
  /** A soft ring that pulses, for something waiting to be seen. */
  pulse?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  return (
    <button type="button" className={cx(s.btn, s[tone], pulse && s.pulse)} onClick={onClick} title={title} aria-label={ariaLabel ?? label}>
      {icon}
      <span className={s.label}>{label}</span>
      {!!badge && (
        <span className={s.badge} aria-hidden>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
