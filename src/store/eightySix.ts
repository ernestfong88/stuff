/**
 * The 86 list: what the kitchen has run out of.
 *
 * A manager marks an item; it greys out on every tablet and comes back on
 * its own at midnight, because each mark only counts for the day it was
 * made (marks are stored with the demo-clock date they were made on).
 */
import { today } from '../lib/clock';
import { createSharedStore, useShared } from '../lib/sharedStore';

/** Item id → the day it was 86'd (Date.toDateString()). */
export type EightySixMarks = Record<string, string>;

export const eightySixStore = createSharedStore<EightySixMarks>({}, {
  persistKey: 'kisco.86',
  channel: 'kisco-86',
});

const day = () => today().toDateString();

/** Is the item 86'd today? */
export function is86(marks: EightySixMarks, itemId: string): boolean {
  return marks[itemId] === day();
}

/** Item ids 86'd today. */
export function itemsOut(marks: EightySixMarks): string[] {
  const d = day();
  return Object.keys(marks).filter((id) => marks[id] === d);
}

/** Mark (or unmark) an item as out for today; marks from earlier days are dropped. */
export function set86(itemId: string, on: boolean): void {
  eightySixStore.set((prev) => {
    const d = day();
    const next: EightySixMarks = {};
    for (const [id, when] of Object.entries(prev)) if (when === d) next[id] = when;
    if (on) next[itemId] = d;
    else delete next[itemId];
    return next;
  });
}

/** Read the marks in a component (pair with is86 / itemsOut). */
export function use86(): EightySixMarks {
  return useShared(eightySixStore);
}

/** Is this item 86'd today? Re-renders when the list changes. */
export function useIs86(itemId: string): boolean {
  return useShared(eightySixStore, (m) => is86(m, itemId));
}
