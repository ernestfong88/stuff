import type { CSSProperties } from 'react';
import { serverColor, serverName } from '../../domain/servers';
import type { Order } from '../../domain/types';
import { minutesSince } from '../../lib/clock';
import { cx } from '../../ui';
import type { PlanItem } from '../../store/floorLayout';
import { hm, partyLast, partyName, resvAt, type Reservation } from './reservations/model';
import s from './FloorTile.module.css';

interface Props {
  table: PlanItem;
  box: CSSProperties;
  checks: Order[];
  /** The reservation the table is being kept for. */
  held: Reservation | null;
  at: number;
  selected: boolean;
  name: (o: Order) => string;
  onPick: () => void;
}

/** A table on the host floor: its open checks in their server's colour, or Free, or who it is held for. */
export function FloorTile({ table, box, checks, held, at, selected, name, onPick }: Props) {
  const heldLate = !!held && resvAt(held) < at;
  const title = held ? `Reserved ${hm(held.time)} for ${partyName(held)}, party of ${held.size}` : undefined;
  return (
    <button
      className={cx(
        s.tile,
        table.shape === 'round' && s.round,
        selected ? s.selected : held && !checks.length ? (heldLate ? s.heldLate : s.held) : null,
      )}
      style={box}
      onClick={onPick}
      title={title}
      aria-pressed={selected}
      aria-label={`${table.label}${checks.length ? `, ${checks.length} open` : held ? '' : ', free'}${title ? `. ${title}` : ''}`}
    >
      <span className={s.label}>{table.label}</span>
      {checks.length > 0 ? (
        <span className={s.pills}>
          {checks.map((o) => (
            <span key={o.id} className={s.pill} style={{ background: serverColor(o.server) }} title={`${name(o)} · ${serverName(o.server)}`}>
              {o.server} {minutesSince(o.openedAt)}m
            </span>
          ))}
        </span>
      ) : (
        !held && <span className={s.free}>Free</span>
      )}
      {held && (
        <span className={cx(s.hold, heldLate && s.holdLate)}>
          <span className={s.holdTime}>{hm(held.time)}</span>
          <span className={s.holdName}>{partyLast(held)}</span>
        </span>
      )}
    </button>
  );
}
