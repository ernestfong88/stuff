/**
 * Where a table is in its meal, the lanes of My Tables.
 *
 * One stage per table, in meal order, so reading down the board is reading
 * the meal. The manager floor and Triage use the same stages and colours,
 * so a server and a manager see the same colour for the same state.
 */
import { checkedIn, courseNumber, lastRun } from './courses';
import { DEFAULT_CONFIG, flag, printerMode, type DiningConfig } from './config';
import { isSide } from './menu';
import { isDrinkLine } from './routing';
import type { Order, OrderLine } from './types';
import { MINUTE, now } from '../lib/clock';
import { threshold } from '../store/serviceConfig';

export type StageKey = 'seat' | 'order' | 'cook' | 'run' | 'eat' | 'check';

export interface TableStage {
  key: StageKey;
  /** Short status, e.g. "Ready at Expo · C2" or "Eating · C2". */
  label: string;
  /** When the table entered this stage (ms). */
  since: number;
}

export interface Lane {
  key: StageKey;
  label: string;
}

/** Lanes in meal order. Empty lanes are not shown, so the stages that matter get the room. */
export const LANES: readonly Lane[] = [
  { key: 'seat', label: 'Just seated' },
  { key: 'order', label: 'Ordering' },
  { key: 'cook', label: 'Fired' },
  { key: 'run', label: 'Ready to run' },
  { key: 'eat', label: 'Eating' },
  { key: 'check', label: 'Ready to close' },
];

const servedAt = (o: Order, lines: OrderLine[]) => Math.max(o.openedAt, ...lines.map((i) => i.clearedAt || i.firedAt || o.openedAt));

/** Ch: the table's stage, from what is on the check and where it is. */
export function tableStage(o: Order, cfg: DiningConfig = DEFAULT_CONFIG, at: number = now()): TableStage {
  const food = o.diners.flatMap((d) => d.items.filter((i) => !i.comped && !isSide(i.itemId) && !isDrinkLine(i, o)));
  const sent = food.filter((i) => i.sent);
  if (!food.length) {
    const drinks = o.diners.some((d) => d.items.some((i) => isDrinkLine(i, o) && !i.cancelled));
    return drinks ? { key: 'order', label: 'Drinks in', since: o.openedAt } : { key: 'seat', label: 'Seating', since: o.openedAt };
  }
  if (!sent.length) return { key: 'order', label: 'Ordering', since: o.openedAt };
  // Printers: once the ticket prints nothing is tracked, so a sent table just waits to be closed.
  if (printerMode(cfg)) {
    if (sent.length < food.length) return { key: 'order', label: 'Adding items', since: o.openedAt };
    return { key: 'check', label: 'Sent', since: Math.min(...sent.map((i) => i.firedAt || o.openedAt)) };
  }

  const live = sent.filter((i) => i.kitchenState !== 'cleared');
  const lowest = live.length ? Math.min(...live.map(courseNumber)) : null;
  const served = sent.filter((i) => i.kitchenState === 'cleared');
  const highestServed = served.length ? Math.max(...served.map(courseNumber)) : null;
  const ateEntree = highestServed != null && highestServed >= 2;

  if (live.length && live.filter((i) => courseNumber(i) === lowest).every((i) => i.kitchenState === 'ready')) {
    return { key: 'run', label: `Ready at Expo · C${lowest}`, since: o.readyStampAt || at };
  }
  if (live.length && served.length && ateEntree) {
    return { key: 'eat', label: `Eating · C${highestServed}`, since: servedAt(o, served) };
  }
  const cooking = live.filter((i) => i.kitchenState === 'cooking');
  if (cooking.length) {
    return {
      key: 'cook',
      label: `Cooking · C${Math.min(...cooking.map(courseNumber))}`,
      since: Math.max(...cooking.map((i) => i.firedAt || o.openedAt)),
    };
  }
  const held = live.some((i) => i.kitchenState === 'scheduled');
  if (held && !ateEntree) return { key: 'cook', label: `Waiting · C${lowest}`, since: servedAt(o, served) };
  if (held) return { key: 'eat', label: `Eating · C${lowest} holds`, since: servedAt(o, served) };
  if (sent.length < food.length) return { key: 'order', label: 'Adding items', since: o.openedAt };

  if (highestServed === 2 && flag(cfg, 'checkIn')) {
    const run = lastRun(o);
    const didCheckIn = checkedIn(o, run);
    if (!didCheckIn || (flag(cfg, 'dessert') && !o.noDessert)) {
      return { key: 'eat', label: didCheckIn ? 'Dessert?' : 'Eating · C2', since: servedAt(o, served) };
    }
  }
  return {
    key: 'check',
    label: `Served · C${highestServed || 1}`,
    since: Math.max(...sent.map((i) => i.clearedAt || i.firedAt || o.openedAt)),
  };
}

/**
 * A ready course is stamped "now" when the order carries no readyStampAt
 * (every seeded table), so the first sighting is remembered or the timer
 * would sit at 0:00 forever.
 */
const readySeen = new Map<string, number>();

/** __kMgrState (since): when the table entered its stage, remembering first sightings of a ready course. */
export function stageSince(o: Order, stage: TableStage): number {
  if (stage.key !== 'run' || o.readyStampAt) return stage.since || o.openedAt;
  const key = o.id + ':' + stage.label;
  const seen = readySeen.get(key);
  if (seen != null) return seen;
  readySeen.set(key, stage.since);
  return stage.since;
}

/** __kLateBy: past the manager's threshold for this stage (a blank threshold never alerts). */
export function isLate(o: Order, key: StageKey, minutes: number): boolean {
  switch (key) {
    case 'run':
      return minutes >= threshold('passLate');
    case 'cook':
      return minutes >= threshold('floorCook');
    case 'eat':
      return minutes >= threshold('eatLate');
    case 'check':
      return minutes >= threshold('closeLate');
    default:
      return !o.diners.some((d) => d.items.some((i) => i.sent)) && minutes >= threshold('seatLate');
  }
}

/** Minutes between two times, for the late checks. */
export const minutesBetween = (from: number, to: number) => (to - from) / MINUTE;
