/**
 * Steps of Service, tracked by average table time: minutes from the order
 * to the entrée served (order → appetizer plus appetizer → entrée).
 */
import { mixHash } from './hash';
import { GOALS, TABLE_TIME_GOAL, min1, type Insight, type Tone } from './insight';
import type { Driver } from './sentiment';

export type MealName = 'Breakfast' | 'Lunch' | 'Dinner';
export const MEALS: MealName[] = ['Breakfast', 'Lunch', 'Dinner'];

export interface TimedTable {
  meal: MealName;
  /** Order → appetizer, minutes. */
  app: number;
  /** Appetizer → entrée, minutes. */
  ent: number;
  table: string;
  server: string;
  /** When the table sat (ms). */
  at: number;
  /** The day (local midnight). */
  day: number;
}

export const tableTime = (x: Pick<TimedTable, 'app' | 'ent'>) => x.app + x.ent;
export const avgTableTime = (T: TimedTable[]) => (T.length ? T.reduce((q, x) => q + tableTime(x), 0) / T.length : null);

/**
 * The tables timed on a day. Each day has a pace (some busy, some calm) and
 * its own share of slow appetizers and slow entrées; a couple of servers
 * run slower at certain meals, so coaching shows up in the numbers.
 */
export function timedTables(day: number, servers: Array<{ id: string; name: string }>): TimedTable[] {
  const ds = new Date(day).toDateString();
  const S = servers.length ? servers : [{ id: 'S', name: 'Server' }];
  const q = mixHash('dq' + ds) % 100;
  const band = q < 30 ? [2, 3] : q < 75 ? [4, 6] : [7, 10];
  const spread = (k: string) => band[0] + (mixHash('sp' + k + ds) % (band[1] - band[0] + 1));
  const noise =
    q < 30 ? -2.5 + (mixHash('no' + ds) % 150) / 100 : q < 75 ? -0.5 + (mixHash('no' + ds) % 250) / 100 : 2.5 + (mixHash('no' + ds) % 350) / 100;
  const out: TimedTable[] = [];
  for (const m of MEALS) {
    const count = (m === 'Dinner' ? 12 : m === 'Lunch' ? 10 : 6) + (mixHash('nt' + m + ds) % 6);
    const mealLag = m === 'Dinner' ? 0.9 : m === 'Breakfast' ? -0.6 : 0;
    const slowApp = spread('a' + m);
    const slowEnt = spread('e' + m);
    for (let i = 0; i < count; i++) {
      const h1 = mixHash('sa' + ds + m + i);
      const h2 = mixHash('se' + ds + m + i);
      const h5 = mixHash('st' + ds + m + i);
      const sv = S[h5 % S.length];
      const bias = sv.id === 'MT' && m === 'Dinner' ? 0.9 : sv.id === 'RJ' && m === 'Lunch' ? 0.5 : 0;
      const app = Math.max(
        2.5,
        3.3 +
          noise * 0.25 +
          (h1 % 30) / 10 +
          mealLag * 0.4 +
          (sv.id === 'RJ' ? bias * 1.4 : 0) +
          (mixHash('xa' + ds + m + i) % 100 < slowApp ? 3.6 : 0),
      );
      const ent = Math.max(
        6,
        12.8 + noise * 0.85 + (h2 % 42) / 10 + mealLag * 1.3 + (sv.id === 'MT' ? bias : 0) + (mixHash('xe' + ds + m + i) % 100 < slowEnt ? 5 : 0),
      );
      const sat = new Date(day);
      sat.setHours(m === 'Breakfast' ? 7 : m === 'Lunch' ? 11 : 17, 30 + (mixHash('sh' + ds + m + i) % 120));
      out.push({
        meal: m,
        app,
        ent,
        table: `${h5 % 3 === 2 ? 'EV' : 'SQ'} ${1 + (mixHash('tb' + ds + m + i) % 14)}`,
        server: sv.name,
        at: sat.getTime(),
        day,
      });
    }
  }
  return out;
}

const groupBy = <K>(T: TimedTable[], key: (x: TimedTable) => K) => {
  const m = new Map<K, TimedTable[]>();
  for (const x of T) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
};

/** The card's "Top action": coach the slowest server on the slowest meal's slower step. */
export function serviceAction(T: TimedTable[]): { tone: Tone; text: string } | null {
  if (!T.length) return null;
  const av = avgTableTime(T)!;
  const meals = [...groupBy(T, (x) => x.meal).entries()].map(([m, L]) => ({ m, L, v: avgTableTime(L)! })).sort((a, b) => b.v - a.v);
  const slow = meals[0];
  const aa = slow.L.reduce((q, x) => q + x.app, 0) / slow.L.length;
  const ae = slow.L.reduce((q, x) => q + x.ent, 0) / slow.L.length;
  const step = ae / GOALS.ent >= aa / GOALS.app ? 'entrée pacing' : 'appetizer timing';
  const sv = [...groupBy(slow.L, (x) => x.server).entries()].map(([k, L]) => [k, avgTableTime(L)!] as const).sort((a, b) => b[1] - a[1])[0];
  if (av <= TABLE_TIME_GOAL - 2 && slow.v <= TABLE_TIME_GOAL)
    return { tone: 'good', text: `Keep the pace. Average table time is ${min1(av)} min, inside the ${TABLE_TIME_GOAL} min goal at every meal.` };
  return {
    tone: av > TABLE_TIME_GOAL ? 'bad' : 'warn',
    text: `Coach ${sv[0]} and the line on ${slow.m.toLowerCase()} ${step}. ${slow.m} tables average ${min1(slow.v)} min against the ${TABLE_TIME_GOAL} min goal; ${sv[0].split(' ')[0]}’s average ${min1(sv[1])}.`,
  };
}

export interface ServiceWeek {
  insight: Insight;
  drivers: Driver[];
  /** The settings page that helps with the slow step. */
  page: ServicePage | null;
}

/**
 * The Back Office page a community can act on: when courses fire (Pacing &
 * Coursing) for a slow entrée. A slow appetizer has none: when slow plates are
 * flagged is Alerts & Timing, a Home Office setting, so no shortcut into it.
 */
export type ServicePage = 'svcFlow';
const pageFor = (cause: StepCause): ServicePage | null => (cause === 'entrée' ? 'svcFlow' : null);

/** The range against the one before: headline, slowest meal, step and server. */
export function serviceWeek(cur: TimedTable[], prevAvg: number | null, dayAverages: Array<number | null>, n: number): ServiceWeek {
  const v = avgTableTime(cur);
  const dr = v != null && prevAvg != null ? v - prevAvg : null;
  const dir = dr == null ? 'Not enough tables' : dr < -0.5 ? 'Improving' : dr > 0.5 ? 'Getting worse' : 'Holding steady';
  const hit = dayAverages.filter((x) => x != null && x <= TABLE_TIME_GOAL).length;
  const ranked = (key: (x: TimedTable) => string) =>
    [...groupBy(cur, key).entries()].map(([k, L]) => ({ k, v: avgTableTime(L)! })).sort((a, b) => b.v - a.v)[0];
  const meal = ranked((x) => x.meal);
  const srv = ranked((x) => x.server);
  const aa = cur.reduce((q, x) => q + x.app, 0) / (cur.length || 1);
  const ae = cur.reduce((q, x) => q + x.ent, 0) / (cur.length || 1);
  const step =
    ae / GOALS.ent >= aa / GOALS.app
      ? { name: 'Appetizer → entrée', v: ae, goal: GOALS.ent, fix: 'entrée' }
      : { name: 'Order → appetizer', v: aa, goal: GOALS.app, fix: 'appetizer' };
  if (!meal || !srv) return { insight: { tone: 'good', head: 'No tables timed in this range.' }, drivers: [], page: null };
  return {
    // What to do first; how the range went underneath. The drivers below say why.
    insight: {
      tone: v != null && v <= TABLE_TIME_GOAL && dir !== 'Getting worse' ? 'good' : 'bad',
      head: `Review ${meal.k.toLowerCase()} ${step.fix} pacing with ${srv.k} and the line before the next ${meal.k.toLowerCase()} service.`,
      body: `${dir}: ${min1(v)} min average table time, against ${min1(prevAvg)} the ${n} days before. Met the ${TABLE_TIME_GOAL} min goal ${hit} of ${n} days.`,
    },
    page: pageFor(step.fix === 'entrée' ? 'entrée' : 'appetizer'),
    drivers: [
      { name: meal.k, what: 'slowest meal', value: `${min1(meal.v)} min`, tone: meal.v > TABLE_TIME_GOAL ? 'bad' : 'good' },
      {
        name: step.name,
        what: 'step furthest from its goal',
        value: `${min1(step.v)} of ${step.goal} min`,
        tone: step.v > step.goal ? 'bad' : 'good',
      },
      { name: srv.k, what: 'slowest server', value: `${min1(srv.v)} min`, tone: srv.v > TABLE_TIME_GOAL ? 'bad' : 'good' },
    ],
  };
}

/** Which step made a table late: waiting on the appetizer, or on the entrée. */
export type StepCause = 'appetizer' | 'entrée';

export interface ServerFollowUp {
  server: string;
  tables: number;
  late: TimedTable[];
  /** The step that ran over its goal on more of their late tables. */
  cause: StepCause;
  /** The meal most of their late tables were in. */
  meal: MealName;
}

/** The step behind a set of late tables: the one over its goal more often, else the one further over. */
function causeOf(L: TimedTable[]): StepCause {
  const app = L.filter((x) => x.app > GOALS.app).length;
  const ent = L.filter((x) => x.ent > GOALS.ent).length;
  if (app !== ent) return ent > app ? 'entrée' : 'appetizer';
  const over = (k: 'app' | 'ent') => L.reduce((q, x) => q + x[k], 0) / L.length / GOALS[k];
  return over('ent') >= over('app') ? 'entrée' : 'appetizer';
}

const mostCommon = <T>(xs: T[]): T => [...groupByKey(xs).entries()].sort((a, b) => b[1] - a[1])[0][0];
function groupByKey<T>(xs: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

/** One day: tables over the goal grouped by server, most late first, slowest table first. */
export function lateTablesByServer(day: TimedTable[]): ServerFollowUp[] {
  const late = day.filter((x) => tableTime(x) > TABLE_TIME_GOAL).sort((a, b) => tableTime(b) - tableTime(a));
  return [...groupBy(late, (x) => x.server).entries()]
    .map(([server, L]) => ({
      server,
      late: L,
      tables: day.filter((x) => x.server === server).length,
      cause: causeOf(L),
      meal: mostCommon(L.map((x) => x.meal)),
    }))
    .sort((a, b) => b.late.length - a.late.length || tableTime(b.late[0]) - tableTime(a.late[0]));
}

export interface DayAction {
  tone: Tone;
  /** What to do, in one sentence. */
  act: string;
  /** Why, in one line. */
  why: string;
  /** Who to see after that, if anyone. */
  after?: string;
  page: ServicePage | null;
}

const stepWords = (c: StepCause) => (c === 'entrée' ? 'entrée pacing' : 'appetizer timing');

/** One day's next step: who to talk to, about which meal and step, and the settings page that helps. */
export function serviceDayAction(day: TimedTable[]): DayAction {
  if (!day.length) return { tone: 'good', act: 'No tables were timed this day.', why: '', page: null };
  const av = avgTableTime(day)!;
  const late = lateTablesByServer(day);
  if (!late.length)
    return {
      tone: 'good',
      act: `Nothing to fix. Every table came in under ${TABLE_TIME_GOAL} min.`,
      why: `Average table time ${min1(av)} min.`,
      page: null,
    };
  const [g, next] = late;
  const first = (name: string) => name.split(' ')[0];
  const k = g.cause === 'entrée' ? 'ent' : 'app';
  const stepAvg = g.late.reduce((q, x) => q + x[k], 0) / g.late.length;
  const lateCount = late.reduce((q, x) => q + x.late.length, 0);
  return {
    tone: av > TABLE_TIME_GOAL || lateCount / day.length > 0.3 ? 'bad' : 'warn',
    act: `Talk to ${first(g.server)} about ${g.meal.toLowerCase()} ${stepWords(g.cause)} before the next ${g.meal.toLowerCase()} service.`,
    why: `${g.late.length} of ${first(g.server)}’s ${g.tables} tables went over ${TABLE_TIME_GOAL} min, mostly waiting on the ${g.cause} (${min1(stepAvg)} min against ${GOALS[k]}).`,
    after: next ? `Then ${first(next.server)}: ${next.late.length} of ${next.tables} over, ${stepWords(next.cause)}.` : undefined,
    page: pageFor(g.cause),
  };
}

export interface TableRank {
  table: string;
  /** Average table time, minutes. */
  minutes: number;
  /** One timed visit: who served it and when. A table over a range: how many times it was timed. */
  server?: string;
  meal?: MealName;
  at?: number;
  visits?: number;
}

/**
 * The slowest and fastest tables, `k` of each and never the same one twice.
 * For one day each timed visit counts on its own; over a range the visits
 * are averaged per table, keeping tables timed at least twice when there are
 * enough of them, so one bad night doesn't decide it.
 */
export function bestWorstTables(T: TimedTable[], opts: { byTable?: boolean; k?: number } = {}): { worst: TableRank[]; best: TableRank[] } {
  const k = opts.k ?? 3;
  let rows: TableRank[];
  if (opts.byTable) {
    const all = [...groupBy(T, (x) => x.table).entries()].map(([table, L]) => ({ table, minutes: avgTableTime(L)!, visits: L.length }));
    const repeat = all.filter((x) => x.visits >= 2);
    rows = repeat.length >= k * 2 ? repeat : all;
  } else rows = T.map((x) => ({ table: x.table, minutes: tableTime(x), server: x.server, meal: x.meal, at: x.at }));
  const slow = [...rows].sort((a, b) => b.minutes - a.minutes);
  const worst = slow.slice(0, Math.min(k, Math.ceil(rows.length / 2)));
  const best = slow
    .filter((x) => !worst.includes(x))
    .reverse()
    .slice(0, k);
  return { worst, best };
}
