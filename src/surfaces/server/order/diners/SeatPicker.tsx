import type { CSSProperties } from 'react';
import type { Diner, Order } from '../../../../domain/types';
import { cx } from '../../../../ui';
import { AnchoredMenu } from '../../shared/AnchoredMenu';
import s from './SeatPicker.module.css';

/** The seat number on a diner's card; tap to move them to another seat (round tables show the circle). */
export function SeatPicker({ order, diner, round, onPick }: { order: Order; diner: Diner; round: boolean; onPick: (seat: number) => void }) {
  const count = Math.max(order.diners.length, diner.seat, 8);
  const seats = Array.from({ length: count }, (_, i) => i + 1);
  const taken = order.diners.filter((d) => d.id !== diner.id).map((d) => d.seat);
  const seatBtn = (n: number, close: () => void, style?: CSSProperties) => (
    <button
      key={n}
      role="menuitemradio"
      aria-checked={diner.seat === n}
      aria-label={`Seat ${n}${taken.includes(n) ? ', taken' : ''}`}
      className={cx(round ? s.roundSeat : s.seat, diner.seat === n && s.on, taken.includes(n) && s.taken)}
      style={style}
      onClick={() => {
        onPick(n);
        close();
      }}
    >
      {n}
    </button>
  );
  return (
    <AnchoredMenu
      label="Seat number"
      width={round ? 180 : 212}
      height={round ? 230 : 160}
      trigger={({ open, toggle }) => (
        <button
          className={cx(s.trigger, open && s.triggerOpen)}
          title={`Seat ${diner.seat} · tap to change`}
          aria-label={`Seat ${diner.seat}. Change seat`}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
        >
          {diner.seat}
        </button>
      )}
    >
      {({ close }) => (
        <div className={s.body}>
          <div className={s.title}>{round ? 'Seat at the table' : 'Seat number'}</div>
          {round ? (
            <div className={s.circle}>
              <div className={s.tableTop} />
              {seats.slice(0, 8).map((n, i) => {
                const a = (i / Math.min(seats.length, 8)) * 2 * Math.PI - Math.PI / 2;
                return seatBtn(n, close, { left: 72 + 60 * Math.cos(a) - 17, top: 72 + 60 * Math.sin(a) - 17 });
              })}
            </div>
          ) : (
            <div className={s.grid}>{seats.map((n) => seatBtn(n, close))}</div>
          )}
          <div className={s.hint}>Greyed seats are taken</div>
        </div>
      )}
    </AnchoredMenu>
  );
}
