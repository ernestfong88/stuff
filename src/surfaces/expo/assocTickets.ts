/**
 * Associate meals on Expo: the orders associates plan for their shift in
 * the Associate App, one card each, in pick up window order. Expo fires
 * them, marks them ready and hands them over.
 */
import { parseClockTime } from '../../domain/pickup';
import type { AssocMeal } from '../../domain/types';

export type AssocStage = { firedAt?: number; readyAt?: number | null; pickedAt?: number };
export type AssocTicketMeal = AssocMeal & AssocStage;

export type AssocState = 'late' | 'ready' | 'holding' | 'fired';

export interface AssocTicket {
  meal: AssocTicketMeal;
  /** Start of the pick up window (ms). */
  at: number;
  noc: boolean;
}

const MIN = 60_000;
const WINDOW_MIN = 15;

/** Overnight (NOC) meals are set out before the overnight close, 8:00 PM. */
export const NOC_CLOSE = '8:00 PM';

const isLive = (m: AssocMeal) => !(m.status || '').startsWith('Cancelled');

/**
 * Today's associate meals still to hand over. Where pick ups are not
 * tracked, a meal is done once it is ready.
 */
export function assocTickets(meals: readonly AssocTicketMeal[], today: string, trackPickup: boolean): AssocTicket[] {
  const gone = (m: AssocTicketMeal) => m.status === 'Picked up' || (!trackPickup && !!m.readyAt);
  return meals
    .filter((m) => m.date === today && isLive(m) && !gone(m))
    .map((meal) => {
      const noc = meal.meal === 'NOC';
      let at = parseClockTime(meal.window) ?? 0;
      // An overnight window after midnight belongs to the next morning.
      if (noc && at && new Date(at).getHours() < 12) at += 24 * 60 * MIN;
      return { meal, at, noc };
    })
    .sort((a, b) => a.at - b.at);
}

/** Planned meals for today, the count on the Associates filter. */
export function plannedToday(meals: readonly AssocMeal[], today: string): number {
  return meals.filter((m) => m.date === today && m.status === 'Planned').length;
}

export function assocState(t: AssocTicket, now: number): AssocState {
  const { firedAt, readyAt } = t.meal;
  if (readyAt) return now > t.at + WINDOW_MIN * MIN ? 'late' : 'ready';
  if (firedAt) return 'fired';
  return now > t.at ? 'late' : 'holding';
}

/** "45m", "1h 5m" */
export function shortSpan(ms: number): string {
  const m = Math.max(1, Math.round(Math.abs(ms) / MIN));
  return m < 60 ? m + 'm' : `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}`;
}

/** Associates type dish names in capitals; "PEACH CHICKEN WITH RICE" → "Peach Chicken with Rice". */
export function dishTitle(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/(^|\s|&)\S/g, (c) => c.toUpperCase())
    .replace(/ (Of|The|And|With)(?= )/g, (_, w: string) => ' ' + w.toLowerCase());
}

export type AssocNext = { kind: 'fire' } | { kind: 'ready' } | { kind: 'pickedUp' };

export function assocNext(m: AssocStage): AssocNext {
  if (m.readyAt) return { kind: 'pickedUp' };
  return m.firedAt ? { kind: 'ready' } : { kind: 'fire' };
}
