/**
 * Pick up ranges a venue offers, for the printed order form. Every booking
 * is a 15 minute range such as 5:00 to 5:15 PM; Back Office ticks the
 * ranges each venue offers (Pick Up Windows), stored in the service config
 * as minutes after midnight. The rules live in domain/pickupService/windows.
 */
import { mealWindows, minuteLabel, type WindowSettings } from '../../../../domain/pickupService/windows';
import type { MealName } from '../../../../domain/types';

/** Start minutes of the pick up ranges a venue offers at a meal. */
export function pickupSlots(grid: unknown, room: string, meal: string): number[] {
  return mealWindows({ grid: grid as WindowSettings['grid'] }, 'pickup', room, meal as MealName).map((w) => w.start);
}

/** "11:00 AM to 1:30 PM": from the first range's start to the last one's end. */
export function pickupSpan(grid: unknown, room: string, meal: string): string {
  const s = pickupSlots(grid, room, meal);
  return s.length ? minuteLabel(s[0]) + ' to ' + minuteLabel(s[s.length - 1] + 15) : '';
}
