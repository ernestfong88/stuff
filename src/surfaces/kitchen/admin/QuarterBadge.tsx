import { quarterStyle } from './menuCycle';
import s from './QuarterBadge.module.css';

/** "Q4 2026 · Fall" in the season's colour. */
export function QuarterBadge({ quarter }: { quarter: string }) {
  if (!quarter) return <span className={s.none}>No quarter</span>;
  const q = quarterStyle(quarter);
  return (
    <span className={s.badge} style={{ color: q.fg, background: q.bg }}>
      {q.label}
      {q.season && <span className={s.season}>· {q.season}</span>}
    </span>
  );
}
