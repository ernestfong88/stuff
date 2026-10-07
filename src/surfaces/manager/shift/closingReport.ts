/**
 * The manager's closing report: what the shift made, its ticket times
 * against the last shift of the same meal, and today's dining feedback.
 */
import { dinerBilling } from '../../../domain/billing';
import { DEFAULT_CONFIG, type DiningConfig } from '../../../domain/config';
import { courseSummaries, firstSend, normalizeOrder } from '../../../domain/courses';
import { dinerName } from '../../../domain/orders';
import type { MealName, Order, ResidentNote } from '../../../domain/types';
import { MINUTE } from '../../../lib/clock';
import { mean } from '../metrics/stepsOfService';

// ─── Money ───────────────────────────────────────────────────────────────

export interface Charge {
  who: string;
  kind: 'apt' | 'card';
  amt: number;
}

export interface Comp {
  who: string;
  reason: string;
  amt: number;
}

/**
 * __kMgrMoney: charges and comps on a closed check. A diner's payment is
 * "plan", "apt", "card" or "comp", optionally with the amount (and the comp
 * reason) after colons, e.g. "card:34:sq_7F3K2" or "comp:Sick:22". When the
 * amount is not in the drop, the diner's chargeAmt is used, and failing that
 * what the meal plan did not cover.
 */
export function checkMoney(o: Order, cfg: DiningConfig = DEFAULT_CONFIG): { charges: Charge[]; comps: Comp[] } {
  const charges: Charge[] = [];
  const comps: Comp[] = [];
  for (const d of o.diners) {
    const [kind, a, b] = String(d.chargeDrop || 'plan').split(':');
    const who = dinerName(d);
    if (kind === 'comp') {
      comps.push({ who, reason: a || o.comp?.reason || 'Comp', amt: Number(b) || d.chargeAmt || 0 });
    } else if (kind === 'apt' || kind === 'card') {
      const amt = Number(a) || d.chargeAmt || dinerBilling(d, o, cfg).outOfPlan;
      if (amt > 0) charges.push({ who, kind, amt });
    }
  }
  return { charges, comps };
}

export interface ShiftMoney {
  total: number;
  card: number;
  apt: number;
  comps: number;
  compTotal: number;
  checks: number;
  covers: number;
}

const sum = (xs: Array<{ amt: number }>) => xs.reduce((n, x) => n + x.amt, 0);

export function shiftMoney(closed: Order[], cfg: DiningConfig = DEFAULT_CONFIG): ShiftMoney {
  const all = closed.map((o) => checkMoney(o, cfg));
  const charges = all.flatMap((m) => m.charges);
  const comps = all.flatMap((m) => m.comps);
  return {
    total: sum(charges),
    card: sum(charges.filter((c) => c.kind === 'card')),
    apt: sum(charges.filter((c) => c.kind === 'apt')),
    comps: comps.length,
    compTotal: sum(comps),
    checks: closed.length,
    covers: closed.reduce((n, o) => n + o.diners.length, 0),
  };
}

// ─── Ticket times ────────────────────────────────────────────────────────

export type TicketKey = 'seat' | 'main' | 'close';

export const TICKET_TIMES: ReadonlyArray<{ key: TicketKey; label: string }> = [
  { key: 'seat', label: 'Seated to order' },
  { key: 'main', label: 'Order to main course' },
  { key: 'close', label: 'Order to close' },
];

/** The last seven dinners; other meals scale by their usual pace. */
const WEEK: Record<TicketKey, number[]> = {
  seat: [6.8, 7.4, 6.1, 6.6, 7.9, 6.3, 7],
  main: [27.5, 29.1, 26.2, 27.9, 30.4, 25.8, 26.9],
  close: [54, 57, 51, 55, 59, 52, 53],
};
const MEAL_PACE: Record<MealName, number> = { Breakfast: 0.72, Lunch: 0.86, Dinner: 1 };

/** __kTTWeek */
export function ticketWeek(key: TicketKey, meal: MealName): number[] {
  return WEEK[key].map((v) => v * MEAL_PACE[meal]);
}

/** __kTTCheck: minutes from seated to order, order to main course, order to close. */
export function checkTimes(raw: Order, cfg: DiningConfig = DEFAULT_CONFIG): Partial<Record<TicketKey, number>> {
  const o = normalizeOrder(raw);
  const first = firstSend(o);
  if (!first) return {};
  const out: Partial<Record<TicketKey, number>> = { seat: (first - o.openedAt) / MINUTE };
  const cs = courseSummaries(o, cfg);
  const main = cs.find((c) => c.c === 2) ?? cs.find((c) => c.kds);
  if (main?.run) out.main = (main.run - first) / MINUTE;
  if (o.closedAt) out.close = (o.closedAt - first) / MINUTE;
  return out;
}

/** __kTTAgg: the average of each ticket time over these checks. */
export function ticketTimes(list: Order[], cfg: DiningConfig = DEFAULT_CONFIG): Record<TicketKey, number | null> {
  const all = list.map((o) => checkTimes(o, cfg));
  const avg = (k: TicketKey) => mean(all.map((t) => t[k]).filter((x) => x != null && x >= 0));
  return { seat: avg('seat'), main: avg('main'), close: avg('close') };
}

/** __kTTFmt: "6.8 min", "27 min", or "Not yet". */
export function formatMinutes(v: number | null): string {
  return v == null ? 'Not yet' : `${v < 10 ? v.toFixed(1) : String(Math.round(v))} min`;
}

// ─── Feedback ────────────────────────────────────────────────────────────

const THEMES: ReadonlyArray<[key: string, re: RegExp, label: string]> = [
  ['salt', /salt|sodium/i, 'too salty'],
  ['dry', /dry|overcook|tough|hard to chew|chewy/i, 'dry or overcooked'],
  ['temp', /cold|lukewarm|not hot|temp/i, 'not hot enough'],
  ['speed', /slow|speed|took long|waited/i, 'slow to arrive'],
  ['portion', /portion|too much|too big/i, 'portion size'],
  ['taste', /taste|bland|no flavor/i, 'flavor'],
];
const POSITIVE = /lov|great|perfect|tender|best|delicious|fantastic|wonderful|excellent|enjoy/i;
const REQUEST = /wish|bring back|would like|could we|asked for|asked if|more of/i;

/** Words in a comment that name a dish on the menu. Longer matches first. */
const DISH_WORDS: ReadonlyArray<[string, string]> = [
  ['peach', 'Peach Glazed Chicken Breast'],
  ['shells', 'Cheese Stuffed Shells with Marinara'],
  ['cheeseburger soup', 'Cheeseburger Soup'],
  ['soup', 'Cheeseburger Soup'],
  ['flounder', 'Breaded Flounder'],
  ['orange chicken', 'Orange Chicken Bowl'],
  ['trifle', 'Pineapple Trifle'],
  ['reuben', 'Reuben Sandwich'],
  ['salmon', 'Salmon Burger'],
  ['burger', 'Classic Terrace Burger'],
  ['chicken', 'Chicken Breast'],
  ['pot roast', 'Pot Roast'],
];

export interface FeedbackIssue {
  key: string;
  label: string;
  n: number;
  dishes: string[];
}

export interface FeedbackSummary {
  /** One paragraph: how many comments, the standout and the main concern. */
  head: string;
  /** Dishes with positive comments, most first: [dish, count]. */
  liked: Array<[string, number]>;
  issues: FeedbackIssue[];
}

function countBy<T>(rows: T[], key: (r: T) => string | null): Array<[string, number]> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** __kFbSummary over the dining feedback servers noted today. */
export function feedbackSummary(notes: Array<Pick<ResidentNote, 'rid' | 'text'>>): FeedbackSummary | null {
  if (!notes.length) return null;
  const rows = notes.map((n) => {
    const t = n.text.toLowerCase();
    const themes = THEMES.filter(([, re]) => re.test(t)).map(([k]) => k);
    const neg = themes.length > 0;
    return {
      rid: n.rid,
      themes,
      dish: DISH_WORDS.find(([w]) => t.includes(w))?.[1] ?? null,
      neg,
      ask: REQUEST.test(t),
      pos: !neg && POSITIVE.test(t),
    };
  });
  const pos = rows.filter((r) => r.pos);
  const neg = rows.filter((r) => r.neg);
  const ask = rows.filter((r) => r.ask);
  const liked = countBy(pos, (r) => r.dish);
  const issues: FeedbackIssue[] = [];
  for (const [key, , label] of THEMES) {
    const hit = neg.filter((r) => r.themes.includes(key));
    if (hit.length) issues.push({ key, label, n: hit.length, dishes: countBy(hit, (r) => r.dish).map((x) => x[0]) });
  }
  issues.sort((a, b) => b.n - a.n);

  const residents = new Set(rows.map((r) => r.rid)).size;
  const s = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const are = (dish: string) => (dish.endsWith('s') ? 'are' : 'is');
  let head =
    `${s(rows.length, 'comment')} from ${s(residents, 'resident')} today: ${pos.length} positive, ${s(neg.length, 'concern')}` +
    (ask.length ? `, ${s(ask.length, 'request')}` : '') +
    '.';
  if (liked[0]) head += ` The ${liked[0][0]} ${are(liked[0][0])} the standout, with ${liked[0][1]} positive ${liked[0][1] === 1 ? 'comment' : 'comments'}.`;
  if (issues[0]) {
    const top = issues[0];
    head += ` The most common concern is ${top.label} (${top.n})${top.dishes.length ? `, mostly the ${top.dishes.slice(0, 2).join(' and the ')}` : ''}.`;
  }
  return { head, liked, issues };
}
