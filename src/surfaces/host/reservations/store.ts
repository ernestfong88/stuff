/**
 * The reservation book, shared by every host tablet and kept for the day.
 * A new day starts from a fresh demo book, laid around the clock so it
 * always has someone due, someone late and someone already seated.
 */
import { useEffect } from 'react';
import { dinerName } from '../../../domain/orders';
import type { Order } from '../../../domain/types';
import { MINUTE, now, startOfToday, DAY } from '../../../lib/clock';
import { createSharedStore, useShared } from '../../../lib/sharedStore';
import { useDiningOrders } from '../../../store/dining';
import { GUESTS_ON_FILE, textParty, type ResvTextKind } from './contacts';
import { dayFromToday, dayKey, dayWord, hmAmPm, isOpen, mealAtMinutes, nowMinutes, resvAt, RESV_HOURS, type Reservation, type ResvPerson } from './model';
import { seedItems } from '../../../store/floorLayout';

interface Book {
  /** The day the book was started; another day starts a fresh one. */
  day: string;
  list: Reservation[];
}

export const reservationStore = createSharedStore<Book | null>(null, {
  persistKey: 'kisco_host_resv_v1',
  channel: 'kisco-host-resv',
});

const R = (rid: string): ResvPerson => ({ rid });

/** A guest on file by name, or a typed-in guest. */
function G(guest: string, rel: string, host: string): ResvPerson {
  const g = GUESTS_ON_FILE.find((x) => x.name === guest);
  return g ? { gid: g.id, guest: g.name, rel: g.rel, host: g.host } : { guest, rel, host };
}

/**
 * The demo book: one party already seated (late) on a check open now, one
 * late and not here, a couple due any minute, a birthday party of six within
 * the hour, a family visit with guests later, a no-show and a cancellation,
 * the other meal of the day, and two for tomorrow. All in the main room.
 */
export function seedReservations(live: Order[], at: number = now()): Reservation[] {
  const M = MINUTE;
  const Q = 15 * M;
  const up = Math.ceil((at + M) / Q) * Q;
  const dn = Math.floor(at / Q) * Q;
  const t0 = startOfToday();
  const day = (offset: number, mins: number) => {
    const d = new Date(t0 + offset * DAY + 12 * 60 * M);
    d.setHours(0, mins, 0, 0);
    return d.getTime();
  };
  const last = day(0, RESV_HOURS[mealAtMinutes(nowMinutes())][1] - 15);
  const cap = (ms: number) => Math.min(ms, Math.max(up, last), day(0, 1425));
  const out: Reservation[] = [];
  let k = 0;
  const add = (ms: number, o: Partial<Reservation> & { people: ResvPerson[] }) => {
    const d = new Date(ms);
    const t = d.getHours() * 60 + d.getMinutes();
    out.push({
      id: `rv${++k}`,
      room: 'sequoia',
      date: dayKey(d),
      time: t,
      meal: mealAtMinutes(t),
      size: o.people.length || 1,
      tableId: null,
      notes: '',
      remind: false,
      createdAt: at - 26 * 60 * M,
      ...o,
    });
  };

  const tables = seedItems('sequoia').map((t) => t.id);
  const seated = live
    .filter((x) => !x.queueType && x.tableId && tables.includes(x.tableId) && x.diners.some((d) => d.kind === 'resident' && !d.isGuest))
    .filter((x) => at - x.openedAt >= 15 * M && at - x.openedAt <= 75 * M)
    .sort((a, b) => b.openedAt - a.openedAt)[0];
  if (seated) {
    add(Math.floor((seated.openedAt - 5 * M) / Q) * Q, {
      people: seated.diners.filter((d) => d.kind === 'resident').map((d) => (d.isGuest ? G(dinerName(d), String(d.guestRel || 'Guest'), d.refId) : R(d.refId))),
      tableId: seated.tableId ?? null,
      seatedAt: seated.openedAt,
      seatedTable: seated.tableId,
      orderId: seated.id,
      server: seated.server,
    });
  }
  add(dn - 15 * M, { people: [R('r3'), G('Jim Carver', 'Friend', 'r3')], tableId: 't_eg8', notes: 'Uses a walker' });
  add(cap(up), { people: [R('r23'), R('r24')], tableId: 't_eg6', notes: 'Quiet table, both wear hearing aids', remind: true });
  add(cap(up + 45 * M), {
    people: [R('r8'), G('Anne Vanholder', 'Daughter', 'r8'), G('Peter Vanholder', 'Son', 'r8'), G('Claire Vanholder', 'Daughter-in-law', 'r8'), G('Sophie Vanholder', 'Great-granddaughter', 'r8'), R('r6')],
    tableId: 't_sq16',
    notes: 'Birthday, Mildred turns 90. The family is bringing a cake, candle with dessert. High chair for Sophie.',
    remind: true,
  });
  add(cap(up + 90 * M), {
    people: [R('r2'), G('Paul Whitfield', 'Son', 'r2'), G('Kim Whitfield', 'Daughter-in-law', 'r2'), G('Lucy Whitfield', 'Granddaughter', 'r2')],
    size: 5,
    notes: 'Family visit. Wheelchair, Eleanor needs an aisle spot. Paul is bringing a friend.',
    remind: true,
  });
  add(dn - 60 * M, { people: [R('r15'), R('r19')], tableId: 't_eg11', noShowAt: dn - 30 * M });
  add(cap(up + 60 * M), {
    people: [R('r18'), G('Mary Whitaker', 'Sister', 'r18')],
    tableId: 't_sq7',
    cancelledAt: at - 2 * 60 * M,
    notes: 'Her sister’s flight is delayed, she will rebook.',
  });
  if (mealAtMinutes(nowMinutes()) === 'Dinner') {
    add(day(0, 705), { people: [R('r13'), R('r20')], tableId: 't_eg12', seatedAt: day(0, 703), seatedTable: 't_eg12', server: 'RJ' });
    add(day(0, 735), {
      people: [R('r16'), G('Kevin Flynn', 'Son', 'r16'), G('Emma Flynn', 'Granddaughter', 'r16')],
      tableId: 't_sq14',
      seatedAt: day(0, 751),
      seatedTable: 't_sq14',
      server: 'AA',
      notes: 'Emma is visiting from college',
    });
    add(day(0, 750), { people: [R('r17')], size: 2, tableId: 't_eg6', cancelledAt: day(0, 600), notes: 'Doctor’s appointment ran over' });
  } else {
    add(day(0, 1020), { people: [R('r20'), R('r12')], tableId: 't_eg12' });
    add(day(0, 1050), { people: [R('r21'), G('Patricia Whitman', 'Daughter', 'r21'), G('Mark Whitman', 'Son', 'r21')], size: 4, tableId: 't_sq14', notes: 'Anniversary. Mark’s wife is joining them.' });
    add(day(0, 1080), { people: [R('r14')], size: 2, notes: 'Wheelchair' });
  }
  add(day(1, 720), { people: [R('r22'), G('Ellen Hale', 'Niece', 'r22')], tableId: 't_sq7' });
  add(day(1, 1050), { people: [R('r13'), G('James Bellamy', 'Son', 'r13'), G('Rita Bellamy', 'Daughter-in-law', 'r13')], notes: 'Anniversary' });
  return out;
}

// ─── Changes ─────────────────────────────────────────────────────────────

function update(fn: (list: Reservation[]) => Reservation[]): void {
  reservationStore.set((b) => (b ? { ...b, list: fn(b.list) } : b));
}

export function patchReservation(id: string, patch: Partial<Reservation>): void {
  update((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

/** Add a new reservation or replace an edited one. */
export function putReservation(r: Reservation): void {
  update((list) => (list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r]));
}

/** Text everyone on it about a reservation; returns how many were texted. */
export function textReservation(r: Reservation, kind: ResvTextKind): number {
  return textParty({ id: r.id, room: r.room, meal: r.meal, time: hmAmPm(r.time), day: dayWord(r.date), people: r.people }, kind);
}

/** Reminders go an hour before, once, to everyone with a mobile. */
export function sendDueReminders(at: number = now()): void {
  const book = reservationStore.get();
  if (!book) return;
  for (const r of book.list) {
    if (!r.remind || r.remindedAt || !isOpen(r)) continue;
    const d = resvAt(r) - at;
    if (d < 0 || d > 60 * MINUTE) continue;
    patchReservation(r.id, { remindedAt: at, remindedTo: textReservation(r, 'resvRemind') });
  }
}

/** The day's reservations; starts the book and the reminder clock on first use. */
export function useReservations(): Reservation[] {
  const book = useShared(reservationStore);
  const orders = useDiningOrders();
  const today = dayFromToday(0);
  useEffect(() => {
    // Seeded once per day: once the book is current, floor changes leave it alone.
    reservationStore.set((b) => (b && b.day === today ? b : { day: today, list: seedReservations(orders) }));
  }, [today, orders]);
  useEffect(() => {
    sendDueReminders();
    const id = setInterval(() => sendDueReminders(), 15_000);
    return () => clearInterval(id);
  }, []);
  return book && book.day === today ? book.list : [];
}
