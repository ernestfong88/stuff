/**
 * Pick up and delivery: promised times, when the kitchen fires, and the
 * stage each order is at on the PU & Delivery list.
 *
 * Each promised time is a 15 minute range. The kitchen fires about
 * pickupLeadMinutes() before the range starts so the order is ready at the
 * start of it.
 */
import { getItem } from '../data';
import { DAY, MINUTE, now, today } from '../lib/clock';
import { addDays, isoOf } from '../lib/dates';
import { formatMinuteOfDay } from '../lib/format';
import { DEFAULT_CONFIG, type DiningConfig } from './config';
import { courseSummaries, normalizeOrder } from './courses';
import { isSide, serverItemName } from './menu';
import { QUEUE_TYPE_LABELS, dinerName, dinerPerson } from './orders';
import type { Order } from './types';

/** gh: "4:15 PM" → that time today on the demo clock (ms), or null. */
export function parseClockTime(label: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(label || '');
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  const d = today();
  d.setHours(h, min, 0, 0);
  return d.getTime();
}

/** __kPudLbl: ms → "4:15 PM". */
export function clockLabel(ts: number): string {
  const d = new Date(ts);
  return formatMinuteOfDay(d.getHours() * 60 + d.getMinutes());
}

/** __kPudSlot: the quarter hour nearest to `minutes` from now, kept within today 12:15 AM – 11:30 PM. */
export function quarterHourSlot(minutes: number): number {
  const lo = today();
  lo.setHours(0, 15, 0, 0);
  const hi = today();
  hi.setHours(23, 30, 0, 0);
  return Math.max(lo.getTime(), Math.min(hi.getTime(), Math.round((now() + minutes * MINUTE) / 900_000) * 900_000));
}

/** Me: "YYYY-MM-DD" for today plus `days` on the demo clock. */
export function isoDate(days = 0): string {
  return isoOf(addDays(today(), days));
}

/** __kDayOff: how many days ahead an order is booked for (0 = today). */
export function dayOffset(o: Pick<Order, 'forDate'> | null | undefined): number {
  if (!o?.forDate) return 0;
  const d = Math.round(
    (new Date(o.forDate + 'T12:00:00').getTime() - new Date(isoDate(0) + 'T12:00:00').getTime()) / DAY,
  );
  return d > 0 ? d : 0;
}

/**
 * A later day as staff say it: "Tomorrow", or "Fri 10/10" further out; ""
 * for today (or a day gone by). Pick up and delivery orders booked ahead
 * show it on the order, the PU & Delivery list and the kitchen screens.
 */
export function aheadDayLabel(date: string | null | undefined): string {
  if (!date) return '';
  const ahead = dayOffset({ forDate: date });
  if (ahead <= 0) return '';
  if (ahead === 1) return 'Tomorrow';
  const d = new Date(date + 'T12:00:00');
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getMonth() + 1}/${d.getDate()}`;
}

/** The day an order is booked for, as aheadDayLabel says it ("" for today). */
export const orderAheadLabel = (o: Pick<Order, 'forDate'> | null | undefined): string => aheadDayLabel(o?.forDate);

/** "tomorrow " / "Fri 10/10 " before a clock time on a later day, or "" for today. */
export function dayBefore(ts: number): string {
  const label = aheadDayLabel(isoOf(ts));
  return label ? (label === 'Tomorrow' ? 'tomorrow ' : label + ' ') : '';
}

/** Ticket times (minutes from fire to up at the pass) over the last seven dinners. */
export const WEEK_TICKET_MINUTES = [12.4, 13.6, 11.8, 12.9, 14.2, 12.1, 12.8];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Cook-line ticket times on one check, in minutes. */
export function ticketMinutes(o: Order, cfg: DiningConfig = DEFAULT_CONFIG): number[] {
  return courseSummaries(normalizeOrder(o), cfg)
    .filter((x) => x.kds && x.fired && x.ready)
    .map((x) => (x.ready! - x.fired!) / MINUTE);
}

/** __kTicketAvg: tonight's average ticket time once there are 3 tickets, else last week's. */
export function ticketAverage(orders: Order[], cfg: DiningConfig = DEFAULT_CONFIG): { v: number; live: boolean } {
  const ticks = orders.filter((o) => o && o.diners).flatMap((o) => ticketMinutes(o, cfg));
  return ticks.length >= 3 ? { v: mean(ticks), live: true } : { v: mean(WEEK_TICKET_MINUTES), live: false };
}

/**
 * __kPudLead: minutes before the promised time the kitchen fires: the
 * average ticket plus packing, rounded up to 5 minutes, at least 10.
 * @param orders open checks and today's history
 */
export function pickupLeadMinutes(orders: Order[], cfg: DiningConfig = DEFAULT_CONFIG): number {
  return Math.max(10, Math.ceil((ticketAverage(orders, cfg).v + cfg.pickupPackMinutes) / 5) * 5);
}

/** hi: when a pick up / delivery fires (null for dine-in or no promised time). */
export function pickupFireAt(o: Order, leadMinutes: number): number | null {
  if (o.queueType !== 'pickup' && o.queueType !== 'delivery') return null;
  const t = parseClockTime(o.readyAt);
  return t ? t + dayOffset(o) * DAY - leadMinutes * MINUTE : null;
}

/** __kPudDue: the promised time (or when the order was opened). */
export function pickupDue(o: Order): number {
  const t = parseClockTime(o.readyAt);
  return t ? t + dayOffset(o) * DAY : o.openedAt;
}

export type PickupStage = 'draft' | 'scheduled' | 'cooking' | 'ready' | 'waiting' | 'out' | 'done';

/**
 * __kPudStage: the one thing the order needs next. `kitchenMode` "printers"
 * means there is no kitchen screen to bump, so a sent order counts as ready.
 */
export function pickupStage(o: Order, kitchenMode?: string): PickupStage {
  const lines = o.diners.flatMap((d) => d.items).filter((x) => !x.cancelled && !x.comped);
  const sent = lines.filter((x) => x.sent);
  if (o.deliveredAt) return 'done';
  if (!sent.length) return 'draft';
  if (o.notified) return o.queueType === 'delivery' ? 'out' : 'waiting';
  if (sent.every((x) => x.kitchenState === 'scheduled')) return 'scheduled';
  // Ready the way Expo judges it: by the plates (sides go with them), so both screens agree.
  const plates = sent.filter((x) => !isSide(x.itemId));
  const judged = plates.length ? plates : sent;
  return kitchenMode === 'printers' || judged.every((x) => x.kitchenState === 'ready' || x.kitchenState === 'cleared')
    ? 'ready'
    : 'cooking';
}

/** __kPudWho: "Ruth Bell", "Ruth & Harold Bell", or "New pick up order". */
export function pickupWho(o: Order): string {
  const names = o.diners.map((d) => dinerName(d)).filter((x) => x && x !== 'Guest');
  if (!names.length) return `New ${QUEUE_TYPE_LABELS[o.queueType ?? 'pickup'].toLowerCase()} order`;
  if (names.length === 1) return names[0];
  const last = names[0].split(' ').slice(-1)[0];
  return names.every((x) => x.split(' ').slice(-1)[0] === last)
    ? names.map((x) => x.split(' ')[0]).join(' & ') + ' ' + last
    : names.join(', ');
}

/** __kPudApt: the first diner's apartment. */
export function pickupApt(o: Order): string {
  const d = o.diners[0];
  const p = d ? dinerPerson(d) : undefined;
  return (p && 'apt' in p && p.apt) || '';
}

/** __kPudItems: "Pork Chop, Fries, Coke" */
export function pickupItems(o: Order, cfg: DiningConfig = DEFAULT_CONFIG): string {
  return o.diners
    .flatMap((d) => d.items)
    .filter((x) => !x.cancelled)
    .map((x) => {
      const it = getItem(x.itemId);
      return it ? (typeof x.ver === 'string' && x.ver) || serverItemName(it.name, cfg) : '';
    })
    .filter(Boolean)
    .join(', ');
}

/** __kPudAgo: whole minutes since ts (never negative). */
export function minutesAgo(ts: number): number {
  return Math.max(0, Math.round((now() - ts) / MINUTE));
}

/** __kPudIn: a span as "45m", "1h" or "1h 5m" (sign ignored). */
export function spanLabel(ms: number): string {
  const m = Math.round(Math.abs(ms) / MINUTE);
  return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '');
}

/** Every booking is a 15 minute range; readyAt is its start. */
export const PICKUP_RANGE_MINUTES = 15;

/** Whole minutes from a to b as the clock shows them (4:36:50 to 4:45:00 is 9, the same as 4:36 to 4:45). */
export const clockMinutes = (from: number, to: number): number => Math.floor(to / MINUTE) - Math.floor(from / MINUTE);

/**
 * __kPudLate: minutes late (0 or less = on time). The promise is the booked
 * range, so anything inside it is on time and lateness counts from its end.
 * A pick up is on time when it was ready within the range; how long the
 * resident takes to come is not the kitchen's. A delivery is on time when it
 * reached the door within the range. Minutes are the clock minutes shown on
 * screen, so "booked 1:15 to 1:30, delivered 1:40" is 10m late.
 */
export function pickupLateMinutes(o: Order): number {
  const start = parseClockTime(o.readyAt);
  if (!start) return 0;
  const at =
    o.queueType === 'pickup' ? o.readyStampAt || o.deliveredAt || o.closedAt : o.deliveredAt || o.closedAt;
  return clockMinutes(start + PICKUP_RANGE_MINUTES * MINUTE, at ?? 0);
}
