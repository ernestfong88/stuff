/**
 * Drinks on a check by where they are. A sent drink is "pour" (the server
 * gets it), "bar" (the bar is making it) or "up" (ready at the bar, waiting
 * for its server); once it reaches the table it is "cleared".
 */
import type { Diner, Order, OrderLine } from './types';

export interface DrinkLine extends OrderLine {
  diner: Diner;
}

export interface DrinkQueue {
  pour: DrinkLine[];
  bar: DrinkLine[];
  up: DrinkLine[];
}

/** __kDrinkQ */
export function drinkQueue(o: Order): DrinkQueue {
  const q: DrinkQueue = { pour: [], bar: [], up: [] };
  for (const diner of o.diners) {
    for (const line of diner.items) {
      if (!line.drink || line.cancelled) continue;
      if (line.kitchenState === 'pour' || line.kitchenState === 'bar' || line.kitchenState === 'up') {
        q[line.kitchenState].push({ ...line, diner });
      }
    }
  }
  return q;
}

/** Every drink still on its way to the table. */
export function drinksWaiting(q: DrinkQueue): DrinkLine[] {
  return [...q.pour, ...q.bar, ...q.up];
}
