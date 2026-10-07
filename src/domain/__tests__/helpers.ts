/**
 * Shared test helpers: a fixed demo clock and small order builders.
 * prototype.json holds outputs computed by the original prototype on the
 * same seed data, so the port can be checked against it item by item.
 */
import { vi } from 'vitest';
import type { DiningState } from '../diningState';
import type { Diner, Order, OrderLine } from '../types';
import prototype from './fixtures/prototype.json';

export { prototype };

/** 6:00 PM on a fixed day, local time. */
export const T0 = new Date(2026, 9, 7, 18, 0, 0, 0).getTime();

export function freezeClock(at: number = T0): void {
  vi.useFakeTimers();
  vi.setSystemTime(at);
}

export function advance(ms: number): void {
  vi.setSystemTime(Date.now() + ms);
}

let n = 0;
export function line(itemId: string, extra: Partial<OrderLine> = {}): OrderLine {
  return { id: 'l' + ++n, itemId, mods: {}, note: '', sent: false, kitchenState: null, ...extra };
}

export function diner(items: OrderLine[], extra: Partial<Diner> = {}): Diner {
  return { id: 'd' + ++n, kind: 'resident', refId: 'r1', isGuest: false, seat: 1, items, ...extra };
}

export function order(diners: Diner[], extra: Partial<Order> = {}): Order {
  return { id: 'o' + ++n, tableId: 't_sq3', room: 'sequoia', server: 'AA', meal: 'Dinner', openedAt: Date.now(), diners, ...extra };
}

export function stateOf(...orders: Order[]): DiningState {
  return { orders, history: [], assocOrders: [] };
}

/** Every line of an order, flattened. */
export const lines = (o: Order) => o.diners.flatMap((d) => d.items);
