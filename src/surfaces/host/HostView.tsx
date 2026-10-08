import { useState } from 'react';
import { getTable } from '../../data';
import { moveNote, seatedAt, seatedAtText } from '../../domain/seating';
import { serversOnFloor, suggestServer } from '../../domain/servers';
import type { MealName, Order } from '../../domain/types';
import { now } from '../../lib/clock';
import { useVenue } from '../../shell/session';
import { useDiningActions, useDiningOrders } from '../../store/dining';
import { Button, cx, toast, useConfirm, useNow } from '../../ui';
import { FloorPlan } from '../manager/floor/FloorPlan';
import { checksAt, inPlan, useRoomPlan, useTableName, type PlanItem } from '../../store/floorLayout';
import { ServerLegend } from '../manager/floor/ServerLegend';
import { FloorTile } from './FloorTile';
import { HostTabs, type HostTab } from './HostTabs';
import { textedNote } from './reservations/contacts';
import {
  dayFromToday,
  dayWord,
  hm,
  heldFor,
  isOpen,
  mealAtMinutes,
  nowMinutes,
  partyName,
  seatedDelta,
  seatsFor,
  type Reservation,
  type SeatEntry,
} from './reservations/model';
import { ReservationForm } from './reservations/ReservationForm';
import { ReservationList } from './reservations/ReservationList';
import type { ResvAction } from './reservations/ReservationRow';
import { patchReservation, putReservation, sendDueReminders, textReservation, useReservations } from './reservations/store';
import { SeatPanel } from './SeatPanel';
import s from './HostView.module.css';

interface Props {
  tab: HostTab;
  onTab: (t: HostTab) => void;
  onOpen: (o: Order) => void;
}

/** __KHost: seat parties on the floor and keep the reservation book. */
export function HostView({ tab, onTab, onOpen }: Props) {
  const [venue] = useVenue();
  const plan = useRoomPlan(venue);
  const { newCheck, addDiner, patchOrder, removeDiner, closeOrder } = useDiningActions();
  const orders = useDiningOrders();
  const [ask, confirmDialog] = useConfirm();
  const at = useNow(15_000);
  const name = useTableName();
  const book = useReservations();

  const [pick, setPick] = useState<PlanItem | null>(null);
  const [seats, setSeats] = useState<SeatEntry[]>([]);
  const [server, setServer] = useState<string | null>(null);
  const [seating, setSeating] = useState<Reservation | null>(null);
  const [form, setForm] = useState<{ r?: Reservation } | null>(null);
  const [day, setDay] = useState(() => dayFromToday(0));
  const [meal, setMeal] = useState<MealName>(() => mealAtMinutes(nowMinutes()));

  const live = orders.filter((o) => !o.queueType);
  const here = live.filter((o) => inPlan(o, plan));
  const servers = serversOnFloor(here);
  const due = book.filter((r) => r.room === venue && r.date === dayFromToday(0) && isOpen(r)).length;
  const labelOf = (id: string) => plan.items.find((t) => t.id === id)?.label ?? getTable(id)?.label;

  const goTab = (t: HostTab) => {
    onTab(t);
    setPick(null);
    setSeats([]);
    setSeating(null);
  };
  const choose = (t: PlanItem) => {
    setPick(t);
    setSeats(seating ? seatsFor(seating) : []);
    setServer(suggestServer(t, live, servers));
  };
  const closePanel = () => {
    setPick(null);
    setSeats([]);
    setSeating(null);
  };

  /** Seat now runs the normal seating panel with the party named, on the booked table if there is one. */
  const seatReservation = (r: Reservation) => {
    const t = plan.tables.find((x) => x.id === r.tableId) ?? null;
    goTab('floor');
    setSeating(r);
    if (t) {
      setPick(t);
      setSeats(seatsFor(r));
      setServer(suggestServer(t, live, servers));
    }
  };

  const seat = async () => {
    if (!pick || !seats.length || !server) return;
    // Someone in the party already at another open table: say where, then move them or stop.
    const dupes = seats.flatMap((x) => {
      const at = x.residentId && !x.guest ? seatedAt(live, x.residentId) : null;
      return at ? [{ name: x.name, at }] : [];
    });
    if (dupes.length) {
      const ok = await ask({
        title: dupes.length === 1 ? seatedAtText(dupes[0].name, dupes[0].at) : `${dupes.length} of this party are already seated`,
        message: (
          <>
            {dupes.length > 1 && <span>{dupes.map((d) => seatedAtText(d.name, d.at)).join('. ')}. </span>}
            {dupes.map((d) => moveNote(d.name, d.at)).join(' ')} Cancel if they are still sitting there.
          </>
        ),
        confirmLabel: dupes.length === 1 ? `Move ${dupes[0].name.split(' ')[0]} to ${pick.label}` : `Move them to ${pick.label}`,
      });
      if (!ok) return;
      for (const d of dupes) {
        removeDiner(d.at.order.id, d.at.dinerId);
        // Nobody left on the old check: it goes, rather than sitting empty on the floor.
        if (d.at.order.diners.length === 1) closeOrder(d.at.order.id);
      }
    }
    const oid = newCheck(pick.id, venue, mealAtMinutes(nowMinutes()), server);
    patchOrder(oid, { hostSeated: true });
    // A guest added on the floor sits against the first resident in the party.
    const firstResident = seats.find((x) => x.residentId)?.residentId ?? '';
    for (const x of seats) {
      if (x.guest) addDiner(oid, 'resident', x.host ?? firstResident, true, { guestName: x.guest.name, guestRel: x.guest.rel });
      else if (x.residentId) addDiner(oid, 'resident', x.residentId, false);
    }
    if (seating) {
      const t = now();
      patchReservation(seating.id, { seatedAt: t, orderId: oid, seatedTable: pick.id, server });
      toast(`${partyName(seating)} seated at ${pick.label}, ${seatedDelta(seating, t)} for ${hm(seating.time)}`, { tone: 'success' });
    }
    closePanel();
  };

  /** Cancel and no-show are one tap with an undo, so a slip costs nothing. */
  const act = (k: ResvAction, r: Reservation) => {
    const was = { cancelledAt: r.cancelledAt, noShowAt: r.noShowAt };
    const label = `${partyName(r)} at ${hm(r.time)}`;
    const undo = { label: 'Undo', onClick: () => patchReservation(r.id, was) };
    if (k === 'restore') {
      patchReservation(r.id, { cancelledAt: undefined, noShowAt: undefined });
      toast(`Restored ${label}`, { action: undo });
    } else if (k === 'cancel') {
      patchReservation(r.id, { cancelledAt: now() });
      toast(`Cancelled ${label}${r.remind ? textedNote(textReservation(r, 'resvCancel')) : ''}`, { action: undo });
    } else {
      patchReservation(r.id, { noShowAt: now() });
      toast(`No-show: ${label}`, { action: undo });
    }
  };

  /** A moved booking with reminders on tells everyone on it; the reminder goes again before the new time. */
  const save = (r: Reservation) => {
    const was = form?.r;
    const moved = !!was && r.remind && (was.date !== r.date || was.time !== r.time);
    const texted = moved ? textReservation(r, 'resvChange') : 0;
    putReservation(r);
    setForm(null);
    setDay(r.date);
    setMeal(r.meal);
    toast(`${was ? 'Saved' : 'Booked'} ${partyName(r)}, party of ${r.size}, ${dayWord(r.date)} at ${hm(r.time)}${moved ? textedNote(texted) : ''}`, { tone: 'success' });
    setTimeout(() => sendDueReminders(), 0);
  };

  const held = pick && !seating ? heldFor(pick.id, venue, book, at) : null;

  return (
    <div className={s.wrap}>
      {pick && tab === 'floor' && (
        <SeatPanel
          table={pick}
          checks={checksAt(here, pick.id)}
          servers={servers}
          server={server}
          onServer={setServer}
          seats={seats}
          onSeats={setSeats}
          reservation={seating}
          onDropReservation={() => {
            setSeating(null);
            setSeats([]);
          }}
          heldFor={held}
          seatedAt={(rid) => seatedAt(live, rid)}
          onSeatHeld={seatReservation}
          at={at}
          name={name}
          labelOf={labelOf}
          onOpen={onOpen}
          onSeat={seat}
          onClose={closePanel}
        />
      )}
      <div className={s.main}>
        <div className={s.top}>
          <HostTabs value={tab} onChange={goTab} due={due} />
          {tab === 'floor' &&
            (seating ? (
              <span className={s.seating} role="status">
                {pick ? 'Seating' : 'Tap a table for'} {partyName(seating)}, party of {seating.size}
                <Button onClick={closePanel}>
                  Stop seating
                </Button>
              </span>
            ) : (
              <span className={s.hint}>
                Tap a table to seat a party. Open checks show in their server’s colour.
                <span className={s.keys}>
                  <span className={s.key}>
                    <span className={cx(s.swatch, s.swHeld)} />
                    Held for a booking
                  </span>
                  <span className={s.key}>
                    <span className={cx(s.swatch, s.swLate)} />
                    Booking is late
                  </span>
                </span>
              </span>
            ))}
          {tab === 'floor' && (
            <span className={s.legend}>
              <ServerLegend servers={servers} />
            </span>
          )}
        </div>
        {tab === 'floor' ? (
          <div className={s.planScroll}>
            <FloorPlan
              plan={plan}
              minHeight={380}
              tile={(t, box) => (
                <FloorTile
                  key={t.id}
                  table={t}
                  box={box}
                  checks={checksAt(here, t.id)}
                  held={heldFor(t.id, venue, book, at)}
                  at={at}
                  selected={pick?.id === t.id}
                  name={name}
                  onPick={() => choose(t)}
                />
              )}
            />
          </div>
        ) : (
          <ReservationList
            room={venue}
            list={book}
            live={live}
            at={at}
            day={day}
            setDay={setDay}
            meal={meal}
            setMeal={setMeal}
            labelOf={labelOf}
            name={name}
            onSeat={seatReservation}
            onEdit={(r) => setForm({ r })}
            onNew={() => setForm({})}
            onOpen={onOpen}
            onAct={act}
          />
        )}
      </div>
      {confirmDialog}
      {form && <ReservationForm plan={plan} init={form.r} list={book} day={day} meal={meal} onClose={() => setForm(null)} onSave={save} />}
    </div>
  );
}
