import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Plus } from 'lucide-react';
import { residents } from '../../data';
import { namesOf } from '../../domain/orders';
import { serverColor, serverName, type ServerOnFloor } from '../../domain/servers';
import type { Order } from '../../domain/types';
import { MINUTE, minutesSince } from '../../lib/clock';
import { Avatar, Button, cx } from '../../ui';
import type { PlanItem } from '../../store/floorLayout';
import { searchResidents } from './residentSearch';
import { hm, partyName, resvAt, seatedDelta, tableLabel, type Reservation, type SeatEntry } from './reservations/model';
import s from './SeatPanel.module.css';

/** Inline style with CSS custom properties (the server's colour). */
type CSSVars = CSSProperties & Record<`--${string}`, string>;
const srvColor = (c: string): CSSVars => ({ '--srv': c });

interface Props {
  table: PlanItem;
  checks: Order[];
  servers: ServerOnFloor[];
  server: string | null;
  onServer: (id: string) => void;
  seats: SeatEntry[];
  onSeats: (seats: SeatEntry[]) => void;
  /** The reservation being seated, if any. */
  reservation: Reservation | null;
  onDropReservation: () => void;
  /** A booking this table is kept for (a walk-in can still sit here). */
  heldFor: Reservation | null;
  onSeatHeld: (r: Reservation) => void;
  at: number;
  name: (o: Order) => string;
  labelOf: (id: string) => string | undefined;
  onOpen: (o: Order) => void;
  onSeat: () => void;
  onClose: () => void;
}

/**
 * Seating a party: pick their server (the suggestion is preselected), type
 * names or apartments, and seat. Tapping a table goes straight to typing a
 * name; Enter or a tap on a name seats that resident and puts the cursor
 * back for the next one.
 */
export function SeatPanel(p: Props) {
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const hits = q.trim() ? searchResidents(residents, q, 7) : [];
  const serverWord = p.servers.find((x) => x.id === p.server)?.name || (p.server ? serverName(p.server) : '');

  useEffect(() => {
    setQ('');
    input.current?.focus();
  }, [p.table.id]);

  const add = (residentId: string, name: string) => {
    p.onSeats([...p.seats, { name, residentId }]);
    setQ('');
    input.current?.focus();
  };

  return (
    <aside className={s.panel} aria-label={`Seat a party at ${p.table.label}`}>
      <div className={s.head}>
        <h2 className={s.title}>{p.table.label}</h2>
        <span className={s.sub}>{p.checks.length ? (p.checks.length === 1 ? '1 check open' : `${p.checks.length} checks open`) : 'free'}</span>
        <Button variant="ghost" className={s.close} onClick={p.onClose}>
          Close
        </Button>
      </div>

      {p.reservation && <ReservationBox r={p.reservation} table={p.table} named={p.seats.length} at={p.at} labelOf={p.labelOf} onDrop={p.onDropReservation} />}
      {!p.reservation && p.heldFor && <HeldNote r={p.heldFor} at={p.at} onSeat={p.onSeatHeld} />}

      {p.checks.length > 0 && (
        <div className={s.checks}>
          {p.checks.map((o) => (
            <button key={o.id} className={s.check} style={{ borderLeftColor: serverColor(o.server) }} onClick={() => p.onOpen(o)}>
              <span className={s.checkName}>{p.name(o)}</span>
              <span className={s.checkWho}>
                {serverName(o.server)} · {namesOf(o) || 'Seated'}
              </span>
              <span className={s.checkMins}>{minutesSince(o.openedAt)}m</span>
            </button>
          ))}
        </div>
      )}

      <div className={s.caption}>{p.checks.length ? 'Seat another party here' : 'Who is their server'}</div>
      <div className={s.servers} role="radiogroup" aria-label="Server">
        {p.servers.map((sv) => {
          const on = sv.id === p.server;
          return (
            <button
              key={sv.id}
              role="radio"
              aria-checked={on}
              className={cx(s.server, on && s.serverOn)}
              style={srvColor(sv.color)}
              onClick={() => p.onServer(sv.id)}
            >
              <span className={s.serverDot}>{sv.id}</span>
              <span className={s.serverText}>
                <span className={s.serverName}>{sv.name || serverName(sv.id)}</span>
                <span className={s.serverOpen}>{sv.open} open</span>
              </span>
            </button>
          );
        })}
      </div>

      <input
        ref={input}
        className={s.search}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits.length) {
            e.preventDefault();
            add(hits[0].id, hits[0].name);
          }
        }}
        enterKeyHint="done"
        aria-label="Resident name or apartment"
        placeholder="Type a name or apartment number"
      />
      {hits.length > 0 && (
        <div className={s.hits}>
          {hits.map((r, i) => (
            <button key={r.id} className={s.hit} onClick={() => add(r.id, r.name)} title={i === 0 ? 'Enter adds this resident' : undefined}>
              <Avatar person={r} size={32} />
              <span className={s.hitText}>
                <span className={s.hitName}>{r.name}</span>
                <span className={s.hitApt}>
                  Apt {r.apt}
                  {r.level ? ` · ${r.level}` : ''}
                </span>
              </span>
              <Plus size={16} strokeWidth={2.5} className={s.hitPlus} />
            </button>
          ))}
        </div>
      )}

      {p.seats.length > 0 && (
        <ol className={s.seats}>
          {p.seats.map((x, i) => (
            <li key={i} className={s.seat}>
              <span className={s.seatNo}>S{i + 1}</span>
              <span className={s.seatName}>
                {x.name}
                {x.guest ? ` (${x.guest.rel && x.guest.rel !== 'Guest' ? x.guest.rel : 'guest'})` : ''}
              </span>
              <Button variant="ghost" onClick={() => p.onSeats(p.seats.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </li>
          ))}
        </ol>
      )}

      <Button variant="primary" size="lg" block className={s.seatBtn} disabled={!p.seats.length || !p.server} onClick={p.onSeat}>
        {p.seats.length ? `Seat ${p.seats.length} for ${serverWord} and start the timer` : 'Add who is sitting down'}
      </Button>
    </aside>
  );
}

/** The reservation being seated, at the top of the panel. The server adds anyone it did not name. */
function ReservationBox({ r, table, named, at, labelOf, onDrop }: { r: Reservation; table: PlanItem; named: number; at: number; labelOf: (id: string) => string | undefined; onDrop: () => void }) {
  const delta = seatedDelta(r, at);
  const moved = r.tableId && r.tableId !== table.id;
  return (
    <div className={s.resv}>
      <div className={s.resvHead}>
        <span className={s.resvTime}>Reservation {hm(r.time)}</span>
        <span className={cx(s.resvDelta, /late/.test(delta) && s.lateText)}>{delta}</span>
        <button className={s.link} onClick={onDrop}>
          Not this reservation
        </button>
      </div>
      <span className={s.resvName}>
        {partyName(r)}, party of {r.size}
      </span>
      {r.notes && <span className={s.resvNotes}>{r.notes}</span>}
      {moved && (
        <span className={s.resvMeta}>
          Booked for {tableLabel(r.tableId, labelOf)}, seating at {table.label}
        </span>
      )}
      {named < r.size && (
        <span className={s.resvMeta}>
          {named} of {r.size} named, the server adds the rest
        </span>
      )}
    </div>
  );
}

/** A walk-in at a table held for a booking: say so, but the host knows whether it will turn in time. */
function HeldNote({ r, at, onSeat }: { r: Reservation; at: number; onSeat: (r: Reservation) => void }) {
  const m = Math.round((resvAt(r) - at) / MINUTE);
  const when = m > 0 ? `in ${m} min` : m === 0 ? 'due now' : `${-m} min late`;
  return (
    <div className={s.held} role="note">
      <span>
        Reserved <b>{hm(r.time)}</b> for {partyName(r)}, party of {r.size} ({when}). You can still seat a walk-in here.
      </span>
      <Button className={s.heldBtn} onClick={() => onSeat(r)}>
        They’re here, seat the reservation
      </Button>
    </div>
  );
}
