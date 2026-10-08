/**
 * Seating rules shared by the server, host and manager tablets: a resident
 * sits at one table at a time, and a check nobody sat down at is not a check.
 */
import { tableName } from './orders';
import { serverName } from './servers';
import type { Order } from './types';

/** Where a resident is already seated: the open dine-in check, their diner on it, and how to say it. */
export interface SeatedAt {
  order: Order;
  dinerId: string;
  /** "SQ 1" (with the check letter when the table has several). */
  table: string;
  /** The check's server, first name. */
  server: string;
  /** Their lines on that check (not cancelled). */
  items: number;
}

/**
 * __kSeatedAt: the open dine-in check a resident (not a guest of theirs) is
 * already seated on, other than `exceptOrderId`. Pick up and delivery
 * orders don't count: a resident can take a meal home and still dine in.
 */
export function seatedAt(orders: Order[], residentId: string, exceptOrderId?: string): SeatedAt | null {
  for (const o of orders) {
    if (o.id === exceptOrderId || o.queueType || o.closedAt) continue;
    const d = o.diners.find((x) => x.kind === 'resident' && !x.isGuest && x.refId === residentId);
    if (d) {
      return {
        order: o,
        dinerId: d.id,
        table: tableName(o),
        server: serverName(o.server),
        items: d.items.filter((l) => !l.cancelled && !l.parentId).length,
      };
    }
  }
  return null;
}

/** "Marty is already at SQ 1 with Adriana" */
export function seatedAtText(name: string, at: SeatedAt): string {
  return `${name.split(' ')[0]} is already at ${at.table} with ${at.server}`;
}

/** What moving them here does to the other check. */
export function moveNote(name: string, at: SeatedAt): string {
  const first = name.split(' ')[0];
  if (!at.items) return `Moving takes ${first} off ${at.table}'s check, which has nothing ordered for them yet.`;
  return `Moving takes ${first} off ${at.table}'s check, with ${at.items === 1 ? 'the 1 item' : `the ${at.items} items`} ordered for them there.`;
}

/**
 * __kEmptyCheck: a dine-in check with nobody on it, as a table tapped by
 * mistake leaves behind. It is removed when the server leaves it, and can be
 * voided, so it never blocks the shift review.
 */
export function isEmptyCheck(o: Order): boolean {
  return !o.queueType && !o.closedAt && o.diners.length === 0;
}
