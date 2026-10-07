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
  const noise = q < 30 ? -2.5 + (mixHash('no' + ds) % 150) / 100 : q < 75 ? -0.5 + (mixHash('no' + ds) % 250) / 100 : 2.5 + (mixHash('no' + ds) % 350) / 100;
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
      const app = Math.max(2.5, 3.3 + noise * 0.25 + (h1 % 30) / 10 + mealLag * 0.4 + (sv.id === 'RJ' ? bias * 1.4 : 0) + (mixHash('xa' + ds + m + i) % 100 < slowApp ? 3.6 : 0));
      const ent = Math.max(6, 12.8 + noise * 0.85 + (h2 % 42) / 10 + mealLag * 1.3 + (sv.id === 'MT' ? bias : 0) + (mixHash('xe' + ds + m + i) % 100 < slowEnt ? 5 : 0));
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
  if (av <= TABLE_TIME_GOAL - 2 && slow.v <= TABLE_TIME_GOAL) return { tone: 'good', text: `Keep the pace. Average table time is ${min1(av)} min, inside the ${TABLE_TIME_GOAL} min goal at every meal.` };
  return {
    tone: av > TABLE_TIME_GOAL ? 'bad' : 'warn',
    text: `Coach ${sv[0]} and the line on ${slow.m.toLowerCase()} ${step}. ${slow.m} tables average ${min1(slow.v)} min against the ${TABLE_TIME_GOAL} min goal; ${sv[0].split(' ')[0]}’s average ${min1(sv[1])}.`,
  };
}

export interface ServiceWeek {
  insight: Insight;
  drivers: Driver[];
}

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
  const step = ae / GOALS.ent >= aa / GOALS.app ? { name: 'Appetizer → entrée', v: ae, goal: GOALS.ent, fix: 'entrée' } : { name: 'Order → appetizer', v: aa, goal: GOALS.app, fix: 'appetizer' };
  if (!meal || !srv) return { insight: { tone: 'good', head: 'No tables timed in this range.' }, drivers: [] };
  return {
    insight: {
      tone: v != null && v <= TABLE_TIME_GOAL && dir !== 'Getting worse' ? 'good' : 'bad',
      head: `${dir}: ${min1(v)} min average table time, against ${min1(prevAvg)} the ${n} days before. Met the ${TABLE_TIME_GOAL} min goal ${hit} of ${n} days.`,
      body: `${meal.k} runs slowest at ${min1(meal.v)} min. The ${step.name.toLowerCase()} step averages ${min1(step.v)} min against ${step.goal}. ${srv.k}’s tables average ${min1(srv.v)} min, the slowest on the team.`,
      next: `Review ${meal.k.toLowerCase()} ${step.fix} pacing with ${srv.k} and the line before the next ${meal.k.toLowerCase()} service.`,
    },
    drivers: [
      { name: meal.k, what: 'slowest meal', value: `${min1(meal.v)} min`, tone: meal.v > TABLE_TIME_GOAL ? 'bad' : 'good' },
      { name: step.name, what: 'step furthest from its goal', value: `${min1(step.v)} of ${step.goal} min`, tone: step.v > step.goal ? 'bad' : 'good' },
      { name: srv.k, what: 'slowest server', value: `${min1(srv.v)} min`, tone: srv.v > TABLE_TIME_GOAL ? 'bad' : 'good' },
    ],
  };
}

export interface ServerFollowUp {
  server: string;
  tables: number;
  late: TimedTable[];
}

/** One day: tables over the goal grouped by server, most late first, slowest table first. */
export function lateTablesByServer(day: TimedTable[]): ServerFollowUp[] {
  const late = day.filter((x) => tableTime(x) > TABLE_TIME_GOAL).sort((a, b) => tableTime(b) - tableTime(a));
  return [...groupBy(late, (x) => x.server).entries()]
    .map(([server, L]) => ({ server, late: L, tables: day.filter((x) => x.server === server).length }))
    .sort((a, b) => b.late.length - a.late.length || tableTime(b.late[0]) - tableTime(a.late[0]));
}
