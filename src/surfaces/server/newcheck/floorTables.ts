/**
 * What the new-check floor plan shows on each table: your check, other
 * servers' checks (by first name), and how many seats are taken.
 */
import { serverName } from '../../../domain/servers';
import type { FloorTable, Order } from '../../../domain/types';

export interface PickerTable {
  table: FloorTable;
  /** One of my checks is open here. */
  mine: boolean;
  /** First names of other servers with a check here. */
  others: string[];
  /** Diners seated across every check at the table. */
  covers: number;
  seats: number;
  full: boolean;
}

/** Round tables seat six, the others four, unless the floor plan says otherwise. */
export function seatCount(t: FloorTable & { seats?: number }): number {
  return t.seats || (t.shape === 'round' ? 6 : 4);
}

export function pickerTable(table: FloorTable, orders: Order[], me: string): PickerTable {
  const here = orders.filter((o) => o.tableId === table.id && !o.queueType);
  const covers = here.reduce((n, o) => n + (o.diners ?? []).length, 0);
  const seats = seatCount(table);
  return {
    table,
    mine: here.some((o) => o.server === me),
    others: [...new Set(here.filter((o) => o.server !== me).map((o) => serverName(o.server).split(' ')[0]))],
    covers,
    seats,
    full: covers >= seats,
  };
}

/** My open checks at a table (a new check there asks first). */
export function myChecksAt(orders: Order[], tableId: string, me: string): Order[] {
  return orders.filter((o) => o.tableId === tableId && !o.queueType && o.server === me);
}
