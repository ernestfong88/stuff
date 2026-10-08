/**
 * Tables the host is holding for a reservation, as the server's New check
 * and Table map show them: still tappable, but the server is told first.
 */
import { useCallback } from 'react';
import { MINUTE } from '../../../lib/clock';
import { useNow } from '../../../ui';
import { heldFor, hmAmPm, partyName, resvAt, type Reservation } from '../../host/reservations/model';
import { useReservations } from '../../host/reservations/store';

/** The reservation a table in this room is held for right now, if any. */
export function useHeldFor(room: string): (tableId: string) => Reservation | null {
  const book = useReservations();
  const at = useNow(30_000);
  return useCallback((tableId: string) => heldFor(tableId, room, book, at), [room, book, at]);
}

/** "Reserved 6:00 PM" on the tile. */
export function heldWord(r: Reservation): string {
  return `Reserved ${hmAmPm(r.time)}`;
}

/** "in 15 min", "due now", "10 min late" */
export function heldWhen(r: Reservation, at: number): string {
  const m = Math.round((resvAt(r) - at) / MINUTE);
  return m > 0 ? `in ${m} min` : m === 0 ? 'due now' : `${-m} min late`;
}

/** The confirm before a server starts a check on a held table. */
export function heldConfirm(label: string, r: Reservation, at: number): { title: string; message: string; confirmLabel: string } {
  return {
    title: `${label} is reserved at ${hmAmPm(r.time)}`,
    message: `The host is holding it for ${partyName(r)}, party of ${r.size} (${heldWhen(r, at)}). Start a check here anyway? If this is that party, the host can seat them from the reservation instead.`,
    confirmLabel: 'Start a check here',
  };
}
