import type { MealName } from '../../../domain/types';
import { mealAt } from '../../../domain/mealPeriods';
import { now } from '../../../lib/clock';

/** The meal being served at this time of day (on the demo clock); see domain/mealPeriods. */
export function currentMeal(at: number = now()): MealName {
  return mealAt(at);
}
