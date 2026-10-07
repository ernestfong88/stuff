import type { CSSProperties } from 'react';
import { rooms } from '../../../data';
import type { FloorTable } from '../../../domain/types';
import { useDining } from '../../../store/dining';
import { cx } from '../../../ui';
import { pickerTable } from './floorTables';
import s from './FloorPicker.module.css';

/** The venue's floor plan for picking the table of a new check. */
export function FloorPicker({ room, me, onPick }: { room: string; me: string; onPick: (table: FloorTable) => void }) {
  const { orders } = useDining();
  const plan = rooms[room];
  if (!plan) return null;
  const tables = plan.tables.filter((t) => t.type === 'seat');
  const box = (b: { x: number; y: number; w: number; h: number }): CSSProperties => ({
    left: `${b.x}%`,
    top: `${b.y}%`,
    width: `${b.w}%`,
    height: `${b.h}%`,
  });
  return (
    <div className={s.plan}>
      <div className={s.grid} aria-hidden />
      {plan.bands.map((b) => (
        <div key={b.label} className={s.band} style={box(b)}>
          <span className={s.bandLabel}>{b.label}</span>
        </div>
      ))}
      {tables.map((t, i) => {
        const p = pickerTable(t, orders, me);
        const status = p.mine ? 'Your check' : p.others.length ? p.others.join(', ') : 'Open';
        return (
          <button
            key={t.id}
            className={cx(s.table, 'pop-in', t.shape === 'round' && s.round, p.mine && s.mine, !p.mine && p.others.length > 0 && s.other)}
            style={{ ...box(t), animationDelay: `${i * 12}ms` }}
            onClick={() => onPick(t)}
            aria-label={`${t.label}: ${status}${p.covers ? `, ${p.covers} of ${p.seats} seats taken` : ''}`}
          >
            <span className={s.label}>{t.label}</span>
            <span className={s.status}>{status}</span>
            {p.covers > 0 && (
              <span className={cx(s.seats, p.full && s.full)}>{p.full ? `Full · ${p.covers} seated` : `${p.covers} of ${p.seats} seats`}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
