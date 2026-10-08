import { cx } from '../../../../ui';
import s from './RankBadge.module.css';

/** A place on the board: gold, silver and bronze discs for the top three. */
export function RankBadge({ rank, size = 28 }: { rank: number; size?: number }) {
  return (
    <span
      className={cx(s.badge, rank === 1 ? s.gold : rank === 2 ? s.silver : rank === 3 ? s.bronze : s.plain)}
      style={{ width: size, height: size }}
      aria-label={`Place ${rank}`}
    >
      {rank}
    </span>
  );
}
