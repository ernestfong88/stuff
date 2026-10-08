import type { MealName } from '../types';
import { MEALS } from '../mealPeriods';

/** The meals and when each is served live in domain/mealPeriods; re-exported here for the pick up screens. */
export { MEALS, mealAt } from '../mealPeriods';

/** "dinner" / "Dinner" → "Dinner", anything else → null. */
export function parseMeal(v: string | null | undefined): MealName | null {
  const m = String(v ?? '').toLowerCase();
  return MEALS.find((x) => x.toLowerCase() === m) ?? null;
}
