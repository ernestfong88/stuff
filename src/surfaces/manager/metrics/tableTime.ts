/**
 * Average table time for Steps of Service: minutes from the order to the
 * entrée (order → appetizer plus appetizer → entrée), and how this meal
 * compares with the same meal on the last seven days.
 */
import { SOS_GOALS, type SosSummary } from '../../../domain/metrics/stepsOfService';

export const TABLE_TIME_GOAL = SOS_GOALS.app + SOS_GOALS.ent;

export const tableTimeOf = (s: Pick<SosSummary, 'app' | 'ent'>): number | null => (s.app != null && s.ent != null ? s.app + s.ent : null);

export interface TableTimeTrend {
  /** Minutes against the last seven days' average; negative is faster. */
  delta: number | null;
  dir: 'faster' | 'slower' | 'steady' | 'none';
}

/** Within half a minute counts as steady. */
export function tableTimeTrend(now: number | null, week: Array<Pick<SosSummary, 'app' | 'ent'>>): TableTimeTrend {
  const past = week.map(tableTimeOf).filter((v): v is number => v != null);
  if (now == null || !past.length) return { delta: null, dir: 'none' };
  const delta = now - past.reduce((a, b) => a + b, 0) / past.length;
  return { delta, dir: delta < -0.5 ? 'faster' : delta > 0.5 ? 'slower' : 'steady' };
}
