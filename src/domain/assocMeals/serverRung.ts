/**
 * Associate meals a server rings in on a tablet count against the day's
 * associate special limit, the same as meals planned in the Associate App.
 */
import { isoOf } from '../../lib/dates';
import type { MealName, Order } from '../types';
import type { AssocMealKind } from './menu';

/** The associate meal a check counts as: dinner for dinner, lunch otherwise. */
const kindOf = (meal: MealName): AssocMealKind => (meal === 'Dinner' ? 'Dinner' : 'Lunch');

/**
 * How many associates were rung one of these tablet items on `date`, on open
 * and closed checks, at the meals that share the limit. One per associate,
 * however many lines; cancelled lines don't count.
 */
export function serverRungCount(checks: readonly Order[], date: string, itemIds: readonly string[], capMeals?: readonly AssocMealKind[]): number {
  if (!itemIds.length) return 0;
  let n = 0;
  for (const o of checks) {
    if (isoOf(o.openedAt) !== date) continue;
    const kind = kindOf(o.meal);
    if (capMeals && !capMeals.includes(kind) && !(kind === 'Dinner' && capMeals.includes('NOC'))) continue;
    for (const d of o.diners) {
      if (!(o.assoc || d.kind === 'associate')) continue;
      if (d.items.some((l) => !l.cancelled && itemIds.includes(l.itemId))) n++;
    }
  }
  return n;
}
