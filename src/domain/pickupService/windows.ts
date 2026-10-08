/**
 * Pick up and delivery windows.
 *
 * Every booking is a 15 minute range such as 5:00 to 5:15 PM. Back Office
 * ticks the ranges each venue offers for resident pick up, associate pick up
 * and delivery; nothing else is held back. A booked time is stored as the
 * start of its range ("5:00 PM"), and the kitchen fires early enough, from
 * the average ticket time plus packing, for the order to be ready when the
 * range starts.
 *
 * A venue can also cap how many orders one range takes: a total across all
 * three types, since it is the kitchen's capacity, and optionally a cap per
 * type. Both apply. 0 or blank is no limit.
 *
 * Times inside a day are minutes from midnight (1020 = 5:00 PM). The NOC
 * (overnight) shift runs past midnight, so its ranges are kept as minutes
 * from the service day's midnight: 2:00 AM is 1560.
 *
 * Everything here is pure; pass the `win` section of the service settings.
 */
import type { AssocMeal, MealName, Order } from '../types';
import { mealSpans } from '../mealPeriods';

export type WindowType = 'pickup' | 'assoc' | 'delivery';

export const WINDOW_TYPES: ReadonlyArray<{ id: WindowType; label: string; hint: string }> = [
  {
    id: 'pickup',
    label: 'Resident pick up',
    hint: 'Residents and family picking up at the venue, booked by a server or the pick up screen.',
  },
  { id: 'assoc', label: 'Associate pick up', hint: 'Associate App meals. A range already booked today stays open.' },
  { id: 'delivery', label: 'Delivery', hint: 'Delivered to the apartment.' },
];

/** Ranges can be offered from 6:00 AM to 10:00 PM. */
export const WINDOW_DAY: readonly [number, number] = [360, 1320];

/** The part of the day each meal's ranges fall in: the meal served at the range's start (see domain/mealPeriods). */
export const MEAL_WINDOWS: Record<MealName, readonly [number, number]> = mealSpans(WINDOW_DAY[0], WINDOW_DAY[1]);

/** Offered ranges until Back Office changes them: [from, to) per type. */
const DEFAULT_SPANS: Record<WindowType, Array<[number, number]>> = {
  pickup: [
    [450, 570],
    [660, 810],
    [990, 1200],
  ],
  assoc: [
    [660, 810],
    [990, 1170],
  ],
  delivery: [
    [450, 570],
    [660, 810],
    [990, 1200],
  ],
};

/** NOC ranges can be offered from 10:00 PM to 6:00 AM the next morning. */
export const NOC_DAY: readonly [number, number] = [1320, 1800];
const NOC_DEFAULT: readonly [number, number] = [1380, 1560];

/** Sequoia starts capped at 4 orders a range, so the demo has full ranges tonight. */
const DEFAULT_CAPS: Record<string, Partial<WindowCaps>> = { sequoia: { total: 4 } };

export interface WindowCaps {
  total: number;
  pickup: number;
  assoc: number;
  delivery: number;
}

/** The `win` section of the service settings, as Back Office saves it. */
export interface WindowSettings {
  /** Minutes before a range starts that it stops taking orders. */
  cut?: number;
  types?: Partial<Record<WindowType, { on?: boolean }>>;
  /** Offered range starts per venue and type (plus "noc"). */
  grid?: Record<string, Partial<Record<WindowType | 'noc', number[]>>>;
  cap?: Record<string, Partial<Record<keyof WindowCaps, number>> | null>;
  /** Minute of the day the dinner line has NOC meals made by. */
  nocBy?: number;
}

const spanStarts = ([a, b]: readonly [number, number]) => {
  const out: number[] = [];
  for (let s = a; s < b; s += 15) out.push(s);
  return out;
};

/** Whether this type books a range (associate meals always do). */
export function windowTypeOn(w: WindowSettings, type: WindowType): boolean {
  return type === 'assoc' || w.types?.[type]?.on !== false;
}

/** Default range starts for a type. */
export function defaultWindowStarts(type: WindowType): number[] {
  return DEFAULT_SPANS[type].flatMap(spanStarts);
}

/** Range starts a venue offers for a type, sorted. */
export function windowStarts(w: WindowSettings, room: string, type: WindowType): number[] {
  const g = w.grid?.[room]?.[type];
  if (!Array.isArray(g)) return defaultWindowStarts(type);
  return g.filter((s) => Number.isInteger(s) && s % 15 === 0 && s >= WINDOW_DAY[0] && s < WINDOW_DAY[1]).sort((a, b) => a - b);
}

/** NOC range starts a venue offers (minutes from the service day's midnight). */
export function nocStarts(w: WindowSettings, room: string): number[] {
  const g = w.grid?.[room]?.noc;
  if (!Array.isArray(g)) return spanStarts(NOC_DEFAULT);
  return g.filter((s) => Number.isInteger(s) && s % 15 === 0 && s >= NOC_DAY[0] && s < NOC_DAY[1]).sort((a, b) => a - b);
}

/** Minutes before a range that it closes (45 by default). */
export function windowCutoff(w: WindowSettings): number {
  return w.cut != null && Number.isFinite(+w.cut) ? +w.cut : 45;
}

/** Minute of the day the dinner line makes NOC meals by (8:00 PM by default). */
export function nocMadeBy(w: WindowSettings): number {
  return w.nocBy != null && Number.isFinite(+w.nocBy) ? +w.nocBy : 1200;
}

/** Order caps per range at a venue; 0 is no limit. */
export function windowCaps(w: WindowSettings, room: string): WindowCaps {
  const own = w.cap?.[room];
  const src = own === undefined ? (DEFAULT_CAPS[room] ?? {}) : (own ?? {});
  const one = (v: unknown) => {
    const n = Number(v);
    return n > 0 ? Math.floor(n) : 0;
  };
  return { total: one(src.total), pickup: one(src.pickup), assoc: one(src.assoc), delivery: one(src.delivery) };
}

// ─── Labels ──────────────────────────────────────────────────────────────

/** 1020 → "5:00 PM" (wraps past midnight for NOC ranges). */
export function minuteLabel(v: number): string {
  const h = Math.floor(v / 60) % 24;
  const m = v % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** 1020 → "5:00 to 5:15 PM"; 705 → "11:45 AM to 12:00 PM". */
export function rangeLabel(start: number): string {
  const a = minuteLabel(start);
  const b = minuteLabel(start + 15);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} to ${b}` : `${a} to ${b}`;
}

/**
 * "5:00 PM" → 1020. Times before 6:00 AM belong to the NOC shift of the
 * service day, so they count past midnight (2:00 AM → 1560).
 */
export function windowMinute(label: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(label ?? '');
  if (!m) return null;
  let h = +m[1] % 12;
  if (m[3] === 'PM') h += 12;
  const v = h * 60 + +m[2];
  return v < 360 ? v + 1440 : v;
}

/** "5:00 PM" → "5:00 to 5:15 PM" (anything else comes back as given). */
export function rangeOf(label: string | null | undefined): string {
  const v = windowMinute(label);
  return v == null ? (label ?? '') : rangeLabel(v);
}

/** A NOC (overnight associate) range. */
export function isNocWindow(label: string | null | undefined): boolean {
  const v = windowMinute(label);
  return v != null && v >= NOC_DAY[0];
}

export interface WindowSlot {
  /** Start, minutes from midnight. */
  start: number;
  /** "5:00 PM" */
  at: string;
}

/** The ranges a venue offers for one meal and type. */
export function mealWindows(w: WindowSettings, type: WindowType, room: string, meal: MealName): WindowSlot[] {
  const b = MEAL_WINDOWS[meal];
  if (!b) return [];
  return windowStarts(w, room, type)
    .filter((s) => s >= b[0] && s < b[1])
    .map((start) => ({ start, at: minuteLabel(start) }));
}

// ─── Capacity ────────────────────────────────────────────────────────────

export interface WindowBookings {
  orders: Order[];
  history: Order[];
  assocOrders: AssocMeal[];
}

export type WindowUsage = Record<WindowType | 'total', number>;

/** "YYYY-MM-DD" in local time. */
const ymd = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Associate meals are made in the first venue (the main kitchen). */
export const ASSOC_ROOM = 'sequoia';

/**
 * How many orders already hold a range on a day: pick up and delivery orders
 * with something on them (open or handed off) and live associate meals.
 * @param excludeId an order being rebooked, which doesn't count against itself
 */
export function windowUsage(
  b: WindowBookings,
  room: string,
  start: number,
  date: string,
  excludeId?: string,
): WindowUsage {
  const c: WindowUsage = { pickup: 0, assoc: 0, delivery: 0, total: 0 };
  for (const o of [...b.orders, ...b.history]) {
    if (!o?.queueType || o.id === excludeId || o.room !== room) continue;
    if (!o.diners.some((d) => d.items.some((x) => !x.cancelled))) continue;
    const day = o.forDate || (o.openedAt ? ymd(o.openedAt) : date);
    if (day !== date || windowMinute(o.readyAt) !== start) continue;
    c[o.assoc ? 'assoc' : o.queueType === 'delivery' ? 'delivery' : 'pickup']++;
  }
  if (room === ASSOC_ROOM) {
    for (const a of b.assocOrders) {
      if (a.date === date && !(a.status || '').startsWith('Cancelled') && windowMinute(a.window) === start) c.assoc++;
    }
  }
  c.total = c.pickup + c.assoc + c.delivery;
  return c;
}

export interface WindowRoom {
  /** Places left, or null when the range has no limit. */
  left: number | null;
  full: boolean;
  used: WindowUsage;
}

/** Places left in a range for a type: the tighter of the total and the type's cap. */
export function windowRoom(
  w: WindowSettings,
  b: WindowBookings,
  type: WindowType,
  room: string,
  start: number,
  date: string,
  excludeId?: string,
): WindowRoom {
  const caps = windowCaps(w, room);
  const used = windowUsage(b, room, start, date, excludeId);
  const limits: number[] = [];
  if (caps.total > 0) limits.push(caps.total - used.total);
  if (caps[type] > 0) limits.push(caps[type] - used[type]);
  if (!limits.length) return { left: null, full: false, used };
  const left = Math.max(0, Math.min(...limits));
  return { left, full: left <= 0, used };
}

/** "Full", "2 left", or nothing while there is plenty of room. */
export function roomTag(r: WindowRoom | null | undefined): string {
  if (!r) return '';
  if (r.full) return 'Full';
  return r.left != null && r.left <= 2 ? `${r.left} left` : '';
}
