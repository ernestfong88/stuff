import { serverName } from '../../../domain/servers';
import type { Order } from '../../../domain/types';
import { MINUTE } from '../../../lib/clock';
import { Button, cx } from '../../../ui';
import { clashes, clockOf, hm, isOpen, partyLast, partyList, partyName, resvAt, resvStatus, RESV_STATUS_LABEL, seatedDelta, tableLabel, type Reservation } from './model';
import s from './ReservationRow.module.css';

export type ResvAction = 'cancel' | 'noshow' | 'restore';

interface Props {
  r: Reservation;
  at: number;
  list: Reservation[];
  live: Order[];
  /** The list is showing today, so the party can be seated now. */
  isToday: boolean;
  labelOf: (id: string) => string | undefined;
  name: (o: Order) => string;
  onSeat: (r: Reservation) => void;
  onEdit: (r: Reservation) => void;
  onOpen: (o: Order) => void;
  onAct: (k: ResvAction, r: Reservation) => void;
}

/** One booking: time, party, status, table and reminder, notes, and what the host can do next. */
export function ReservationRow({ r, at, list, live, isToday, labelOf, name, onSeat, onEdit, onOpen, onAct }: Props) {
  const st = resvStatus(r, at);
  const open = isOpen(r);
  const dim = st === 'cancelled' || st === 'noshow';
  const table = tableLabel(r.seatedTable || r.tableId, labelOf);
  const clash = clashes({ ...r, open }, list);
  const mins = Math.round((resvAt(r) - at) / MINUTE);
  const order = r.orderId ? live.find((x) => x.id === r.orderId) : undefined;

  const line =
    st === 'seated' && r.seatedAt
      ? `Booked ${hm(r.time)} · Seated ${clockOf(r.seatedAt)} (${seatedDelta(r)})`
      : st === 'late'
        ? -mins < 60
          ? `${-mins} min late`
          : 'Not seated'
        : st === 'soon'
          ? mins <= 0
            ? 'Due now'
            : `Due in ${mins} min`
          : st === 'booked' && isToday && mins < 120
            ? `In ${mins} min`
            : null;
  const meta = [
    table ? (st === 'seated' ? table : `Table ${table}`) : 'Table at arrival',
    st === 'seated' && r.server ? serverName(r.server) : null,
    r.remindedAt
      ? `Reminder texted ${clockOf(r.remindedAt)} to ${r.remindedTo === 1 ? '1 person' : `${r.remindedTo ?? 0} people`}`
      : r.remind && open
        ? 'Text reminder on'
        : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className={cx(s.row, s[st], dim && s.dim)} aria-label={`${hm(r.time)} ${partyName(r)}, ${RESV_STATUS_LABEL[st]}`}>
      <div className={cx(s.time, st === 'cancelled' && s.struck)}>{hm(r.time)}</div>
      <div className={s.body}>
        <div className={s.top}>
          <span className={s.name}>{partyName(r)}</span>
          <span className={s.size}>Party of {r.size}</span>
          <span className={cx(s.chip, s[`chip_${st}`])}>{RESV_STATUS_LABEL[st]}</span>
        </div>
        {line && <div className={cx(s.line, s[`text_${st}`])}>{line}</div>}
        <div className={s.meta}>{meta}</div>
        {r.people.length > 1 && <div className={s.party}>{partyList(r)}</div>}
        {r.notes && <div className={s.notes}>{r.notes}</div>}
        {clash.length > 0 && (
          <div className={s.clash} role="note">
            ⚠ {table} is also booked for {clash.map((x) => `${partyLast(x)} at ${hm(x.time)}`).join(' and ')}
          </div>
        )}
      </div>
      <div className={s.actions}>
        {open && isToday && (
          <Button variant="primary" onClick={() => onSeat(r)}>
            Seat now
          </Button>
        )}
        {open && <Button onClick={() => onEdit(r)}>Edit</Button>}
        {open && st === 'late' && <Button onClick={() => onAct('noshow', r)}>No-show</Button>}
        {open && (
          <Button className={s.cancel} onClick={() => onAct('cancel', r)}>
            Cancel
          </Button>
        )}
        {st === 'seated' && order && <Button onClick={() => onOpen(order)}>Open {name(order)}</Button>}
        {dim && <Button onClick={() => onAct('restore', r)}>Restore</Button>}
      </div>
    </article>
  );
}
