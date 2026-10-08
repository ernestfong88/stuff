/**
 * How many alcoholic drinks a resident has had this meal, across every check
 * (open or closed, any venue). It starts again at each meal: breakfast,
 * lunch and dinner are counted separately, and so is each day.
 */
import type { MealName, Order } from './types';

export function alcoholThisMeal(
  orders: Order[],
  residentId: string,
  meal: MealName,
  /** Start of the day (ms); checks opened before it don't count. */
  dayStart: number,
  isAlcohol: (itemId: string) => boolean,
): number {
  let n = 0;
  for (const o of orders) {
    if (o.meal !== meal || (o.openedAt ?? 0) < dayStart) continue;
    for (const d of o.diners) {
      // Only the resident's own drinks; a guest's are the guest's.
      if (d.kind !== 'resident' || d.isGuest || d.refId !== residentId) continue;
      for (const l of d.items) if (!l.cancelled && isAlcohol(l.itemId)) n++;
    }
  }
  return n;
}
