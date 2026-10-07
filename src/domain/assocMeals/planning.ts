import type { AssocMeal } from '../types';
import type { AssocSettings } from './settings';
import { shiftMeals, withinShift, type Shift } from './shifts';
import { assocWindows, windowClosesAt, type AssocMealName } from './windows';

/**
 * Ranges an associate can still order for: the venue's ranges for the meal,
 * inside the shift (unless salaried), and not yet past the cutoff.
 */
export function openWindows(shift: Shift, meal: AssocMealName, anyTime: boolean, settings: AssocSettings, meals: AssocMeal[], nowMs: number): string[] {
  const offered = assocWindows(settings.grid, meal, shift.date, meals);
  const inShift = anyTime ? offered : withinShift(offered, shift);
  return inShift.filter((w) => nowMs < windowClosesAt(shift.date, w, settings.cutoffMin, settings.nocBy));
}

/** True once every meal of the shift is past ordering. */
export function orderingOver(shift: Shift, anyTime: boolean, settings: AssocSettings, meals: AssocMeal[], nowMs: number): boolean {
  return shiftMeals(shift.meal).every((m) => openWindows(shift, m, anyTime, settings, meals, nowMs).length === 0);
}
