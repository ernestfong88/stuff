/**
 * Steps of Service: two timed steps per seated table.
 *
 *   Order → appetizer   order sent until the starters reach the table
 *   Appetizer → entrée  starters served (or the order, with no starter)
 *                       until the entrées reach the table
 *
 * A table misses when either step runs past its goal. The community's goal
 * is that 90% of tables make both steps.
 */
import { DAY, MINUTE, now, startOfToday } from '../../lib/clock';
import { DEFAULT_CONFIG, type DiningConfig } from '../config';
import { courseSummaries, firstSend, normalizeOrder, type CourseSummary } from '../courses';
import type { MealName, Order } from '../types';

/** Goals in minutes, and the share of tables that should make both steps. */
export const SOS_GOALS = { app: 7, ent: 15, sos: 90 } as const;

export const MEALS: MealName[] = ['Breakfast', 'Lunch', 'Dinner'];

/** Share of tables (percent) that may miss and still be on goal. */
export function missGoalPercent(): number {
  return 100 - SOS_GOALS.sos;
}

export function missPercent(missed: number, total: number): number {
  return total ? (missed / total) * 100 : 0;
}

export function offGoal(missed: number, total: number): boolean {
  return missPercent(missed, total) > missGoalPercent();
}

export type SosStep = 'Appetizer' | 'Entrée';

export interface SosReason {
  text: string;
  /** Who can fix it. */
  who: string;
}

export interface SosTable {
  order: Order;
  /** Minutes for each step once it is done. */
  app: number | null;
  ent: number | null;
  /** The step still running, with its minutes so far and goal. */
  step: SosStep | null;
  elapsed: number | null;
  goal: number | null;
  /** "since the order", "since the appetizer was served" ... */
  from: string | null;
  why: SosReason | null;
  ok: boolean;
  /** At least one step is measured. */
  done: boolean;
}

/** __kTTMealOf: the check's meal, or the meal its open time falls in. */
export function mealOf(o: Order): MealName {
  if (o.meal) return o.meal;
  const h = new Date(o.openedAt).getHours();
  return h < 10.5 ? 'Breakfast' : h < 16 ? 'Lunch' : 'Dinner';
}

/** __kShiftMeal: the meal most open tables are on (dinner when none). */
export function shiftMeal(open: Order[]): MealName {
  const count: Partial<Record<MealName, number>> = {};
  for (const o of open) count[o.meal] = (count[o.meal] ?? 0) + 1;
  const best = (Object.keys(count) as MealName[]).sort((a, b) => (count[b] ?? 0) - (count[a] ?? 0))[0];
  return best ?? 'Dinner';
}

function reasonFor(c: CourseSummary, at: number): SosReason {
  if (c.ready) return { text: `Ready at the pass ${Math.max(1, Math.round((at - c.ready) / MINUTE))} min, not run`, who: 'Expo or a runner' };
  if (c.fired) return { text: `Still cooking, fired ${Math.max(1, Math.round((at - c.fired) / MINUTE))} min ago`, who: 'Kitchen' };
  return { text: 'Not fired yet', who: 'Server' };
}

/** __kSosLive: a check's two steps, measured or still running. Null until the order is sent. */
export function sosTable(raw: Order, cfg: DiningConfig = DEFAULT_CONFIG): SosTable | null {
  const o = normalizeOrder(raw);
  const first = firstSend(o);
  if (!first) return null;
  const at = now();
  const cs = courseSummaries(o, cfg);
  const c1 = cs.find((c) => c.c === 1);
  const c2 = cs.find((c) => c.c === 2) ?? cs.find((c) => c.kds && c.c !== 1);
  const appDone = c1 ? c1.run : null;
  const entStart = c1 ? appDone : first;
  const entDone = c2 ? c2.run : null;
  const app = c1 && appDone ? (appDone - first) / MINUTE : null;
  const ent = entStart && entDone ? (entDone - entStart) / MINUTE : null;

  let step: SosStep | null = null;
  let elapsed: number | null = null;
  let goal: number | null = null;
  let from: string | null = null;
  let current: CourseSummary | null = null;
  if (c1 && !appDone) {
    step = 'Appetizer';
    elapsed = (at - first) / MINUTE;
    goal = SOS_GOALS.app;
    current = c1;
    from = 'since the order';
  } else if (c2 && !entDone && entStart) {
    step = 'Entrée';
    elapsed = (at - entStart) / MINUTE;
    goal = SOS_GOALS.ent;
    current = c2;
    from = c1 ? 'since the appetizer was served' : 'since the order, no appetizer';
  }
  return {
    order: raw,
    app,
    ent,
    step,
    elapsed,
    goal,
    from,
    why: current ? reasonFor(current, at) : null,
    ok: (app == null || app <= SOS_GOALS.app) && (ent == null || ent <= SOS_GOALS.ent),
    done: app != null || ent != null,
  };
}

/** A step still running on an open table. */
export interface RunningStep extends SosTable {
  step: SosStep;
  elapsed: number;
  goal: number;
}

function isRunning(x: SosTable | null): x is RunningStep {
  return !!x && x.step != null && x.elapsed != null && x.goal != null;
}

/** Help now: open tables within two minutes of a step goal or past it, furthest past first. */
export function atRisk(open: Order[], cfg: DiningConfig = DEFAULT_CONFIG): RunningStep[] {
  return open
    .map((o) => sosTable(o, cfg))
    .filter(isRunning)
    .filter((x) => x.elapsed >= x.goal - 2)
    .sort((a, b) => b.elapsed - b.goal - (a.elapsed - a.goal));
}

/** One measured table, live or from the demo week. */
export interface SosSample {
  app: number | null;
  ent: number | null;
  ok: boolean;
  server: string;
  table: string;
}

/** Z1: the small string hash the demo week is built from. */
function hash9973(s: string): number {
  let t = 0;
  for (const ch of s) t = (t * 31 + ch.charCodeAt(0)) % 9973;
  return t;
}

/** A well-mixed integer from a key, so neighbouring days look different. */
function mix(key: string): number {
  let x = Math.imul(hash9973(key) | 0, 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
}

/** Servers the demo week is spread across, with a slow habit each. */
const DEMO_SERVERS = ['AA', 'RJ', 'MG'];

export interface DemoSosTable extends SosSample {
  meal: MealName;
  app: number;
  ent: number;
}

/**
 * __kSosTables: a believable day of measured tables for the demo, the same
 * every time for the same date. Some days are smooth, some are rough.
 */
export function demoSosTables(day: Date): DemoSosTable[] {
  const ds = day.toDateString();
  const q = mix('dq' + ds) % 100;
  const band = q < 30 ? [2, 3] : q < 75 ? [4, 6] : [7, 10];
  const spread = (k: string) => band[0] + (mix('sp' + k + ds) % (band[1] - band[0] + 1));
  const noise =
    q < 30 ? -2.5 + (mix('no' + ds) % 150) / 100 : q < 75 ? -0.5 + (mix('no' + ds) % 250) / 100 : 2.5 + (mix('no' + ds) % 350) / 100;
  const out: DemoSosTable[] = [];
  for (const meal of MEALS) {
    const n = (meal === 'Dinner' ? 12 : meal === 'Lunch' ? 10 : 6) + (mix('nt' + meal + ds) % 6);
    const mealBias = meal === 'Dinner' ? 0.9 : meal === 'Breakfast' ? -0.6 : 0;
    const pa = spread('a' + meal);
    const pe = spread('e' + meal);
    for (let i = 0; i < n; i++) {
      const server = DEMO_SERVERS[mix('st' + ds + meal + i) % DEMO_SERVERS.length];
      const habit = server === 'MG' && meal === 'Dinner' ? 0.9 : server === 'RJ' && meal === 'Lunch' ? 0.5 : 0;
      const app = Math.max(
        2.5,
        3.3 + noise * 0.25 + (mix('sa' + ds + meal + i) % 30) / 10 + mealBias * 0.4 + (server === 'RJ' ? habit * 1.4 : 0) +
          (mix('xa' + ds + meal + i) % 100 < pa ? 3.6 : 0),
      );
      const ent = Math.max(
        6,
        12.8 + noise * 0.85 + (mix('se' + ds + meal + i) % 42) / 10 + mealBias * 1.3 + (server === 'MG' ? habit : 0) +
          (mix('xe' + ds + meal + i) % 100 < pe ? 5 : 0),
      );
      const room = mix('st' + ds + meal + i) % 3 === 2 ? 'EG' : 'SQ';
      out.push({
        meal,
        app,
        ent,
        server,
        table: `${room} ${1 + (mix('tb' + ds + meal + i) % 14)}`,
        ok: app <= SOS_GOALS.app && ent <= SOS_GOALS.ent,
      });
    }
  }
  return out;
}

export function mean(values: Array<number | null | undefined>): number | null {
  const v = values.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export interface SosSummary {
  n: number;
  app: number | null;
  ent: number | null;
  /** Tables late on each step. */
  lateApp: number;
  lateEnt: number;
  missed: number;
}

export function summarize(samples: SosSample[]): SosSummary {
  return {
    n: samples.length,
    app: mean(samples.map((x) => x.app)),
    ent: mean(samples.map((x) => x.ent)),
    lateApp: samples.filter((x) => x.app != null && x.app > SOS_GOALS.app).length,
    lateEnt: samples.filter((x) => x.ent != null && x.ent > SOS_GOALS.ent).length,
    missed: samples.filter((x) => !x.ok).length,
  };
}

export interface ServerSos {
  server: string;
  n: number;
  missed: number;
  app: number | null;
  ent: number | null;
}

/** By server, the most misses first. */
export function byServer(samples: SosSample[]): ServerSos[] {
  const groups = new Map<string, SosSample[]>();
  for (const x of samples) groups.set(x.server, [...(groups.get(x.server) ?? []), x]);
  return [...groups.entries()]
    .map(([server, list]) => ({
      server,
      n: list.length,
      missed: list.filter((x) => !x.ok).length,
      app: mean(list.map((x) => x.app)),
      ent: mean(list.map((x) => x.ent)),
    }))
    .sort((a, b) => b.missed - a.missed);
}

/** The last seven days of this meal from the demo week, oldest first. */
export function lastWeek(meal: MealName): SosSummary[] {
  const t0 = startOfToday();
  return Array.from({ length: 7 }, (_, i) => summarize(demoSosTables(new Date(t0 - (7 - i) * DAY)).filter((x) => x.meal === meal)));
}

/** "We", "Th" ... for the seven days before today, then "Now". */
export function weekLabels(): string[] {
  const t0 = startOfToday();
  return [
    ...Array.from({ length: 7 }, (_, i) => new Date(t0 - (7 - i) * DAY).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)),
    'Now',
  ];
}

/** "4:05" from minutes. */
export function minSec(mins: number): string {
  const t = Math.max(0, Math.floor(mins * 60));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
