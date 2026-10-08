/**
 * The 86 list: what the kitchen has run out of, or has only a few of left.
 *
 * A manager marks an item out, or sets how many are left; it greys out (or
 * shows the count) on every tablet and comes back on its own at midnight,
 * because each mark only counts for the day it was made (marks are stored
 * with the demo-clock date they were made on).
 */
import { dayOffset } from '../domain/pickup';
import type { Order } from '../domain/types';
import { startOfToday, today } from '../lib/clock';
import { createSharedStore, useShared } from '../lib/sharedStore';

/** A count the manager set: `left` portions as of when `used` had already been ordered today. */
export interface EightySixLimit {
  day: string;
  left: number;
  used: number;
}

/** Item id → the day it was 86'd (Date.toDateString()), or a count set that day. */
export type EightySixMarks = Record<string, string | EightySixLimit>;

export const eightySixStore = createSharedStore<EightySixMarks>(
  {},
  {
    persistKey: 'kisco.86',
    channel: 'kisco-86',
  },
);

const day = () => today().toDateString();
const markDay = (m: string | EightySixLimit | undefined) => (typeof m === 'string' ? m : m?.day);

/** Is the item 86'd today? */
export function is86(marks: EightySixMarks, itemId: string): boolean {
  return marks[itemId] === day();
}

/** Item ids 86'd today. */
export function itemsOut(marks: EightySixMarks): string[] {
  const d = day();
  return Object.keys(marks).filter((id) => marks[id] === d);
}

/** Item ids out or with a count today, in the order they were marked. */
export function itemsMarked(marks: EightySixMarks): string[] {
  const d = day();
  return Object.keys(marks).filter((id) => markDay(marks[id]) === d);
}

/** The count set for an item today, or null. */
export function limitOf(marks: EightySixMarks, itemId: string): EightySixLimit | null {
  const m = marks[itemId];
  return typeof m === 'object' && m.day === day() ? m : null;
}

/** Orders that count toward today's portions: open checks and checks closed today (not a pick up booked for a later day). */
export function ordersToday(orders: Order[], history: Order[]): Order[] {
  const start = startOfToday();
  return [...orders.filter((o) => dayOffset(o) === 0), ...history.filter((o) => o.openedAt >= start)];
}

/** How many of the item are on these orders. */
export function usedOf(itemId: string, orders: Order[]): number {
  let used = 0;
  for (const o of orders) for (const d of o.diners) for (const i of d.items) if (i.itemId === itemId) used++;
  return used;
}

/** Portions left of the manager's count, after what was ordered since it was set; null when no count is set. */
export function limitLeft(marks: EightySixMarks, itemId: string, todays: Order[]): number | null {
  const lim = limitOf(marks, itemId);
  if (!lim) return null;
  return Math.max(0, lim.left - Math.max(0, usedOf(itemId, todays) - lim.used));
}

/** limitLeft, from lineCounts of today's orders (for counting many items at once). */
export function limitLeftIn(marks: EightySixMarks, itemId: string, todayCounts: ReadonlyMap<string, number>): number | null {
  const lim = limitOf(marks, itemId);
  if (!lim) return null;
  return Math.max(0, lim.left - Math.max(0, (todayCounts.get(itemId) ?? 0) - lim.used));
}

/** The smaller of two "portions left" counts, either of which may be unlimited (null). */
export function fewerLeft(a: number | null, b: number | null): number | null {
  return a == null ? b : b == null ? a : Math.min(a, b);
}

/** Write one item's mark for today; marks from earlier days are dropped. */
function write(itemId: string, mark: string | EightySixLimit | null): void {
  eightySixStore.set((prev) => {
    const d = day();
    const next: EightySixMarks = {};
    for (const [id, m] of Object.entries(prev)) if (markDay(m) === d) next[id] = m;
    if (mark == null) delete next[itemId];
    else next[itemId] = mark;
    return next;
  });
}

/** Mark (or unmark) an item as out for today. */
export function set86(itemId: string, on: boolean): void {
  write(itemId, on ? day() : null);
}

/** Set how many of an item are left today, counting from what `todays` orders already hold. */
export function setLeft(itemId: string, left: number, todays: Order[]): void {
  write(itemId, { day: day(), left: Math.max(0, Math.round(left)), used: usedOf(itemId, todays) });
}

/** Put back exactly what an item had before (for Undo). */
export function restore86(itemId: string, mark: string | EightySixLimit | undefined): void {
  write(itemId, mark != null && markDay(mark) === day() ? mark : null);
}

/** Read the marks in a component (pair with is86 / itemsOut). */
export function use86(): EightySixMarks {
  return useShared(eightySixStore);
}

/** Is this item 86'd today? Re-renders when the list changes. */
export function useIs86(itemId: string): boolean {
  return useShared(eightySixStore, (m) => is86(m, itemId));
}
