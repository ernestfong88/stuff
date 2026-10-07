/**
 * Associate pick up windows. Every booking is a 15 minute range such as
 * 5:00 to 5:15 PM, kept as its start ("5:00 PM"). Back Office (Pick Up
 * Windows) ticks the ranges a venue offers for associate pick up; a range
 * already booked today stays open. NOC ranges run overnight, from 10 PM to
 * 6 AM, and count as minutes from the service day's midnight, so 2:00 AM is
 * 1560 and falls on the next calendar day.
 */
import type { AssocMeal, Order } from '../../../domain/types';

export type AssocMealName = 'Lunch' | 'Dinner' | 'NOC';

const MEAL_BOUNDS: Record<'Lunch' | 'Dinner', [number, number]> = { Lunch: [660, 960], Dinner: [960, 1320] };
/** The bookable day for ordinary ranges, 6 AM to 10 PM. */
const DAY_BOUNDS: [number, number] = [360, 1320];
/** NOC ranges: 10 PM to 6 AM the next morning. */
export const NOC_BOUNDS: [number, number] = [1320, 1800];
/** Default associate ranges: 11:00 AM to 1:30 PM and 4:30 to 7:30 PM. */
const DEFAULT_RANGES: Array<[number, number]> = [
  [660, 810],
  [990, 1170],
];
/** Default NOC ranges: 11 PM and 2 AM. */
const DEFAULT_NOC = [1380, 1560];
/** Sequoia starts with room for four orders per range, so busy ranges show up in the demo. */
const DEFAULT_CAPS: Record<string, WindowCap> = { sequoia: { total: 4 } };

export interface WindowCap {
  /** Orders per range across resident pick up, associate pick up and delivery; 0 for no limit. */
  total?: number;
  assoc?: number;
  pickup?: number;
  delivery?: number;
}

/** "2:00 AM" → 1560; "5:15 PM" → 1035; null when it isn't a clock label. */
export function windowMinutes(label: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(label || '');
  if (!m) return null;
  let h = +m[1] % 12;
  if (m[3] === 'PM') h += 12;
  const v = h * 60 + +m[2];
  return v < 360 ? v + 1440 : v;
}

/** 1035 → "5:15 PM". */
export function minutesLabel(v: number): string {
  const h = Math.floor(v / 60) % 24;
  const m = v % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** 1035 → "5:15 to 5:30 PM"; 705 → "11:45 AM to 12:00 PM". */
export function rangeLabel(start: number): string {
  const a = minutesLabel(start);
  const b = minutesLabel(start + 15);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} to ${b}` : `${a} to ${b}`;
}

export function isNoc(label: string | null | undefined): boolean {
  const v = windowMinutes(label);
  return v != null && v >= NOC_BOUNDS[0];
}

/** "1:30 PM" → "1:30 to 1:45 PM"; NOC ranges say so: "NOC · 11:00 to 11:15 PM". */
export function windowTag(label: string): string {
  const v = windowMinutes(label);
  if (v == null) return label;
  return (isNoc(label) ? 'NOC · ' : '') + rangeLabel(v);
}

function expand(ranges: Array<[number, number]>): number[] {
  const out: number[] = [];
  for (const [a, b] of ranges) for (let s = a; s < b; s += 15) out.push(s);
  return out;
}

/** Back Office grid settings: `win.grid[room].assoc` and `.noc`, lists of range starts. */
export interface WindowGrid {
  assoc?: unknown;
  noc?: unknown;
}

function validStarts(list: unknown, [lo, hi]: [number, number]): number[] | null {
  if (!Array.isArray(list)) return null;
  return list.filter((s): s is number => typeof s === 'number' && s % 15 === 0 && s >= lo && s < hi).sort((a, b) => a - b);
}

/**
 * The ranges a venue offers associates for a meal on a date, as start labels
 * in time order, plus any range a live associate meal already holds that day.
 */
export function assocWindows(grid: WindowGrid | undefined, meal: AssocMealName, date: string, meals: AssocMeal[]): string[] {
  let starts: number[];
  if (meal === 'NOC') {
    starts = validStarts(grid?.noc, NOC_BOUNDS) ?? DEFAULT_NOC.slice();
  } else {
    const all = validStarts(grid?.assoc, DAY_BOUNDS) ?? expand(DEFAULT_RANGES);
    const [lo, hi] = MEAL_BOUNDS[meal];
    starts = all.filter((s) => s >= lo && s < hi);
  }
  for (const o of meals) {
    if (o.date !== date || !isLive(o) || mealOfWindow(o.window) !== meal) continue;
    const v = windowMinutes(o.window);
    if (v != null && !starts.includes(v)) starts.push(v);
  }
  return starts.sort((a, b) => a - b).map(minutesLabel);
}

/** Which meal a booked range belongs to. */
export function mealOfWindow(label: string): AssocMealName {
  const v = windowMinutes(label) ?? 0;
  if (v >= NOC_BOUNDS[0]) return 'NOC';
  return v < MEAL_BOUNDS.Lunch[1] ? 'Lunch' : 'Dinner';
}

export function isLive(o: AssocMeal): boolean {
  return !(o.status || '').startsWith('Cancelled');
}

/** Midnight of an ISO date on the local clock. */
export function dayStart(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** When a range on a date starts (ms). */
export function windowStartsAt(date: string, label: string): number {
  const v = windowMinutes(label) ?? 0;
  const d = new Date(dayStart(date));
  d.setMinutes(v);
  return d.getTime();
}

/**
 * Ordering closes `cutoffMin` before the range starts. The kitchen is closed
 * overnight, so the dinner line makes NOC meals before it closes (`nocBy`,
 * minutes from midnight) and NOC orders close the cutoff before that.
 */
export function windowClosesAt(date: string, label: string, cutoffMin: number, nocBy: number): number {
  const at = windowStartsAt(date, label);
  const ready = isNoc(label) ? Math.min(at, windowStartsAt(date, minutesLabel(nocBy))) : at;
  return ready - cutoffMin * 60_000;
}

export interface WindowLoad {
  /** Places left, or null without a limit. */
  left: number | null;
  full: boolean;
}

/** The local calendar date of a time, "2026-10-07". */
export function isoOfTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function orderDate(o: Order): string {
  return o.forDate || isoOfTime(o.openedAt);
}

/**
 * Places left in a range. A venue can cap a range across every kind of order
 * (it is the kitchen's capacity), and optionally per kind; both apply.
 */
export function windowLoad(
  cap: WindowCap,
  room: string,
  label: string,
  date: string,
  orders: Order[],
  meals: AssocMeal[],
): WindowLoad {
  const start = windowMinutes(label);
  const used = { pickup: 0, assoc: 0, delivery: 0 };
  for (const o of orders) {
    if (!o.queueType || o.room !== room) continue;
    if (!o.diners.some((d) => d.items.some((x) => !x.cancelled))) continue;
    if (orderDate(o) !== date || windowMinutes(o.readyAt) !== start) continue;
    used[o.assoc ? 'assoc' : o.queueType === 'delivery' ? 'delivery' : 'pickup']++;
  }
  for (const m of meals) if (m.date === date && isLive(m) && windowMinutes(m.window) === start) used.assoc++;
  const total = used.pickup + used.assoc + used.delivery;
  const limits: number[] = [];
  if (cap.total && cap.total > 0) limits.push(cap.total - total);
  if (cap.assoc && cap.assoc > 0) limits.push(cap.assoc - used.assoc);
  if (!limits.length) return { left: null, full: false };
  const left = Math.max(0, Math.min(...limits));
  return { left, full: left <= 0 };
}

export function windowCap(caps: Record<string, WindowCap | null> | undefined, room: string): WindowCap {
  const c = caps?.[room];
  return c === undefined ? (DEFAULT_CAPS[room] ?? {}) : (c ?? {});
}

/** "Full", "2 left" when it is nearly full, else nothing. */
export function loadTag(load: WindowLoad): string {
  if (load.full) return 'Full';
  return load.left != null && load.left <= 2 ? `${load.left} left` : '';
}
