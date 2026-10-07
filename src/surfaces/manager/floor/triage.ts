/**
 * Triage: only the tables that need the manager, worst first, each with one
 * plain reason and one thing to do. Red is past the mark, amber is worth a
 * look. Tables that are fine fold into one line at the bottom.
 */
import { minutesSince } from '../../../lib/clock';
import { DEFAULT_CONFIG, flag, type DiningConfig } from '../../../domain/config';
import { checkedIn, courseNumber, lastRun, lineReadyAt } from '../../../domain/courses';
import { isDrinkLine } from '../../../domain/routing';
import type { Order } from '../../../domain/types';
import { getSetting, threshold } from '../../../store/serviceConfig';
import { drinkQueue, drinksWaiting } from './drinks';
import { greetConfig, greetInfo, type GreetConfig } from './greet';
import type { ThresholdFn } from './floorState';
import { courseWord, tableStage, type TableStage } from './stage';

export interface TriageReason {
  /** Past the Back Office mark: shown in red. */
  late: boolean;
  mins: number;
  /** What is wrong, e.g. "Starters up 8 min, not run". */
  text: string;
  /** What to do, e.g. "Run the starters". */
  act: string;
  /** Sort weight: late first, then the longest wait. */
  score: number;
}

export interface TriageOptions {
  cfg?: DiningConfig;
  t?: ThresholdFn;
  greet?: GreetConfig;
  /** Minutes after a course is run before a missing check-in counts. */
  checkInAfter?: number;
}

/**
 * __kCheckInMin: minutes after a course is run before the Check in button
 * wakes up. Each venue can set its own; the default comes from t.checkInWake.
 */
export function checkInMinutes(room: string): number {
  const perRoom = getSetting<Record<string, number | undefined>>('ciMin')?.[room];
  if (perRoom != null) return Number(perRoom);
  const wake = getSetting<number | string | null>('t.checkInWake');
  return wake != null && wake !== '' ? Number(wake) : 2;
}

/** __kTriageWhy: every reason a table needs help, worst first. */
export function triageReasons(o: Order, opts: TriageOptions = {}): TriageReason[] {
  const cfg = opts.cfg ?? DEFAULT_CONFIG;
  const t = opts.t ?? threshold;
  const st = tableStage(o, cfg);
  const m = minutesSince(st.since || o.openedAt);
  const out: TriageReason[] = [];
  const add = (late: boolean, mins: number, text: string, act: string) =>
    out.push({ late, mins, text, act, score: (late ? 1000 : 0) + mins });

  const waiting = drinksWaiting(drinkQueue(o));
  const gc = opts.greet ?? greetConfig(o.room);
  const greet = greetInfo(o, gc);

  if (st.key === 'run') {
    const ready = o.diners.flatMap((d) =>
      d.items.filter((l) => l.sent && !l.cancelled && !isDrinkLine(l, o) && l.kitchenState === 'ready'),
    );
    const c = ready.length ? Math.min(...ready.map(courseNumber)) : 2;
    const times = ready
      .filter((l) => courseNumber(l) === c)
      .map((l) => lineReadyAt(o, l, cfg))
      .filter((x): x is number => !!x);
    const up = times.length ? minutesSince(Math.max(...times)) : m;
    add(up >= t('passLate'), up, `${courseWord(c)} up ${up} min, not run`, `Run the ${courseWord(c).toLowerCase()}`);
  }
  if (waiting.length) {
    const dm = minutesSince(Math.min(...waiting.map((l) => l.upAt || l.firedAt || o.openedAt)));
    if (dm >= 2) add(dm >= gc.over, dm, `Waiting ${dm} min for drinks`, 'Get the drinks out');
  }
  if (greet?.unGreeted != null && greet.unGreeted >= 2) {
    const um = Math.floor(greet.unGreeted);
    add(um >= gc.over, um, `Seated ${um} min, no server yet`, 'Greet the table');
  } else if (greet?.live != null && !waiting.length && greet.live >= gc.over) {
    const lm = Math.floor(greet.live);
    add(true, lm, `${lm} min and no drinks yet`, 'Greet the table and take drinks');
  }
  if (st.key === 'eat' && flag(cfg, 'checkIn')) {
    const run = lastRun(o);
    if (run && !checkedIn(o, run)) {
      const cm = minutesSince(run.at);
      const after = opts.checkInAfter ?? checkInMinutes(o.room);
      // A wake-up of 0 means the button is lit straight away, not that triage nags.
      if (cm >= (after || Infinity)) add(true, cm, `No check-in after course ${run.c} · ${cm} min`, 'Check in with the table');
    }
  }
  if (st.key === 'cook' && m >= t('floorCook')) add(true, m, `Fired ${m} min ago`, 'Check with the kitchen');
  if (st.key === 'seat' && m >= 8) add(m >= 12, m, `Seated ${m} min, nothing ordered`, 'Help take the order');
  if (st.key === 'check' && m >= 10) add(m >= t('closeLate'), m, `Served ${m} min ago, check still open`, 'Help close the check');
  return out.sort((a, b) => b.score - a.score);
}

export interface TriageRow {
  order: Order;
  stage: TableStage;
  why: TriageReason[];
}

export interface ServerTriage {
  server: string;
  rows: TriageRow[];
  /** Tables that need help, worst first. */
  need: TriageRow[];
  /** How many of those are past the mark. */
  late: number;
  covers: number;
  /** Sum of the worst reason of each table that needs help. */
  score: number;
}

/** Triage every open dine-in check. */
export function triageRows(orders: Order[], opts: TriageOptions = {}): TriageRow[] {
  return orders
    .filter((o) => !o.queueType && !o.closedAt)
    .map((order) => ({ order, stage: tableStage(order, opts.cfg), why: triageReasons(order, opts) }));
}

/** Tables that need help, worst first. */
export function needingHelp(rows: TriageRow[]): TriageRow[] {
  return rows.filter((r) => r.why.length).sort((a, b) => b.why[0].score - a.why[0].score);
}

/** By associate: the server with the most late tables first. */
export function triageByServer(rows: TriageRow[]): ServerTriage[] {
  const ids = [...new Set(rows.map((r) => r.order.server))];
  return ids
    .map((server) => {
      const mine = rows.filter((r) => r.order.server === server);
      const need = needingHelp(mine);
      return {
        server,
        rows: mine,
        need,
        late: need.filter((r) => r.why[0].late).length,
        covers: mine.reduce((n, r) => n + r.order.diners.length, 0),
        score: need.reduce((n, r) => n + r.why[0].score, 0),
      };
    })
    .sort((a, b) => b.late - a.late || b.need.length - a.need.length || b.score - a.score);
}
