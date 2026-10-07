/**
 * NOC (overnight) associate meals at the pick up counter. The kitchen may
 * be closed by then, so the dinner line makes them before it closes and
 * PU & Delivery sets each one out; nothing is texted.
 */
import type { AssocMeal } from '../../../domain/types';
import { isNocWindow, windowMinute } from '../../../domain/pickupService/windows';

/** An associate meal; PU stamps readyAt when it sets the meal out. */
export type NocMeal = AssocMeal & { readyAt?: number | null };

export interface NocGroup {
  window: string;
  meals: NocMeal[];
}

const live = (a: AssocMeal) => !(a.status || '').startsWith('Cancelled');

/** Tonight's live NOC meals, grouped by range, earliest first. */
export function nocGroups(all: NocMeal[], date: string): NocGroup[] {
  const rows = all
    .filter((a) => a.date === date && live(a) && isNocWindow(a.window))
    .sort((a, b) => (windowMinute(a.window) ?? 0) - (windowMinute(b.window) ?? 0));
  const groups: NocGroup[] = [];
  for (const a of rows) {
    const last = groups[groups.length - 1];
    if (last && last.window === a.window) last.meals.push(a);
    else groups.push({ window: a.window, meals: [a] });
  }
  return groups;
}

/** Mark a meal set out on the counter (or undo it), with a line in its log. */
export function setOutMeal(a: NocMeal, on: boolean, at: number): NocMeal {
  return {
    ...a,
    readyAt: on ? at : null,
    log: [...(a.log || []), { by: 'PU', at, text: on ? 'Set out for NOC pickup' : 'Set out undone' }],
  };
}
