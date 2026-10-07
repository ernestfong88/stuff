/**
 * Where a table is in its meal, as one word the whole floor agrees on.
 *
 * My Tables, Triage and the manager floor all read this, so a table can
 * never be "Ready to run" in one place and "Eating" in another.
 */
import { now } from '../../../lib/clock';
import { DEFAULT_CONFIG, flag, type DiningConfig } from '../../../domain/config';
import { checkedIn, courseNumber, lastRun, lineReadyAt } from '../../../domain/courses';
import { isSide } from '../../../domain/menu';
import { isDrinkLine } from '../../../domain/routing';
import type { Order, OrderLine } from '../../../domain/types';

/**
 * seat   nobody has ordered food yet
 * order  ordering, drinks in, or adding to a check
 * cook   a course is on the fire or waiting to fire
 * run    the lowest course is up at the pass
 * eat    a course is on the table
 * check  everything has been run: ready to close
 */
export type StageKey = 'seat' | 'order' | 'cook' | 'run' | 'eat' | 'check';

export interface TableStage {
  key: StageKey;
  /** Short status, e.g. "Ready at Expo · C1", "Eating · C2", "Dessert?". */
  label: string;
  /** When the table entered this stage (ms). */
  since: number;
  /** The course the stage is about, when there is one. */
  course?: number;
}

const latest = (times: number[]) => Math.max(...times);

/** When each run line reached the table (falls back to when it fired). */
function servedAt(o: Order, lines: OrderLine[]): number {
  return latest([o.openedAt, ...lines.map((l) => l.clearedAt || l.firedAt || o.openedAt)]);
}

/**
 * When the lowest course came up at the pass: the order's ready stamp, or
 * the latest ready time of its plates. Seeded tables carry no stamp, so the
 * plates' believable ready times keep the floor clock and Triage in step.
 */
export function readySince(o: Order, ready: OrderLine[], cfg: DiningConfig = DEFAULT_CONFIG): number {
  if (o.readyStampAt) return o.readyStampAt;
  const times = ready.map((l) => lineReadyAt(o, l, cfg)).filter((t): t is number => t != null);
  return times.length ? latest(times) : now();
}

/** Ch: the table's stage. */
export function tableStage(o: Order, cfg: DiningConfig = DEFAULT_CONFIG): TableStage {
  const food = o.diners.flatMap((d) => d.items.filter((l) => !l.comped && !isSide(l.itemId) && !isDrinkLine(l, o)));
  const sent = food.filter((l) => l.sent);
  if (!food.length) {
    const drinks = o.diners.some((d) => d.items.some((l) => isDrinkLine(l, o) && !l.cancelled));
    return drinks
      ? { key: 'order', label: 'Drinks in', since: o.openedAt }
      : { key: 'seat', label: 'Seating', since: o.openedAt };
  }
  if (!sent.length) return { key: 'order', label: 'Ordering', since: o.openedAt };

  const live = sent.filter((l) => l.kitchenState !== 'cleared');
  const served = sent.filter((l) => l.kitchenState === 'cleared');
  const lowest = live.length ? Math.min(...live.map(courseNumber)) : null;
  const highestServed = served.length ? Math.max(...served.map(courseNumber)) : null;
  const eatingSince = servedAt(o, served);

  if (lowest != null) {
    const current = live.filter((l) => courseNumber(l) === lowest);
    if (current.every((l) => l.kitchenState === 'ready')) {
      return { key: 'run', label: `Ready at Expo · C${lowest}`, since: readySince(o, current, cfg), course: lowest };
    }
    if (highestServed != null && highestServed >= 2) {
      return { key: 'eat', label: `Eating · C${highestServed}`, since: eatingSince, course: highestServed };
    }
    const cooking = live.filter((l) => l.kitchenState === 'cooking');
    if (cooking.length) {
      const c = Math.min(...cooking.map(courseNumber));
      return { key: 'cook', label: `Cooking · C${c}`, since: latest(cooking.map((l) => l.firedAt || o.openedAt)), course: c };
    }
    if (live.some((l) => l.kitchenState === 'scheduled')) {
      return { key: 'cook', label: `Waiting · C${lowest}`, since: eatingSince, course: lowest };
    }
  }
  if (sent.length < food.length) return { key: 'order', label: 'Adding items', since: o.openedAt };

  const run = lastRun(o);
  const didCheckIn = checkedIn(o, run);
  if (highestServed === 2 && flag(cfg, 'checkIn') && (!didCheckIn || (flag(cfg, 'dessert') && !o.noDessert))) {
    return { key: 'eat', label: didCheckIn ? 'Dessert?' : 'Eating · C2', since: eatingSince, course: 2 };
  }
  return {
    key: 'check',
    label: `Served · C${highestServed || 1}`,
    since: latest(sent.map((l) => l.clearedAt || l.firedAt || o.openedAt)),
  };
}

/** "Starters", "Entrees", "Desserts" or "Course 4". */
export function courseWord(c: number): string {
  return c === 1 ? 'Starters' : c === 2 ? 'Entrees' : c === 3 ? 'Desserts' : `Course ${c}`;
}
