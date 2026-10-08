/**
 * What the manager's Metrics tab shows for Steps of Service, worked out from
 * the existing measures: each timed table's steps in the order they happen,
 * the shift's average for each step against its goal, one row per server,
 * and the one thing to do next.
 *
 *   Greet → drinks       greetInfo (Pacing & Coursing sets the goal and meals)
 *   Seated → order       checkTimes' seated to first send (no goal)
 *   Order → appetizer    sosTable, goal SOS_GOALS.app
 *   Appetizer → entrée   sosTable, goal SOS_GOALS.ent
 *   Entrée → close       checkTimes' order to close less order to entrée (no goal)
 *
 * A table is on time when both food steps make their goals (sosTable's ok),
 * as before; greet → drinks is shown beside them but does not change that.
 */
import { DEFAULT_CONFIG, type DiningConfig } from '../../../domain/config';
import { greetInfo } from '../../../domain/greet';
import { SOS_GOALS, mean, minSec, sosTable, summarize, type RunningStep, type SosSample } from '../../../domain/metrics/stepsOfService';
import { serverName } from '../../../domain/servers';
import type { Order } from '../../../domain/types';
import { checkTimes } from '../shift/closingReport';
import { tableTimeOf } from './tableTime';

export type StepKey = 'greet' | 'order' | 'app' | 'ent' | 'close';

export const STEPS: ReadonlyArray<{ key: StepKey; name: string; short: string; noun: string }> = [
  { key: 'greet', name: 'Greet → drinks', short: 'Drinks', noun: 'drinks' },
  { key: 'order', name: 'Seated → order', short: 'Order in', noun: 'order' },
  { key: 'app', name: 'Order → appetizer', short: 'Appetizer', noun: 'appetizer' },
  { key: 'ent', name: 'Appetizer → entrée', short: 'Entrée', noun: 'entrée' },
  { key: 'close', name: 'Entrée → check closed', short: 'Close', noun: 'close' },
];

export const stepName = (k: StepKey) => STEPS.find((x) => x.key === k)!.name;

/** One timed table: its minutes for each step, live or from the demo week. */
export interface TimedRow extends SosSample {
  /** Greet to drinks, and this table's goal for it (null where the meal is not timed). */
  greet: number | null;
  greetGoal: number | null;
  /** Seated to the order sent. */
  seat: number | null;
  /** Entrée served to the check closed. */
  close: number | null;
  /** The live check, to open from the list. */
  order?: Order;
  /** The food step still running on an open table. */
  running?: { key: 'app' | 'ent'; elapsed: number; goal: number };
}

/** __kSosRow: a check's steps, or null until its order is sent. */
export function timedRow(o: Order, table: string, cfg: DiningConfig = DEFAULT_CONFIG): TimedRow | null {
  const t = sosTable(o, cfg);
  if (!t) return null;
  const g = greetInfo(o);
  const c = checkTimes(o, cfg);
  return {
    app: t.app,
    ent: t.ent,
    ok: t.ok,
    server: o.server,
    table,
    greet: g?.mins ?? null,
    greetGoal: g ? g.cfg.over : null,
    seat: c.seat != null && c.seat >= 0 ? c.seat : null,
    close: c.close != null && c.main != null && c.close >= c.main ? c.close - c.main : null,
    order: o,
    running:
      t.step && t.elapsed != null && t.goal != null ? { key: t.step === 'Appetizer' ? 'app' : 'ent', elapsed: t.elapsed, goal: t.goal } : undefined,
  };
}

/** A demo-week table has only the two food steps. */
export const demoRow = (x: SosSample): TimedRow => ({ ...x, greet: null, greetGoal: null, seat: null, close: null });

/** The goal for a step on this table; null for a step without one. */
export function goalOf(r: Pick<TimedRow, 'greetGoal'>, k: StepKey): number | null {
  return k === 'app' ? SOS_GOALS.app : k === 'ent' ? SOS_GOALS.ent : k === 'greet' ? r.greetGoal : null;
}

export const valueOf = (r: TimedRow, k: StepKey): number | null => (k === 'order' ? r.seat : r[k]);

/** Is this step past its goal on this table. */
export function isLate(r: TimedRow, k: StepKey): boolean {
  const v = valueOf(r, k);
  const g = goalOf(r, k);
  return v != null && g != null && v > g;
}

export type StepTone = 'good' | 'warn' | 'bad' | 'plain' | 'none';

export interface StepStat {
  key: StepKey;
  name: string;
  /** Average minutes this shift. */
  avg: number | null;
  goal: number | null;
  /** Tables timed on this step, and how many went past the goal. */
  n: number;
  late: number;
  /** Minutes from seated when the step starts, on the stepped bar. */
  start: number;
  /** Red past the goal, amber within a tenth of it, green under; plain with no goal. */
  tone: StepTone;
  /** The step furthest from its goal, when it is not green. */
  slowest: boolean;
}

function toneOf(avg: number | null, goal: number | null): StepTone {
  if (avg == null) return 'none';
  if (goal == null) return 'plain';
  return avg > goal ? 'bad' : avg > goal * 0.9 ? 'warn' : 'good';
}

/** The most common value; the first on a tie. */
function mostCommon<T>(xs: T[]): T | null {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * __kSosSteps: each step's average against its goal, in the order they
 * happen. The food steps' averages are summarize()'s, so they match the
 * table time headline.
 */
export function stepSummary(rows: TimedRow[]): StepStat[] {
  const sum = summarize(rows);
  const avg: Record<StepKey, number | null> = {
    greet: mean(rows.map((r) => r.greet)),
    order: mean(rows.map((r) => r.seat)),
    app: sum.app,
    ent: sum.ent,
    close: mean(rows.map((r) => r.close)),
  };
  const goal: Record<StepKey, number | null> = {
    greet: mostCommon(rows.filter((r) => r.greet != null && r.greetGoal != null).map((r) => r.greetGoal as number)),
    order: null,
    app: SOS_GOALS.app,
    ent: SOS_GOALS.ent,
    close: null,
  };
  // The food steps follow on from the order; greet → drinks happens inside seated → order.
  const starts: Record<StepKey, number> = { greet: 0, order: 0, app: 0, ent: 0, close: 0 };
  starts.app = avg.order ?? 0;
  starts.ent = starts.app + (avg.app ?? 0);
  starts.close = starts.ent + (avg.ent ?? 0);
  const out = STEPS.map(({ key, name }) => ({
    key,
    name,
    avg: avg[key],
    goal: goal[key],
    n: rows.filter((r) => valueOf(r, key) != null).length,
    late: rows.filter((r) => isLate(r, key)).length,
    start: starts[key],
    tone: toneOf(avg[key], goal[key]),
    slowest: false,
  }));
  const worst = out
    .filter((x) => x.avg != null && x.goal)
    .sort((a, b) => (b.avg as number) / (b.goal as number) - (a.avg as number) / (a.goal as number))[0];
  if (worst && worst.tone !== 'good') worst.slowest = true;
  return out;
}

/** The step a set of tables is slowest on against its goal, of the steps that have one. */
function slowestStep(rows: TimedRow[]): { key: StepKey; avg: number; goal: number } | null {
  const best = stepSummary(rows)
    .filter((x) => x.avg != null && x.goal)
    .sort((a, b) => (b.avg as number) / (b.goal as number) - (a.avg as number) / (a.goal as number))[0];
  return best ? { key: best.key, avg: best.avg as number, goal: best.goal as number } : null;
}

/** How far past its goal a table's worst step went, and which step. */
export function worstStep(r: TimedRow): { key: StepKey; mins: number; goal: number; over: number } | null {
  let out: { key: StepKey; mins: number; goal: number; over: number } | null = null;
  for (const { key } of STEPS) {
    const v = valueOf(r, key);
    const g = goalOf(r, key);
    if (v == null || g == null || v <= g) continue;
    if (!out || v - g > out.over) out = { key, mins: v, goal: g, over: v - g };
  }
  return out;
}

export interface ServerRow {
  server: string;
  n: number;
  /** Tables whose food came out on time. */
  onTime: number;
  /** Average table time (order to entrée), as the headline works it out. */
  avg: number | null;
  slowest: { key: StepKey; avg: number; goal: number } | null;
  /** Their table furthest past a step goal. */
  worst: { table: string; key: StepKey; mins: number; goal: number } | null;
}

/** __kSosServers: one row per server, the biggest share of late tables first, then the slowest. */
export function serverRows(rows: TimedRow[]): ServerRow[] {
  const groups = new Map<string, TimedRow[]>();
  for (const r of rows) groups.set(r.server, [...(groups.get(r.server) ?? []), r]);
  return [...groups.entries()]
    .map(([server, L]) => {
      const w = L.map((r) => ({ r, w: worstStep(r) }))
        .filter((x) => x.w)
        .sort((a, b) => b.w!.over - a.w!.over)[0];
      return {
        server,
        n: L.length,
        onTime: L.filter((r) => r.ok).length,
        avg: tableTimeOf(summarize(L)),
        slowest: slowestStep(L),
        worst: w ? { table: w.r.table, key: w.w!.key, mins: w.w!.mins, goal: w.w!.goal } : null,
      };
    })
    .sort((a, b) => 1 - b.onTime / b.n - (1 - a.onTime / a.n) || (b.avg ?? -1) - (a.avg ?? -1));
}

/** Tables past a goal first (furthest past first), then the rest, slowest first. */
export function sortRows(rows: TimedRow[]): TimedRow[] {
  const over = (r: TimedRow) => worstStep(r)?.over ?? (r.running ? r.running.elapsed - r.running.goal : -99);
  return [...rows].sort((a, b) => over(b) - over(a));
}

export type Tone = 'good' | 'warn' | 'bad';

export interface NextStep {
  tone: Tone;
  /** What to do, in one sentence. */
  act: string;
  /** Why, in one line. */
  why: string;
  /** The table to open, when the action is about one. */
  order?: Order;
  /** Other open tables near or past a goal, to open next. */
  also: RunningStep[];
}

const stepWords = (k: StepKey) => (k === 'ent' ? 'entrée pacing' : k === 'app' ? 'appetizer timing' : k === 'greet' ? 'getting drinks out' : 'pace');

/**
 * __kSosNext: one thing to do now, in the dashboard's words. An open table
 * near or past a step goal comes first (atRisk, furthest past first); then
 * the server with the most late tables, about their slowest step; else keep
 * the pace.
 */
export function nextStep(risk: RunningStep[], servers: ServerRow[], tableTime: number | null, nameOf: (o: Order) => string): NextStep {
  const [x, ...also] = risk;
  if (x) {
    const t = nameOf(x.order);
    const step = x.step.toLowerCase();
    const past = x.elapsed > x.goal;
    const act =
      x.why?.kind === 'run'
        ? `Have a runner take ${t}’s ${step} out now.`
        : x.why?.kind === 'cook'
          ? `Ask the kitchen to push ${t}’s ${step}.`
          : `Have ${serverName(x.order.server)} fire ${t}’s ${step}.`;
    const when = past ? `${minSec(x.elapsed)} min, past the ${x.goal} min goal` : `${minSec(x.elapsed)} min, due at ${x.goal}`;
    return { tone: past ? 'bad' : 'warn', act, why: `${x.step} ${when}${x.why ? `. ${x.why.text}.` : '.'}`, order: x.order, also };
  }
  const g = servers.find((r) => r.onTime < r.n);
  if (g) {
    const who = serverName(g.server);
    const late = g.n - g.onTime;
    const sl = g.slowest;
    return {
      tone: 'warn',
      act: `Talk to ${who} about ${sl ? stepWords(sl.key) : 'pace'}.`,
      why: `${late === g.n ? `All ${g.n}` : `${late} of ${who}’s ${g.n}`} ${late === g.n ? `of ${who}’s tables` : 'tables'} ${late === 1 ? 'was' : 'were'} late${sl ? `; ${STEPS.find((s) => s.key === sl.key)!.noun} averages ${sl.avg.toFixed(1)} min against ${sl.goal}` : ''}.`,
      also: [],
    };
  }
  return {
    tone: 'good',
    act: 'Nothing to fix. Keep the pace.',
    why: tableTime == null ? 'No tables timed yet.' : `Every table got its food on time; average table time ${tableTime.toFixed(1)} min.`,
    also: [],
  };
}
