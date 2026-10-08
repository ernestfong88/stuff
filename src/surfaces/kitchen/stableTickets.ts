/**
 * Keeping kitchen tickets (and the handlers cards are given) the same object
 * from one render to the next while nothing about them changed, so memoised
 * ticket cards only redraw for the check that did.
 */
import { useMemo, useRef } from 'react';
import type { Order } from '../../domain/types';

/**
 * A cache that hands back last time's ticket for a check that has not
 * changed. Orders are replaced, never changed in place, so the same Order
 * object with the same `key` (the screen and settings the tickets were built
 * for) builds the same tickets.
 */
export function ticketCache<T extends { id: string; order: Order }>(): (tickets: T[], key: readonly unknown[]) => T[] {
  const cache = new WeakMap<Order, { key: readonly unknown[]; byId: Map<string, T> }>();
  return (tickets, key) =>
    tickets.map((t) => {
      let entry = cache.get(t.order);
      if (!entry || entry.key.length !== key.length || entry.key.some((k, i) => !Object.is(k, key[i]))) {
        entry = { key, byId: new Map() };
        cache.set(t.order, entry);
      }
      const old = entry.byId.get(t.id);
      if (old) return old;
      entry.byId.set(t.id, t);
      return t;
    });
}

/**
 * Functions that never change identity but always run the latest version
 * passed in, for handing to memoised cards without redrawing them.
 */
export function useStableHandlers<H extends Record<string, (...args: never[]) => unknown>>(handlers: H): H {
  const latest = useRef(handlers);
  latest.current = handlers;
  return useMemo(() => {
    const out = {} as Record<string, (...args: never[]) => unknown>;
    for (const k of Object.keys(latest.current)) out[k] = (...args: never[]) => latest.current[k](...args);
    return out as H;
  }, []);
}
