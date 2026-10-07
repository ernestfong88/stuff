/**
 * Revenue and comps. Most meals are on the meal plan, so revenue is guest
 * meals, extras, trays and drinks: small on weekdays, larger on weekends.
 * Comps are measured as a share of it against a 5% goal.
 */
import { mixHash, strHash, unit } from './hash';
import { GOALS, money0, type Insight, type Tone } from './insight';
import type { MealName } from './service';
import type { Driver } from './sentiment';

export const COMP_REASONS = ['Wrong temperature', 'Long wait', 'Kitchen error', 'Did not like it', 'Hospice'] as const;
export type CompReason = (typeof COMP_REASONS)[number];

/** What to do about each comp reason. */
export const COMP_NEXT: Record<CompReason, string> = {
  'Wrong temperature': 'Check plate warmers and how long plates wait at the pass.',
  'Long wait': 'Pull the Steps of Service tables for that shift.',
  'Kitchen error': 'Walk the tickets with the line and confirm modifiers print.',
  'Did not like it': 'Taste the dish against its recipe before the next service.',
  Hospice: 'Hospice comps are automatic. No action needed.',
};

const COMP_ITEMS = ['Chicken Breast', 'Cheeseburger Soup', 'Salmon Burger', 'Swiss Steak', 'Classic Terrace Burger', 'Breaded Flounder', 'Beef Tips with Mushrooms'];
const APPROVERS = ['L. Park', 'D. Reyes'];

/** Daily revenue budget: weekends and Fridays bring the guests. */
export function budgetFor(day: number): number {
  const w = new Date(day).getDay();
  return w === 0 || w === 6 ? 550 : w === 5 ? 330 : 230;
}

export interface RevenueDay {
  /** Local midnight. */
  a: number;
  made: number;
  comp: number;
  reasons: CompReason[];
}

/** One day's revenue and comps. */
export function revenueDay(day: number): RevenueDay {
  const ds = new Date(day).toDateString();
  const w = new Date(day).getDay();
  const weekend = w === 0 || w === 6;
  // Cumulative chance, then the range of revenue for that kind of day.
  const bands: Array<[number, number, number]> = weekend
    ? [
        [0.05, 0, 0],
        [0.25, 30, 200],
        [0.65, 200, 600],
        [0.9, 600, 1100],
        [1, 1100, 2000],
      ]
    : w === 5
      ? [
          [0.1, 0, 0],
          [0.4, 20, 160],
          [0.75, 160, 480],
          [0.93, 480, 950],
          [1, 950, 1700],
        ]
      : [
          [0.15, 0, 0],
          [0.55, 15, 120],
          [0.85, 120, 420],
          [0.96, 420, 850],
          [1, 850, 1600],
        ];
  const r = unit('rk' + ds);
  const band = bands.find((b) => r < b[0]) ?? bands[bands.length - 1];
  const made = band[2] ? Math.round(band[1] + unit('rv' + ds) * (band[2] - band[1])) : 0;
  const ck = unit('ck' + ds);
  const share = ck < 0.14 ? 0.07 + unit('cb' + ds) * 0.07 : ck < 0.38 ? 0.004 + unit('cl' + ds) * 0.016 : 0.02 + unit('cn' + ds) * 0.04;
  const comp = made ? Math.round(made * share) : 0;
  const count = !comp ? 0 : comp < 8 ? 1 : comp < 25 ? 1 + (mixHash('cn2' + ds) % 2) : 2 + (mixHash('cn3' + ds) % 3);
  const reasons = Array.from({ length: count }, (_, i) => COMP_REASONS[mixHash('cr' + ds + i) % COMP_REASONS.length]);
  return { a: day, made, comp, reasons };
}

export interface Comp {
  reason: CompReason;
  amount: number;
  item: string;
  resident: string;
  server: string;
  approvedBy: string;
  meal: MealName;
}

/** The comps behind a day's total: who, why, which dish and who approved it. */
export function compsFor(d: RevenueDay, servers: Array<{ id: string; name: string }>, residents: string[]): Comp[] {
  const ds = new Date(d.a).toDateString();
  const S = servers.length ? servers : [{ id: 'S', name: 'Server' }];
  const weights = d.reasons.map((_, j) => 3 + (strHash('ca' + ds + j) % 9));
  const total = weights.reduce((q, c) => q + c, 0);
  let run = 0;
  return d.reasons.map((reason, j) => {
    // The last comp takes the remainder so the parts add up to the day's total.
    const amount = j === d.reasons.length - 1 ? d.comp - run : Math.round((weights[j] / total) * d.comp);
    run += amount;
    const h = strHash('cs' + ds + j);
    const sv = reason === 'Wrong temperature' && h % 3 !== 0 ? (S.find((x) => x.id === 'MT') ?? S[h % S.length]) : S[h % S.length];
    return {
      reason,
      amount,
      item: reason === 'Hospice' ? 'Dinner, full meal' : COMP_ITEMS[strHash('ci' + ds + j) % COMP_ITEMS.length],
      resident: residents[strHash('cw' + ds + j) % Math.max(1, residents.length)] ?? 'Resident',
      server: sv.name,
      approvedBy: reason === 'Hospice' ? 'Automatic' : APPROVERS[h % APPROVERS.length],
      meal: (['Breakfast', 'Lunch', 'Dinner'] as MealName[])[strHash('cm' + ds + j) % 3],
    };
  });
}

/** "Breakfast $30 · Lunch $46 · Dinner $73": a day's revenue by meal. */
export function madeByMeal(d: RevenueDay): string {
  const ds = new Date(d.a).toDateString();
  const parts = [0.22, 0.33, 0.45].map((q, j) => Math.round(d.made * q * (0.9 + (strHash('mm' + ds + j) % 20) / 100)));
  parts[2] = d.made - parts[0] - parts[1];
  return ['Breakfast', 'Lunch', 'Dinner'].map((m, j) => `${m} ${money0(parts[j])}`).join(' · ');
}

export interface RevenuePeriod {
  days: RevenueDay[];
  made: number;
  comp: number;
  /** Comps as % of revenue. */
  pct: number;
  budget: number;
}

export function revenuePeriod(days: number[]): RevenuePeriod {
  const D = days.map(revenueDay);
  const made = D.reduce((q, d) => q + d.made, 0);
  const comp = D.reduce((q, d) => q + d.comp, 0);
  return { days: D, made, comp, pct: made ? (comp / made) * 100 : 0, budget: days.reduce((q, d) => q + budgetFor(d), 0) };
}

/** "66% of budget", never rounding up to 100% while behind. */
export function budgetPct(made: number, budget: number): number {
  const p = budget ? (made / budget) * 100 : 0;
  return made >= budget ? Math.round(p) : Math.min(99, Math.floor(p));
}

const countBy = <T>(list: T[], key: (x: T) => string) => {
  const m = new Map<string, number>();
  for (const x of list) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

/** The card's "Top action". */
export function revenueAction(p: RevenuePeriod, comps: Comp[]): { tone: Tone; text: string } {
  const C = comps.filter((c) => c.reason !== 'Hospice');
  const r = countBy(C, (c) => c.reason)[0];
  const gap = p.budget - p.made;
  if (p.pct > GOALS.comp && r)
    return { tone: 'bad', text: `${COMP_NEXT[r[0] as CompReason].replace(/\.$/, '')}. ${r[0]} drove ${r[1]} of ${C.length} comps, putting comps at ${p.pct.toFixed(1)}%.` };
  if (p.budget && gap > p.budget * 0.05) {
    const weekend = p.days.filter((d) => [0, 6].includes(new Date(d.a).getDay()));
    const wMade = weekend.reduce((q, d) => q + d.made, 0);
    const wBudget = weekend.reduce((q, d) => q + budgetFor(d.a), 0);
    return {
      tone: 'warn',
      text: `${wBudget && wMade < wBudget ? 'Fill weekend guest dining: invite families to Saturday and Sunday meals' : 'Promote guest meals, wine, and à la carte extras midweek'}. Revenue is ${money0(gap)} behind budget.`,
    };
  }
  if (r && p.pct > GOALS.comp * 0.8) return { tone: 'warn', text: `${COMP_NEXT[r[0] as CompReason].replace(/\.$/, '')} before comps reach the ${GOALS.comp}% goal. ${r[0]} is the top reason.` };
  return { tone: 'good', text: 'On budget with comps in check. Keep weekend guest dining strong; it drives most revenue.' };
}

/** One day: are comps over goal, and what keeps coming up over the range. */
export function revenueDayInsight(d: RevenueDay, comps: Comp[], rangeComps: Comp[], n: number, isToday: boolean): Insight {
  const pct = d.made ? (d.comp / d.made) * 100 : 0;
  const over = pct > GOALS.comp;
  const when = isToday ? 'today' : 'this day';
  if (!d.made) return { tone: 'good', head: 'No revenue this day', body: 'Every meal was covered by the meal plan. No guest meals, extras, trays, or drinks were charged.' };
  if (!comps.length) return { tone: 'good', head: `No comps ${when}.` };
  const top = countBy(
    comps.filter((c) => c.reason !== 'Hospice'),
    (c) => c.reason,
  )[0];
  if (!top) return { tone: 'good', head: `Only hospice comps ${when}`, body: 'These are applied automatically.' };
  const same = rangeComps.filter((c) => c.reason === top[0]);
  const bySrv = countBy(same, (c) => c.server)[0];
  const byItem = countBy(same, (c) => c.item)[0];
  return {
    tone: over ? 'bad' : 'good',
    head: `${over ? `Comps at ${pct.toFixed(1)}%, over the ${GOALS.comp}% goal.` : `Comps at ${pct.toFixed(1)}%, within goal.`} ${top[1] > comps.length / 2 ? `Most were ${top[0].toLowerCase()}.` : `Top reason: ${top[0].toLowerCase()}.`}`,
    body:
      `${top[1]} of ${comps.length} comps ${when}. Last ${n} days: ${same.length} ${top[0].toLowerCase()} comps` +
      (bySrv && bySrv[1] > 1 ? `, ${bySrv[1]} on ${bySrv[0]}'s tables` : '') +
      (byItem && byItem[1] > 1 ? `, ${byItem[1]} on the ${byItem[0]}` : '') +
      '.',
    next: COMP_NEXT[top[0] as CompReason],
  };
}

export interface RevenueWeek {
  insight: Insight;
  drivers: Driver[];
}

/** The range against the one before. */
export function revenueWeek(cur: RevenuePeriod, prev: RevenuePeriod, comps: Comp[], trend: number[], n: number): RevenueWeek {
  const V = trend;
  const avg = V.slice(0, -1).reduce((q, c) => q + c, 0) / Math.max(1, V.length - 1);
  const d = V[V.length - 1] - V[V.length - 2];
  const flat = Math.abs(d) < (Math.abs(avg) * 0.05 || 0.5);
  const dir = flat ? 'Holding steady' : d < 0 ? 'Improving' : 'Getting worse';
  const over = cur.pct > GOALS.comp;
  const C = comps.filter((c) => c.reason !== 'Hospice');
  const r = countBy(C, (c) => c.reason)[0];
  const sv = countBy(C, (c) => c.server)[0];
  const it = countBy(C, (c) => c.item)[0];
  const ap = countBy(C, (c) => c.approvedBy)[0];
  const daysOver = cur.days.filter((x) => x.made && (x.comp / x.made) * 100 > GOALS.comp).length;
  const dm = cur.made - prev.made;
  const prevPct = V[V.length - 2];
  const now = V[V.length - 1];
  return {
    insight: {
      tone: over || dir === 'Getting worse' ? 'bad' : 'good',
      head: `${dir}: comps at ${cur.pct.toFixed(1)}% of revenue, ${now > prevPct ? 'up from' : now < prevPct ? 'down from' : 'same as'} ${prevPct.toFixed(1)}%. ${over ? 'Over' : 'Within'} the ${GOALS.comp}% goal.`,
      body:
        (r && sv ? `${r[0]} was the top reason (${r[1]} of ${C.length} comps). ${sv[0]}'s tables had ${sv[1]} comps${it && it[1] > 1 ? ` and the ${it[0]} was comped ${it[1]} times` : ''}. ` : '') +
        `${daysOver} of ${n} days ran over goal. Revenue ${dm >= 0 ? 'up' : 'down'} ${money0(Math.abs(dm))} to ${money0(cur.made)}.`,
      next: r ? COMP_NEXT[r[0] as CompReason] : undefined,
    },
    drivers: [
      ...(r ? [{ name: r[0], what: 'top comp reason', value: `${r[1]} comps`, tone: 'bad' as const }] : []),
      ...(sv ? [{ name: sv[0], what: 'server with the most comps', value: `${sv[1]} comps`, tone: 'bad' as const }] : []),
      ...(it && it[1] > 1 ? [{ name: it[0], what: 'most comped item', value: `${it[1]} times`, tone: 'bad' as const }] : []),
      ...(ap ? [{ name: ap[0], what: 'approved the most comps', value: `${ap[1]} comps`, tone: 'neutral' as const }] : []),
    ],
  };
}
