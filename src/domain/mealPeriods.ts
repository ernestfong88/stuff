/**
 * When each meal is served. One source for every screen: the meal a new
 * check or pick up order opens on, the meal a pick up or delivery range
 * belongs to, and the menu the server's menu reference opens on.
 *
 * Breakfast until 10:30 AM, lunch until 3:00 PM, then dinner.
 */
import type { MealName } from './types';

export const MEALS: readonly MealName[] = ['Breakfast', 'Lunch', 'Dinner'];

/** Minute of the day lunch starts (10:30 AM). */
export const LUNCH_FROM = 630;
/** Minute of the day dinner starts (3:00 PM). */
export const DINNER_FROM = 900;

/** The meal served at a minute of the day (0 to 1439). */
export function mealAtMinute(minute: number): MealName {
  return minute < LUNCH_FROM ? 'Breakfast' : minute < DINNER_FROM ? 'Lunch' : 'Dinner';
}

/** The meal served at a time (ms). */
export function mealAt(ts: number): MealName {
  const d = new Date(ts);
  return mealAtMinute(d.getHours() * 60 + d.getMinutes());
}

/** The meal served at an hour of the day (fractions allowed: 10.5 is 10:30 AM). */
export function mealAtHour(hour: number): MealName {
  return mealAtMinute(hour * 60);
}

/** The part of a day [from, to) in minutes each meal is served, inside [dayFrom, dayTo). */
export function mealSpans(dayFrom: number, dayTo: number): Record<MealName, readonly [number, number]> {
  return { Breakfast: [dayFrom, LUNCH_FROM], Lunch: [LUNCH_FROM, DINNER_FROM], Dinner: [DINNER_FROM, dayTo] };
}
