/**
 * The shared dining state every surface works from, and its seed.
 */
import { pickupPromiseOffsets, seedAssocMeals, seedHistory, seedOrders } from '../data';
import { clockLabel, quarterHourSlot } from './pickup';
import type { AssocMeal, Order } from './types';

export interface DiningState {
  /** Open checks and queued pick up / delivery orders. */
  orders: Order[];
  /** Closed checks (today), newest first. */
  history: Order[];
  /** Associate meal program orders. */
  assocOrders: AssocMeal[];
}

/**
 * Seeded promised times are stored as minutes from now; put them on the
 * nearest quarter hour of the demo clock, as the prototype did at load.
 */
function anchorPromise(o: Order): Order {
  const offset = pickupPromiseOffsets[o.id];
  return offset == null ? o : { ...o, readyAt: clockLabel(quarterHourSlot(offset)) };
}

/** The demo's starting point, with times relative to the demo clock. */
export function seedDiningState(): DiningState {
  return {
    orders: seedOrders().map(anchorPromise),
    history: seedHistory().map(anchorPromise),
    assocOrders: seedAssocMeals(),
  };
}
