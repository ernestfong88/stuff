/**
 * Pick up and delivery ranges for the server's order screen, read from the
 * saved service settings. The rules (default ranges, caps, labels) live in
 * domain/pickupService/windows; this only wires them to the settings store.
 */
import type { AssocMeal, MealName, Order, QueueType } from '../../../../domain/types';
import { isoDate } from '../../../../domain/pickup';
import {
  mealWindows,
  rangeOf,
  roomTag,
  windowCutoff,
  windowMinute,
  windowRoom,
  windowTypeOn,
  type WindowSettings,
} from '../../../../domain/pickupService/windows';
import { isoOf } from '../../../../lib/dates';
import { getSetting } from '../../../../store/serviceConfig';

type WindowType = QueueType | 'assoc';

const win = (): WindowSettings => getSetting<WindowSettings | undefined>('win') ?? {};

/** "5:00 PM" → minutes after midnight (times before 6:00 AM count past midnight, for NOC ranges). */
export const labelMinutes = windowMinute;

/** "5:00 PM" → "5:00 to 5:15 PM". */
export const rangeLabel = rangeOf;

/** The community books ranges for this type (associate pick up always does). */
export function rangesOn(type: WindowType): boolean {
  return windowTypeOn(win(), type);
}

/** Orders go in at least this many minutes before a range starts. */
export function cutoffMinutes(): number {
  return windowCutoff(win());
}

export interface PickupWindow {
  /** Start, in minutes after midnight. */
  s: number;
  /** "5:00 PM" */
  at: string;
}

/** The ranges a venue offers for a type during a meal. */
export function windowsFor(type: WindowType, room: string, meal: MealName): PickupWindow[] {
  return mealWindows(win(), type, room, meal).map(({ start, at }) => ({ s: start, at }));
}

/** The day an order is booked for. */
export function orderDate(o: Pick<Order, 'forDate' | 'openedAt'>): string {
  return o.forDate || (o.openedAt ? isoOf(o.openedAt) : isoDate(0));
}

export interface WindowLoad {
  /** Places left, or null with no cap. */
  left: number | null;
  full: boolean;
}

/** Places left in the range starting at `s`, counting every booked order but `excludeId`. */
export function windowLoad(
  type: WindowType,
  room: string,
  s: number,
  date: string,
  excludeId: string,
  data: { orders: Order[]; history: Order[]; assoc: AssocMeal[] },
): WindowLoad {
  const { left, full } = windowRoom(win(), { orders: data.orders, history: data.history, assocOrders: data.assoc }, type, room, s, date, excludeId);
  return { left, full };
}

/** "Full", "2 left" or nothing. */
export const loadTag: (load: WindowLoad | undefined) => string = roomTag;
