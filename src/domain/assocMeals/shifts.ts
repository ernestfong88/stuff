/**
 * The associate's upcoming shifts. In production these come from the
 * scheduling system; a scheduled shift is what unlocks meal planning.
 */
import seed from '../../data/seed/associateShifts.json';
import { addDays } from './menu';
import { windowMinutes, type AssocMealName } from './windows';

/** "Both" covers a long shift with a lunch or a dinner. */
export type ShiftMeal = AssocMealName | 'Both';

export interface Shift {
  date: string;
  start: string;
  end: string;
  meal: ShiftMeal;
  breakAt: string;
}

export const DEMO_ASSOCIATE = { name: seed.name, role: seed.role };

/** Shifts from `todayIso` on: the next few days, then one on a weekday of each of the coming weeks. */
export function upcomingShifts(todayIso: string): Shift[] {
  const near = seed.shifts.map(({ offset, ...s }) => ({ ...s, date: addDays(todayIso, offset), meal: s.meal as ShiftMeal }));
  const dow = new Date(todayIso + 'T00:00:00Z').getUTCDay();
  const toMonday = (8 - dow) % 7 || 7;
  const later = seed.weeklyShifts.map(({ weekday, weeksAhead, ...s }) => ({
    ...s,
    date: addDays(todayIso, toMonday + (weeksAhead - 1) * 7 + (weekday - 1)),
    meal: s.meal as ShiftMeal,
  }));
  return [...near, ...later];
}

/** The meals a shift can plan; a "Both" shift picks lunch or dinner. */
export function shiftMeals(meal: ShiftMeal): AssocMealName[] {
  return meal === 'Both' ? ['Lunch', 'Dinner'] : [meal];
}

/** "Plan lunch", "Plan a NOC meal", "Plan a meal" … for this shift. */
export function planLabel(meal: ShiftMeal): string {
  if (meal === 'Both') return 'Plan a meal for this shift';
  if (meal === 'NOC') return 'Plan a NOC meal for this shift';
  return `Plan ${meal.toLowerCase()} for this shift`;
}

/** Ranges that start inside the shift (an overnight shift runs past midnight). */
export function withinShift(windows: string[], shift: Pick<Shift, 'start' | 'end'>): string[] {
  const start = clockMinutes(shift.start);
  let end = clockMinutes(shift.end);
  if (end <= start) end += 1440;
  return windows.filter((w) => {
    const v = windowMinutes(w);
    return v != null && v >= start && v <= end;
  });
}

/** The range closest to the break, from those offered. */
export function nearestToBreak(windows: string[], breakAt: string): string | null {
  const b = windowMinutes(breakAt);
  if (b == null || !windows.length) return null;
  return [...windows].sort((x, y) => Math.abs((windowMinutes(x) ?? 0) - b) - Math.abs((windowMinutes(y) ?? 0) - b))[0];
}

/** "10:30 PM" → 1350 minutes from midnight (no overnight shift). */
function clockMinutes(label: string): number {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(label);
  if (!m) return 0;
  let h = +m[1] % 12;
  if (m[3] === 'PM') h += 12;
  return h * 60 + +m[2];
}

/** "Today", "Tomorrow", or "Fri, Oct 9". */
export function dayName(date: string, todayIso: string): string {
  if (date === todayIso) return 'Today';
  if (date === addDays(todayIso, 1)) return 'Tomorrow';
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Wed, Oct 7". */
export function shortDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
