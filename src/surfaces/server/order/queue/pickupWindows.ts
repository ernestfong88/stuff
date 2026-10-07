/**
 * Pick up and delivery ranges. Every booking is a 15 minute range such as
 * 5:00 to 5:15 PM. Back Office ticks the ranges each venue offers; a
 * booked time is stored as the start of its range, and the kitchen fires
 * early enough for the order to be ready when the range starts.
 *
 * A venue can cap how many orders one range takes: a total across pick up,
 * associate pick up and delivery (it is the kitchen's capacity), and
 * optionally a cap per type. Both apply; 0 or blank is no limit.
 */
import type { AssocMeal, MealName, Order, QueueType } from '../../../../domain/types';
import { isoDate } from '../../../../domain/pickup';
import { getSetting } from '../../../../store/serviceConfig';

type WindowType = QueueType | 'assoc';

const DAY_SPAN: [number, number] = [360, 1320];
const MEAL_SPAN: Record<MealName, [number, number]> = { Breakfast: [360, 660], Lunch: [660, 960], Dinner: [960, 1320] };
const DEFAULT_RANGES: Record<WindowType, Array<[number, number]>> = {
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
/** Sequoia starts with a cap of 4 a range, so the demo has full ranges tonight. */
const DEFAULT_CAP: Record<string, Partial<Record<WindowType | 'total', number>>> = { sequoia: { total: 4 } };

/** "17:00" minutes → "5:00 PM". */
export function minutesLabel(v: number): string {
  const h = Math.floor(v / 60) % 24;
  const m = v % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "5:00 PM" → minutes after midnight. */
export function labelMinutes(at: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(at || '');
  if (!m) return null;
  let h = +m[1] % 12;
  if (m[3] === 'PM') h += 12;
  return h * 60 + +m[2];
}

/** __kRangeOf: "5:00 PM" → "5:00 to 5:15 PM". */
export function rangeLabel(at: string | null | undefined): string {
  const s = labelMinutes(at);
  if (s == null) return at ?? '';
  const a = minutesLabel(s);
  const b = minutesLabel(s + 15);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} to ${b}` : `${a} to ${b}`;
}

/** __kWinType: the community books ranges for this type (associate pick up always does). */
export function rangesOn(type: WindowType): boolean {
  return type === 'assoc' || getSetting<boolean | undefined>(`win.types.${type}.on`) !== false;
}

/** __kWinCut: orders go in at least this many minutes before a range starts. */
export function cutoffMinutes(): number {
  const v = getSetting<number | undefined>('win.cut');
  return v != null ? Number(v) : 45;
}

function rangeStarts(room: string, type: WindowType): number[] {
  const grid = getSetting<Record<string, Record<string, number[]>> | undefined>('win.grid')?.[room]?.[type];
  if (Array.isArray(grid))
    return grid.filter((s) => typeof s === 'number' && s % 15 === 0 && s >= DAY_SPAN[0] && s < DAY_SPAN[1]).sort((a, b) => a - b);
  return DEFAULT_RANGES[type].flatMap(([a, b]) => {
    const out: number[] = [];
    for (let s = a; s < b; s += 15) out.push(s);
    return out;
  });
}

export interface PickupWindow {
  /** Start, in minutes after midnight. */
  s: number;
  /** "5:00 PM" */
  at: string;
}

/** __kWindows: the ranges a venue offers for a type during a meal. */
export function windowsFor(type: WindowType, room: string, meal: MealName): PickupWindow[] {
  const span = MEAL_SPAN[meal];
  if (!span) return [];
  return rangeStarts(room, type)
    .filter((s) => s >= span[0] && s < span[1])
    .map((s) => ({ s, at: minutesLabel(s) }));
}

function capFor(room: string): Record<WindowType | 'total', number> {
  const saved = getSetting<Record<string, Record<string, number>> | undefined>('win.cap')?.[room];
  const d = saved === undefined ? (DEFAULT_CAP[room] ?? {}) : (saved ?? {});
  const v = (k: WindowType | 'total') => {
    const n = Number(d[k]);
    return n > 0 ? Math.floor(n) : 0;
  };
  return { total: v('total'), pickup: v('pickup'), assoc: v('assoc'), delivery: v('delivery') };
}

const ymd = (ts: number) => {
  const t = new Date(ts);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/** __kWinDate: the day an order is booked for. */
export function orderDate(o: Pick<Order, 'forDate' | 'openedAt'>): string {
  return o.forDate || (o.openedAt ? ymd(o.openedAt) : isoDate(0));
}

export interface WindowLoad {
  /** Places left, or null with no cap. */
  left: number | null;
  full: boolean;
}

/** __kWinLeft: places left in the range starting at `s`, counting every booked order but `excludeId`. */
export function windowLoad(
  type: WindowType,
  room: string,
  s: number,
  date: string,
  excludeId: string,
  data: { orders: Order[]; history: Order[]; assoc: AssocMeal[] },
): WindowLoad {
  const used = { pickup: 0, assoc: 0, delivery: 0 };
  for (const o of [...data.orders, ...data.history]) {
    if (!o.queueType || o.id === excludeId || o.room !== room) continue;
    if (!o.diners.some((d) => d.items.some((x) => !x.cancelled))) continue;
    if (orderDate(o) !== date || labelMinutes(o.readyAt) !== s) continue;
    used[o.assoc ? 'assoc' : o.queueType === 'delivery' ? 'delivery' : 'pickup']++;
  }
  for (const m of data.assoc) {
    if (m.date === date && !(m.status || '').startsWith('Cancelled') && room === 'sequoia' && labelMinutes(m.window) === s) used.assoc++;
  }
  const total = used.pickup + used.assoc + used.delivery;
  const cap = capFor(room);
  const limits: number[] = [];
  if (cap.total > 0) limits.push(cap.total - total);
  if (cap[type] > 0) limits.push(cap[type] - used[type]);
  if (!limits.length) return { left: null, full: false };
  const left = Math.max(0, Math.min(...limits));
  return { left, full: left <= 0 };
}

/** __kCapTag: "Full", "2 left" or nothing. */
export function loadTag(load: WindowLoad | undefined): string {
  if (!load) return '';
  if (load.full) return 'Full';
  return load.left != null && load.left <= 2 ? `${load.left} left` : '';
}
