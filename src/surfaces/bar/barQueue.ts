/**
 * The bar's two lists: drinks to make, oldest ticket first, and drinks that
 * are up and waiting for their server.
 */
import type { DiningConfig } from '../../domain/config';
import { COCKTAIL_ROOMS } from '../../domain/routing';
import type { Order } from '../../domain/types';
import { drinkQueue, type DrinkLine } from '../manager/floor/drinks';

/** Minutes before a ticket still being made turns red. */
export const BAR_LATE_MIN = 6;

export interface BarTicket {
  order: Order;
  lines: DrinkLine[];
  /** When the oldest drink on the ticket was sent (to make) or came up (waiting). */
  since: number;
}

export interface BarQueue {
  make: BarTicket[];
  waiting: BarTicket[];
}

/** Drinks sent to the bar by the checks in this room. */
export function barQueue(orders: Order[]): BarQueue {
  const make: BarTicket[] = [];
  const waiting: BarTicket[] = [];
  for (const order of orders) {
    if (order.queueType) continue;
    const q = drinkQueue(order);
    if (q.bar.length) make.push({ order, lines: q.bar, since: Math.min(...q.bar.map((l) => l.firedAt || order.openedAt)) });
    if (q.up.length) waiting.push({ order, lines: q.up, since: Math.min(...q.up.map((l) => l.upAt || l.firedAt || order.openedAt)) });
  }
  return { make: make.sort((a, b) => a.since - b.since), waiting: waiting.sort((a, b) => a.since - b.since) };
}

/** Does the room send any drinks to a bar (by default, or by a Kitchen Routing override)? */
export function roomHasBar(room: string, cfg: DiningConfig): boolean {
  return COCKTAIL_ROOMS.includes(room) || Object.entries(cfg.route).some(([k, v]) => k.startsWith(room + '|') && v === 'bar');
}
