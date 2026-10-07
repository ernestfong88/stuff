import type { MealName } from '../../../domain/types';
import { now } from '../../../lib/clock';

/** The meal being served at this time of day (on the demo clock). */
export function currentMeal(at: number = now()): MealName {
  const d = new Date(at);
  const h = d.getHours() + d.getMinutes() / 60;
  return h < 10.5 ? 'Breakfast' : h < 15 ? 'Lunch' : 'Dinner';
}
