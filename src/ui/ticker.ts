/**
 * One shared clock tick per period. Every component that asks for a 1 s, 15 s
 * or 60 s tick shares a single timer for that period, and each tick lands on a
 * whole multiple of the period on the demo clock (a 60 s tick turns over with
 * the minute). A period nobody listens to has no timer at all.
 *
 * Pick the coarsest period that keeps the screen honest: a "late" colour can
 * wait 15 s; only text that shows seconds needs a 1 s tick, and then only in
 * the leaf that shows it (see <Elapsed>).
 */
import { useSyncExternalStore } from 'react';
import { now } from '../lib/clock';

interface Period {
  ms: number;
  value: number;
  /** No one has listened since the last tick: the value is refreshed on the next read. */
  stale: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  listeners: Set<() => void>;
  subscribe: (l: () => void) => () => void;
  get: () => number;
}

const periods = new Map<number, Period>();

function period(ms: number): Period {
  const found = periods.get(ms);
  if (found) return found;
  const p: Period = {
    ms,
    value: 0,
    stale: true,
    timer: null,
    listeners: new Set(),
    subscribe(listener) {
      p.listeners.add(listener);
      if (!p.timer) schedule(p);
      return () => {
        p.listeners.delete(listener);
        if (!p.listeners.size && p.timer) {
          clearTimeout(p.timer);
          p.timer = null;
          p.stale = true;
        }
      };
    },
    get() {
      if (p.stale) {
        p.value = now();
        p.stale = false;
      }
      return p.value;
    },
  };
  periods.set(ms, p);
  return p;
}

/** Next tick on the next whole multiple of the period (at least a few ms ahead). */
function schedule(p: Period) {
  const wait = p.ms - (now() % p.ms) || p.ms;
  p.timer = setTimeout(() => {
    p.value = now();
    p.stale = false;
    schedule(p);
    p.listeners.forEach((l) => l());
  }, wait + 5);
}

/**
 * The demo-clock time, re-rendering on every tick of `ms`. Components using the
 * same period share one timer and see the same value.
 */
export function useTick(ms = 1000): number {
  const p = period(ms);
  return useSyncExternalStore(p.subscribe, p.get, p.get);
}
