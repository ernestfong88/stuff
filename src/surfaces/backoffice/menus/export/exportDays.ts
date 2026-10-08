/**
 * The weeks Menu Export offers: a few back and a few ahead of this one.
 * Menu weeks run Sunday to Saturday, so each is named by its Sunday.
 */
import { addDays, monthDay, weekStart } from '../../../../domain/menuCycle';

/** Sundays from `back` weeks before the week of `at` to `ahead` weeks after it. */
export function exportWeeks(at: number | Date, back = 4, ahead = 8): Date[] {
  const sun = weekStart(at);
  return Array.from({ length: back + ahead + 1 }, (_, i) => addDays(sun, (i - back) * 7));
}

/** "Sun 10/4 – Sat 10/10" */
export function weekLabel(sunday: Date): string {
  return `Sun ${monthDay(sunday)} – Sat ${monthDay(addDays(sunday, 6))}`;
}
