/**
 * Line helpers the board and the check share: drinks waiting on the
 * server, and the chef's "don't forget" reminders.
 */
import { courseNumber } from '../../../domain/courses';
import type { Diner, Order, OrderLine } from '../../../domain/types';
import { getSetting } from '../../../store/serviceConfig';
import { canonicalItemId } from './venue';

export interface DrinkLine {
  line: OrderLine;
  diner: Diner;
}

export interface DrinkQueue {
  /** The server gets these. */
  pour: DrinkLine[];
  /** The bar is making these. */
  bar: DrinkLine[];
  /** Ready at the bar for the server to collect. */
  up: DrinkLine[];
}

/** __kDrinkQ: sent drinks by where they are. */
export function drinkQueue(o: Order): DrinkQueue {
  const q: DrinkQueue = { pour: [], bar: [], up: [] };
  for (const diner of o.diners ?? []) {
    for (const line of diner.items) {
      if (!line.drink || line.cancelled) continue;
      if (line.kitchenState === 'pour' || line.kitchenState === 'bar' || line.kitchenState === 'up') {
        q[line.kitchenState].push({ line, diner });
      }
    }
  }
  return q;
}

/** Group lines by diner, in seat order, keeping the order lines arrive in. */
export function byDiner<T extends { diner: Diner }>(rows: T[]): Array<{ diner: Diner; rows: T[] }> {
  const groups: Array<{ diner: Diner; rows: T[] }> = [];
  for (const r of rows) {
    let g = groups.find((x) => x.diner.id === r.diner.id);
    if (!g) groups.push((g = { diner: r.diner, rows: [] }));
    g.rows.push(r);
  }
  return groups.sort((a, b) => (a.diner.seat || 0) - (b.diner.seat || 0));
}

/**
 * __kRemindsFor: "Don't forget" reminders the chef writes on a recipe
 * (a steak knife, extra lemon). Expo and the server see them like a
 * modifier, the server can drop one for a guest, and the cook never sees them.
 */
export function remindersFor(line: OrderLine | null | undefined): string[] {
  if (!line || line.cancelled || line.comped || line.kitchenState === 'cleared') return [];
  const all = getSetting<Record<string, string[]> | undefined>('remind') ?? {};
  const list = all[canonicalItemId(line.itemId)] ?? [];
  return list.filter((t) => !(line.rmOff ?? []).includes(t));
}

/** Lines of course c with reminders still showing, for the table card. */
export function reminderLines(o: Order, c: number): Array<{ diner: Diner; line: OrderLine }> {
  return (o.diners ?? []).flatMap((diner) =>
    diner.items
      .filter((line) => line.sent && !line.parentId && courseNumber(line) === c && remindersFor(line).length > 0)
      .map((line) => ({ diner, line })),
  );
}
