import type { ReactNode } from 'react';
import s from './SummaryTile.module.css';

/** Big serif number with a caption, for the shift review summary rows. */
export function SummaryTile({ value, label, color }: { value: ReactNode; label: ReactNode; color?: string }) {
  return (
    <div className={s.tile}>
      <div className={s.value} style={color ? { color } : undefined}>
        {value}
      </div>
      <div className={s.label}>{label}</div>
    </div>
  );
}

/** A wrapping row of tiles. */
export function SummaryTiles({ children }: { children: ReactNode }) {
  return <div className={s.row}>{children}</div>;
}
