import type { MealName } from '../types';

export const MEALS: readonly MealName[] = ['Breakfast', 'Lunch', 'Dinner'];

/** The meal being served at a time: breakfast until 10:30 AM, lunch until 3 PM, then dinner. */
export function mealAt(ts: number): MealName {
  const d = new Date(ts);
  const m = d.getHours() * 60 + d.getMinutes();
  return m < 630 ? 'Breakfast' : m < 900 ? 'Lunch' : 'Dinner';
}

/** "dinner" / "Dinner" → "Dinner", anything else → null. */
export function parseMeal(v: string | null | undefined): MealName | null {
  const m = String(v ?? '').toLowerCase();
  return MEALS.find((x) => x.toLowerCase() === m) ?? null;
}
