/**
 * Time to greet. The clock starts when the check opens or, when a host
 * seated the table, when the server first opens it; the host's seat time
 * gives seated to greeted. Greet to drinks is flagged over the venue's
 * limit and ignored under its floor (the drinks were already there), for
 * the meals the venue picks: dinner by default. Set in Back Office,
 * Service Flow.
 */
import { MINUTE, now } from '../../../lib/clock';
import type { MealName, Order } from '../../../domain/types';
import { getSetting } from '../../../store/serviceConfig';

export interface GreetConfig {
  /** Minutes before greet to drinks is slow. */
  over: number;
  /** Minutes under which it is not counted (the drinks were already there). */
  under: number;
  meals: MealName[];
}

interface SavedGreet {
  over?: number | string;
  under?: number | string;
  meals?: MealName[];
}

/** __kGreetCfg */
export function greetConfig(room: string, saved: Record<string, SavedGreet | undefined> = getSetting('greet')): GreetConfig {
  const c = saved?.[room] ?? {};
  return {
    over: Number(c.over) > 0 ? Number(c.over) : 5,
    under: c.under != null && c.under !== '' && Number(c.under) >= 0 ? Number(c.under) : 2,
    meals: Array.isArray(c.meals) ? c.meals : ['Dinner'],
  };
}

export interface GreetInfo {
  cfg: GreetConfig;
  /** Greet to drinks in minutes, once drinks are out (null under the floor). */
  mins: number | null;
  slow: boolean;
  /** Minutes the table has waited so far, while it waits for drinks. */
  live: number | null;
  /** Host seated to server greeted, in minutes. */
  seatGreet: number | null;
  /** Minutes since a host seated the table, while no server has opened it. */
  unGreeted?: number | null;
}

/** __kGreet: null for pick up / delivery and for meals the venue does not time. */
export function greetInfo(o: Order, cfg: GreetConfig = greetConfig(o.room)): GreetInfo | null {
  if (o.queueType || !cfg.meals.includes(o.meal)) return null;
  const start = o.hostSeated ? o.greetedAt || null : o.openedAt;
  const seatGreet = o.hostSeated && o.greetedAt ? (o.greetedAt - o.openedAt) / MINUTE : null;
  const drinks = o.diners.flatMap((d) => d.items.filter((l) => l.drink && !l.cancelled));
  const out = [
    ...drinks.filter((l) => l.kitchenState === 'cleared' && l.clearedAt).map((l) => l.clearedAt as number),
    ...(o.drinksAt ? [o.drinksAt] : []),
  ];
  if (!start) {
    return { cfg, mins: null, slow: false, live: null, seatGreet, unGreeted: o.closedAt ? null : (now() - o.openedAt) / MINUTE };
  }
  if (out.length) {
    const m = Math.max(0, Math.min(...out) - start) / MINUTE;
    return { cfg, mins: m < cfg.under ? null : m, slow: m > cfg.over, live: null, seatGreet };
  }
  const waiting = !o.closedAt && (drinks.length > 0 || !o.diners.some((d) => d.items.some((l) => l.sent)));
  const m = (now() - start) / MINUTE;
  return { cfg, mins: null, slow: waiting && m > cfg.over, live: waiting ? m : null, seatGreet };
}
