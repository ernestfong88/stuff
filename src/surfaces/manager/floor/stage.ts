/**
 * Where a table is in its meal, as one word the whole floor agrees on.
 *
 * My Tables, Triage and the manager floor all read this, so a table can
 * never be "Ready to run" in one place and "Eating" in another.
 */
import { now } from '../../../lib/clock';
import { DEFAULT_CONFIG, type DiningConfig } from '../../../domain/config';
import { courseNumber, lineReadyAt } from '../../../domain/courses';
import { isSide } from '../../../domain/menu';
import { isDrinkLine } from '../../../domain/routing';
import type { Order, OrderLine } from '../../../domain/types';
import { tableStage as serverStage, type TableStage as ServerStage } from '../../server/board/tableStage';

export type { StageKey } from '../../server/board/tableStage';

export interface TableStage extends ServerStage {
  /** The course the run is about, when the lowest course is up at the pass. */
  course?: number;
}

/**
 * When the lowest course came up at the pass: the order's ready stamp, or
 * the latest ready time of its plates. Seeded tables carry no stamp, so the
 * plates' believable ready times keep the floor clock and Triage in step
 * (the same minutes Triage quotes in "Starters up 8 min").
 */
export function readySince(o: Order, ready: OrderLine[], cfg: DiningConfig = DEFAULT_CONFIG): number {
  if (o.readyStampAt) return o.readyStampAt;
  const times = ready.map((l) => lineReadyAt(o, l, cfg)).filter((t): t is number => t != null);
  return times.length ? Math.max(...times) : now();
}

/**
 * Ch, as the server board computes it, with the run timer taken from when
 * the plates came up rather than when the table was first seen.
 */
export function tableStage(o: Order, cfg: DiningConfig = DEFAULT_CONFIG): TableStage {
  const st = serverStage(o, cfg);
  if (st.key !== 'run') return st;
  const live = o.diners.flatMap((d) => d.items.filter((l) => l.sent && !l.comped && !isSide(l.itemId) && !isDrinkLine(l, o) && l.kitchenState !== 'cleared'));
  const course = live.length ? Math.min(...live.map(courseNumber)) : undefined;
  return { ...st, course, since: readySince(o, live.filter((l) => courseNumber(l) === course), cfg) };
}

/** "Starters", "Entrees", "Desserts" or "Course 4". */
export function courseWord(c: number): string {
  return c === 1 ? 'Starters' : c === 2 ? 'Entrees' : c === 3 ? 'Desserts' : `Course ${c}`;
}
