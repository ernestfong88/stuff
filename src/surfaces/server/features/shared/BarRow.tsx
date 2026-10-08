import type { ReactNode } from 'react';
import { cx } from '../../../../ui';
import s from './BarRow.module.css';

/**
 * One row of a small bar chart: a name, a bar and a value, with the
 * signed-in associate's own row in bold.
 */
export function BarRow({
  label,
  pct,
  value,
  detail,
  color,
  mine,
}: {
  label: ReactNode;
  /** 0 to 100. */
  pct: number;
  value: ReactNode;
  /** Small text after the value ("3 of 5 tables"). */
  detail?: ReactNode;
  color: string;
  mine?: boolean;
}) {
  return (
    <div className={s.row}>
      <span className={cx(s.label, mine && s.mine)}>{label}</span>
      <span className={s.track} aria-hidden>
        <span className={s.fill} style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
      </span>
      <span className={s.value} style={{ color }}>
        {value}
      </span>
      {detail != null && <span className={s.detail}>{detail}</span>}
    </div>
  );
}
