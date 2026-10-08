/**
 * Resident meal sentiment: one actionable statement per view, then the
 * short lists behind it.
 */
import type { FeedbackItem, SentimentCount, Trend } from './feedback';
import { countSentiment, sentimentTrend, tallyDishes, themeOf, topTheme, type DishTally } from './feedback';
import type { Insight, Tone } from './insight';

export interface SentimentDay {
  a: number;
  today: boolean;
  items: FeedbackItem[];
  count: SentimentCount;
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Dishes with complaints, most first (ties: more days). */
const worst = (w: Map<string, DishTally>) => [...w.values()].filter((o) => o.neg > 0).sort((a, b) => b.neg - a.neg || b.badDays.size - a.badDays.size);
/** Dishes liked more than disliked, most liked first. */
const best = (w: Map<string, DishTally>) => [...w.values()].filter((o) => o.pos > o.neg).sort((a, b) => b.pos - a.pos);

/** The card's "Top action": the one move with the most effect on sentiment over the range. */
export function sentimentAction(days: SentimentDay[]): { tone: Tone; text: string } {
  const all = days.flatMap((d) => d.items);
  const th = topTheme(all);
  const w = tallyDishes(days);
  const bad = worst(w)[0];
  const good = best(w)[0];
  if (th && th.dishes > 1) return { tone: 'bad', text: `${th.theme.lineAction}. ${th.n} complaints of ${th.theme.label} across ${th.dishes} dishes.` };
  if (bad && bad.neg >= 2) {
    const fix = th ? th.theme.tip(bad.dish).replace(/\.$/, '') : `Taste the ${bad.dish} against its recipe`;
    return { tone: 'bad', text: `${fix}. ${bad.neg} residents disliked it.` };
  }
  if (good) return { tone: 'good', text: `Keep ${good.dish} on the cycle; ${good.pos} residents liked it.` };
  return { tone: 'warn', text: 'Ask servers to capture more comments; there are too few to act on.' };
}

export interface DishLine {
  dish: string;
  why: string;
  n: number;
  /** Days in the range it drew complaints. */
  days: number;
}

export interface SentimentDayDetail {
  insight: Insight | null;
  alsoDisliked: DishLine[];
  wentWell: Array<{ dish: string; pos: number }>;
}

/** One day: what went wrong first (and whether it is a pattern), then what went well. */
export function sentimentDay(days: SentimentDay[], i: number, n: number): SentimentDayDetail {
  const d = days[i];
  const range = tallyDishes(days);
  const day = tallyDishes([{ a: d.a, items: d.items }]);
  const bad = [...day.values()]
    .filter((o) => o.neg > 0 && o.neg >= o.pos)
    .map((o) => {
      const top = [...o.themes.entries()].sort((a, b) => b[1] - a[1])[0];
      const T = top ? themeOf(top[0]) : undefined;
      const w = range.get(o.dish);
      return {
        ...o,
        why: T ? T.label : 'not enjoyed',
        tip: T ? T.tip(o.dish) : `Ask the servers what residents did not like about the ${o.dish}.`,
        rangeNeg: w?.neg ?? 0,
        rangeDays: w?.badDays.size ?? 0,
      };
    })
    .sort((a, b) => b.neg - a.neg || b.rangeNeg - a.rangeNeg);
  const good = best(day);
  let insight: Insight | null = null;
  if (d.count.n) {
    const top = bad[0];
    if (top) {
      const pattern = top.rangeDays > 1;
      insight = {
        tone: 'bad',
        head: `${top.dish}: ${top.why}`,
        body:
          `${plural(top.neg, 'resident')} disliked it ${d.today ? 'today' : 'this day'}.` +
          (pattern ? ` It has drawn complaints on ${top.rangeDays} of the last ${n} days (${top.rangeNeg} in all), so this is a pattern, not a one-off.` : ` First complaint in the last ${n} days.`),
        next: top.tip,
      };
      const byWhy = new Map<string, string[]>();
      for (const o of bad) byWhy.set(o.why, [...(byWhy.get(o.why) ?? []), o.dish]);
      const shared = [...byWhy.entries()].filter(([why, list]) => list.length > 1 && why !== top.why).sort((a, b) => b[1].length - a[1].length)[0];
      if (shared) insight.body += ` Also, ${shared[1].length} dishes were ${shared[0]} (${shared[1].join(', ')}), which points to the line, not one recipe.`;
    } else {
      insight = {
        tone: 'good',
        head: `No complaints${good[0] ? `. ${good[0].dish} was the best received.` : '.'}`,
        body: good[0] ? `${plural(good[0].pos, 'resident')} liked it.` : undefined,
        next: good[0] ? 'Keep it on the cycle.' : undefined,
      };
    }
  }
  return {
    insight,
    alsoDisliked: bad.slice(1).map((o) => ({ dish: o.dish, why: o.why, n: o.neg, days: o.rangeDays })),
    wentWell: good.slice(0, 5).map((o) => ({ dish: o.dish, pos: o.pos })),
  };
}

export interface Driver {
  name: string;
  what: string;
  value: string;
  tone: 'bad' | 'good' | 'neutral';
}

export interface SentimentWeek {
  insight: Insight;
  drivers: Driver[];
  /** Negative comments per period, oldest first; the last is the current range. */
  trend: number[];
  /** Average of the 7 periods before the current one. */
  average: number;
}

const share = (part: number, x: SentimentCount) => (x.n ? Math.round((part / x.n) * 100) : 0);

/** The range against the one before: the headline, what drove it, and 8 periods of complaints. */
export function sentimentWeek(days: SentimentDay[], periods: SentimentCount[], n: number): SentimentWeek {
  const cur = countSentiment(days.flatMap((d) => d.items));
  const prev = periods[periods.length - 2];
  const trend: Trend = sentimentTrend(cur, prev);
  const label = { up: 'Improving', down: 'Getting worse', flat: 'Holding steady', none: 'Not enough comments' }[trend];
  const all = days.flatMap((d) => d.items);
  const th = topTheme(all);
  const w = tallyDishes(days);
  const bad = worst(w);
  const good = best(w);
  const head =
    trend === 'none'
      ? `Not enough comments to compare with the ${n} days before.`
      : `${label}: ${share(cur.pos, cur)}% of comments were positive and ${share(cur.neg, cur)}% negative, against ${share(prev.pos, prev)}% and ${share(prev.neg, prev)}% the ${n} days before.`;
  const body =
    (th ? `The most common complaint was ${th.theme.label} (${th.n} comments across ${plural(th.dishes, 'dish', 'dishes')})${th.dishes > 1 ? ', which points to the line rather than one recipe.' : '.'}` : '') +
    (bad[0] && bad[0].badDays.size > 1 ? ` ${bad[0].dish} drew complaints on ${bad[0].badDays.size} separate days.` : '');
  const next = th && th.dishes > 1 ? `${th.theme.lineAction}.` : bad[0] ? (th ? th.theme.tip(bad[0].dish) : `Ask servers what residents disliked about the ${bad[0].dish}.`) : 'Keep doing what is working.';
  const trendVals = periods.map((p) => p.neg);
  const average = trendVals.slice(0, -1).reduce((q, v) => q + v, 0) / Math.max(1, trendVals.length - 1);
  const drivers: Driver[] = [];
  if (bad[0]) drivers.push({ name: bad[0].dish, what: `most disliked · ${bad[0].badDays.size} of ${n} days`, value: plural(bad[0].neg, 'negative', 'negative'), tone: 'bad' });
  if (bad[1]) drivers.push({ name: bad[1].dish, what: 'next most disliked', value: `${bad[1].neg} negative`, tone: 'bad' });
  if (th) drivers.push({ name: cap(th.theme.label), what: 'most common complaint', value: plural(th.n, 'comment'), tone: 'bad' });
  if (good[0]) drivers.push({ name: good[0].dish, what: 'best received', value: `${good[0].pos} positive`, tone: 'good' });
  return {
    insight: { tone: trend === 'down' || cur.neg > cur.pos / 2 ? 'bad' : 'good', head, body: body || undefined, next },
    drivers,
    trend: trendVals,
    average,
  };
}

