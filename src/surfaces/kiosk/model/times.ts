/**
 * The meals and times the kiosk offers. Each time is a 15 minute range the
 * venue offers for that order type, still open (orders close a set number
 * of minutes before a range starts) and, when the venue caps ranges, not
 * full. When today's ordering has closed, it offers tomorrow's.
 */
import type { MealName, QueueType } from '../../../domain/types';
import { MEALS } from '../../../domain/pickupService/meals';
import {
  mealWindows,
  windowCutoff,
  windowRoom,
  windowTypeOn,
  type WindowBookings,
  type WindowRoom,
  type WindowSettings,
  type WindowSlot,
} from '../../../domain/pickupService/windows';

/** The venue the lobby kiosk orders from. */
export const KIOSK_ROOM = 'sequoia';

/** How many times the short list shows before "Other times". */
export const NEXT_TIMES = 4;

/** Pick up and delivery, as Back Office has them switched on. */
export function kioskTypes(w: WindowSettings): QueueType[] {
  return (['pickup', 'delivery'] as const).filter((t) => windowTypeOn(w, t));
}

export interface KioskMeal {
  meal: MealName;
  /** "YYYY-MM-DD" */
  date: string;
  tomorrow: boolean;
  windows: WindowSlot[];
}

/**
 * Meals with a time left to order for: today's, or tomorrow's once today's
 * last range has closed.
 * @param nowMinute minutes since midnight on the demo clock
 */
export function kioskMeals(w: WindowSettings, type: QueueType, nowMinute: number, today: string, tomorrow: string): KioskMeal[] {
  const cut = windowCutoff(w);
  const make = (date: string, isTomorrow: boolean) =>
    MEALS.map((meal) => ({
      meal,
      date,
      tomorrow: isTomorrow,
      windows: mealWindows(w, type, KIOSK_ROOM, meal).filter((x) => isTomorrow || x.start >= nowMinute + cut),
    })).filter((x) => x.windows.length > 0);
  const t = make(today, false);
  return t.length ? t : make(tomorrow, true);
}

export interface TimeChoice {
  slot: WindowSlot;
  room: WindowRoom;
}

/** Each range of a meal with the room left in it. */
export function timeChoices(w: WindowSettings, b: WindowBookings, type: QueueType, meal: KioskMeal): TimeChoice[] {
  return meal.windows.map((slot) => ({ slot, room: windowRoom(w, b, type, KIOSK_ROOM, slot.start, meal.date) }));
}

/** The next few open times, keeping the one already picked on the list. */
export function nextTimes(choices: TimeChoice[], picked: number | null): TimeChoice[] {
  const open = choices.filter((c) => !c.room.full);
  const next = open.slice(0, NEXT_TIMES);
  const cur = picked != null ? open.find((c) => c.slot.start === picked) : undefined;
  if (!cur || next.includes(cur)) return next;
  return [...next.slice(0, NEXT_TIMES - 1), cur].sort((a, b) => a.slot.start - b.slot.start);
}
