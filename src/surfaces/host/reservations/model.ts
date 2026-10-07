/**
 * Dining room reservations.
 *
 * A reservation is a party, a day, a meal and a 15 minute slot, with an
 * optional table. Seating one runs the host's own seating flow, so the check
 * opens for the server exactly as a walk-in's does, and the moment it opens
 * is kept as the seated time.
 */
import { getResident, getTable } from '../../../data';
import type { MealName } from '../../../domain/types';
import { DAY, MINUTE, startOfToday, today } from '../../../lib/clock';
import { guestOnFile } from './contacts';

export const RESV_MEALS: MealName[] = ['Breakfast', 'Lunch', 'Dinner'];

/**
 * The dining room hours the order screen shows: 7–9 AM, 11:30–1:30 and
 * 5–7 PM, in minutes from midnight. The last slot is 15 minutes before close.
 */
export const RESV_HOURS: Record<MealName, [number, number]> = {
  Breakfast: [420, 540],
  Lunch: [690, 810],
  Dinner: [1020, 1140],
};

/**
 * Due within 15 minutes is arriving soon. A table carries its reservation
 * from an hour before until 30 minutes late. Tables turn in about 90
 * minutes, so two bookings closer than that on one table clash.
 */
export const RESV_SOON = 15;
export const RESV_AHEAD = 60;
export const RESV_HOLD = 30;
export const RESV_TURN = 90;

/** One-tap notes the host can add. */
export const RESV_NOTES = ['Birthday', 'Anniversary', 'Wheelchair', 'Walker', 'High chair', 'Quiet table'];

/** Someone on a reservation: a resident, a guest on file, or a typed-in guest. */
export interface ResvPerson {
  /** Resident id. */
  rid?: string;
  /** Guest on file id. */
  gid?: string;
  /** Guest name. */
  guest?: string;
  /** "Daughter", "Friend", "Guest" ... */
  rel?: string;
  /** Resident the guest is visiting. */
  host?: string | null;
}

export interface Reservation {
  id: string;
  room: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** Minutes from midnight. */
  time: number;
  meal: MealName;
  size: number;
  people: ResvPerson[];
  tableId: string | null;
  notes: string;
  /** Text everyone with a mobile an hour before. */
  remind: boolean;
  remindedAt?: number;
  /** How many people the reminder reached. */
  remindedTo?: number;
  createdAt: number;
  cancelledAt?: number;
  noShowAt?: number;
  seatedAt?: number;
  seatedTable?: string;
  orderId?: string;
  server?: string;
}

export type ResvStatus = 'booked' | 'soon' | 'late' | 'seated' | 'noshow' | 'cancelled';

export const RESV_STATUS_LABEL: Record<ResvStatus, string> = {
  booked: 'Booked',
  soon: 'Arriving soon',
  late: 'Late',
  seated: 'Seated',
  noshow: 'No-show',
  cancelled: 'Cancelled',
};

// ─── Days and times ──────────────────────────────────────────────────────

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today plus k days, on the demo clock. */
export function dayFromToday(k: number): string {
  return dayKey(new Date(startOfToday() + k * DAY + 12 * 60 * MINUTE));
}

export function dayLabel(k: string): string {
  if (k === dayFromToday(0)) return 'Today';
  if (k === dayFromToday(1)) return 'Tomorrow';
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "today", "tomorrow", or "Thu, Oct 9". */
export function dayWord(k: string): string {
  const l = dayLabel(k);
  return l === 'Today' || l === 'Tomorrow' ? l.toLowerCase() : l;
}

/** 1020 → "5:00" */
export function hm(t: number): string {
  const h = Math.floor(t / 60) % 24;
  return `${h % 12 || 12}:${String(t % 60).padStart(2, '0')}`;
}

/** 1020 → "5:00 PM" */
export function hmAmPm(t: number): string {
  return `${hm(t)} ${Math.floor(t / 60) % 24 < 12 ? 'AM' : 'PM'}`;
}

/** A timestamp's clock time, "5:04". */
export function clockOf(ms: number): string {
  const d = new Date(ms);
  return hm(d.getHours() * 60 + d.getMinutes());
}

/** Minutes since midnight now, on the demo clock. */
export function nowMinutes(): number {
  const d = today();
  return d.getHours() * 60 + d.getMinutes();
}

export function mealAtMinutes(t: number): MealName {
  return t < 630 ? 'Breakfast' : t < 900 ? 'Lunch' : 'Dinner';
}

/** Every bookable 15 minute slot of a meal. */
export function mealSlots(meal: MealName): number[] {
  const [a, b] = RESV_HOURS[meal];
  const out: number[] = [];
  for (let t = a; t < b; t += 15) out.push(t);
  return out;
}

/** When the reservation is for (ms). */
export function resvAt(r: Pick<Reservation, 'date' | 'time'>): number {
  const [y, m, d] = r.date.split('-').map(Number);
  return new Date(y, m - 1, d, 0, r.time).getTime();
}

// ─── Status ──────────────────────────────────────────────────────────────

/** Still to come: not cancelled, not a no-show, not seated. */
export function isOpen(r: Reservation): boolean {
  return !r.cancelledAt && !r.noShowAt && !r.seatedAt;
}

export function resvStatus(r: Reservation, at: number): ResvStatus {
  if (r.cancelledAt) return 'cancelled';
  if (r.noShowAt) return 'noshow';
  if (r.seatedAt) return 'seated';
  const d = resvAt(r) - at;
  return d < 0 ? 'late' : Math.round(d / MINUTE) <= RESV_SOON ? 'soon' : 'booked';
}

/** "on time", "19 min late", "5 min early" (seated time against the booking). */
export function seatedDelta(r: Reservation, seatedAt: number = r.seatedAt ?? 0): string {
  const m = Math.floor((seatedAt - resvAt(r)) / MINUTE);
  return m === 0 ? 'on time' : `${Math.abs(m)} min ${m > 0 ? 'late' : 'early'}`;
}

// ─── Names ───────────────────────────────────────────────────────────────

export function personName(p: ResvPerson | undefined): string {
  if (p?.rid) return getResident(p.rid)?.name ?? 'Resident';
  return p?.guest || 'Guest';
}

/** "Mildred Vanholder +5" */
export function partyName(r: Pick<Reservation, 'people'>): string {
  const ps = r.people;
  return ps.length ? personName(ps[0]) + (ps.length > 1 ? ` +${ps.length - 1}` : '') : 'Guest';
}

/** The lead's last name, for tight spots like a table tile. */
export function partyLast(r: Pick<Reservation, 'people'>): string {
  return personName(r.people[0]).split(' ').slice(-1)[0];
}

/** "Mildred Vanholder, Anne Vanholder (Daughter), Joan Petrovic" */
export function partyList(r: Pick<Reservation, 'people'>): string {
  return r.people
    .map((p) => personName(p) + (p.guest && p.rel && p.rel !== 'Guest' ? ` (${p.rel})` : p.guest ? ' (guest)' : ''))
    .join(', ');
}

export function tableLabel(id: string | null | undefined, labelOf: (id: string) => string | undefined = (x) => getTable(x)?.label): string {
  return id ? (labelOf(id) ?? '') : '';
}

// ─── Tables ──────────────────────────────────────────────────────────────

/** Other open bookings on the same table within one table turn. */
export function clashes(r: Pick<Reservation, 'id' | 'room' | 'date' | 'time' | 'tableId'> & { open?: boolean }, list: Reservation[]): Reservation[] {
  if (!r.tableId || r.time == null || r.open === false) return [];
  const a = resvAt(r);
  return list.filter((x) => x.id !== r.id && x.room === r.room && x.tableId === r.tableId && isOpen(x) && Math.abs(resvAt(x) - a) < RESV_TURN * MINUTE);
}

/** The reservation a table is being kept for right now, if any. */
export function heldFor(tableId: string, room: string, list: Reservation[], at: number): Reservation | null {
  return (
    list
      .filter((r) => r.room === room && r.tableId === tableId && isOpen(r) && resvAt(r) - at <= RESV_AHEAD * MINUTE && at - resvAt(r) <= RESV_HOLD * MINUTE)
      .sort((a, b) => resvAt(a) - resvAt(b))[0] ?? null
  );
}

/** Someone the host is about to seat: a resident, or a guest of one. */
export interface SeatEntry {
  name: string;
  residentId: string | null;
  guest?: { name: string; rel: string };
  /** The resident a guest is seated against. */
  host?: string | null;
}

/** The party as the host's seat list: residents as themselves, guests as guests of the first resident. */
export function seatsFor(r: Reservation): SeatEntry[] {
  const host = r.people.find((p) => p.rid)?.rid ?? null;
  return r.people.flatMap((p): SeatEntry[] => {
    if (p.rid) {
      const x = getResident(p.rid);
      return x ? [{ name: x.name, residentId: x.id }] : [];
    }
    const g = guestOnFile(p.gid);
    const name = p.guest || g?.name || 'Guest';
    return [{ name, residentId: null, guest: { name, rel: p.rel || 'Guest' }, host: p.host ?? host }];
  });
}

/** "4 parties, 12 guests, 1 seated" summary counts for a meal. */
export function mealSummary(rows: Reservation[]): { parties: number; covers: number; seated: number } {
  const active = rows.filter((r) => !r.cancelledAt && !r.noShowAt);
  return { parties: active.length, covers: active.reduce((n, r) => n + (r.size || 0), 0), seated: rows.filter((r) => r.seatedAt).length };
}
