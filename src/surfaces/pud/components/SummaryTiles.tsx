import { cx } from '../../../ui';
import s from './SummaryTiles.module.css';

export type TileTone = 'danger' | 'flora' | 'clay' | 'clayDeep' | 'coast' | 'ink' | 'off';

export interface SummaryTile {
  value: number | string;
  label: string;
  tone: TileTone;
}

/** The row of big numbers above the list ("1 late", "3 in the kitchen" ...). */
export function SummaryTiles({ tiles, label }: { tiles: SummaryTile[]; label: string }) {
  return (
    <ul className={s.tiles} aria-label={label}>
      {tiles.map((t) => (
        <li key={t.label} className={s.tile}>
          <span className={cx(s.value, s[t.tone])}>{t.value}</span>
          <span className={s.label}>{t.label}</span>
        </li>
      ))}
    </ul>
  );
}
