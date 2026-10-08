import { now } from '../lib/clock';

/**
 * Seed files store times relative to "now" so the demo always looks live:
 *   {"$t": -600000}  a timestamp 10 minutes ago (ms epoch)
 *   {"$d": 86400000} a Date one day from now (kept as ms epoch)
 * revive() turns them back into ms epoch values on the demo clock.
 */
export function revive<T>(value: T, base: number = now()): T {
  return walk(value, base) as T;
}

function walk(v: unknown, base: number): unknown {
  if (Array.isArray(v)) return v.map((x) => walk(x, base));
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 1 && (keys[0] === '$t' || keys[0] === '$d') && typeof o[keys[0]] === 'number') {
      return base + (o[keys[0]] as number);
    }
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = walk(o[k], base);
    return out;
  }
  return v;
}
