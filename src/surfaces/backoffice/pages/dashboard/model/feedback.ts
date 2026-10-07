/**
 * Resident meal feedback: what residents said about dishes, from server
 * voice notes, quick feedback on a check and dish ratings at the table.
 * Comments before today are the demo history; today's come live from the
 * notes servers add and the ratings residents give.
 */
import { CYCLE_DAY, FEEDBACK_DISHES, FEEDBACK_TEMPLATES, type DishRating, type FeedbackSentiment } from '../../../seed/dashboard';
import { addDays } from './periods';
import { mixHash, strHash } from './hash';

export type FeedbackSource = 'Voice note' | 'Quick feedback' | 'Rating';

export interface FeedbackItem {
  id: string;
  at: number;
  /** The dish it is about, when known. */
  dish: string | null;
  text: string;
  sent: FeedbackSentiment;
  who: string;
  /** Staff initials who captured it. */
  by?: string;
  /** Table or venue. */
  where?: string;
  src: FeedbackSource;
  /** Rating detail ("Temp", "Speed"). */
  sub?: string | null;
}

// ─── History ─────────────────────────────────────────────────────────────

interface Person {
  id: string;
  name: string;
}

const atTime = (dayStart: number, h: number, m: number) => {
  const d = new Date(dayStart);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

/**
 * Comments before today. Each listed dish has comments from the last time it
 * ran on the menu cycle (and a year before); other days get a few comments
 * on random dishes, with a daily mood so some days run better than others.
 */
export function feedbackHistory(residents: Person[], todayStart: number): FeedbackItem[] {
  const out: FeedbackItem[] = [];
  const R = residents;
  if (!R.length) return out;
  for (const dish of FEEDBACK_DISHES) {
    const np = Math.round(dish.count * dish.liked);
    const nu = dish.count - np >= 2 ? 1 : 0;
    for (let i = 0; i < dish.count; i++) {
      const h = strHash(`${dish.name}:${i}`);
      const sent: FeedbackSentiment = i < np ? 'pos' : i < np + nu ? 'neu' : 'neg';
      const words = FEEDBACK_TEMPLATES[sent === 'neg' ? (dish.complaint ?? 'dry') : sent];
      const r = R[h % R.length];
      const ago = dish.cycleDay < CYCLE_DAY ? CYCLE_DAY - dish.cycleDay + (i % 3 === 2 ? 364 : 0) : dish.cycleDay === CYCLE_DAY ? 35 * (1 + (i % 2)) : 364 - (dish.cycleDay - CYCLE_DAY);
      out.push({
        id: `sfb${strHash(dish.name)}_${i}`,
        at: atTime(addDays(todayStart, -ago), dish.meal === 'L' ? 12 : 18, 10 + (h % 40)),
        dish: dish.name,
        text: words[h % words.length].replace('{d}', dish.name),
        sent,
        who: r.name,
        by: ['AA', 'MG', 'RJ'][h % 3],
        where: h % 3 === 2 ? 'Evergreen Dining Room' : 'Sequoia Dining Room',
        src: 'Voice note',
      });
    }
  }
  const perDay = new Map<number, number>();
  for (const f of out) {
    const k = addDays(f.at, 0);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  for (let back = 15; back <= 240; back++) {
    const day = addDays(todayStart, -back);
    if ((perDay.get(day) ?? 0) >= 2) continue;
    const ds = new Date(day).toDateString();
    const count = 3 + (mixHash('bn' + ds) % 7);
    const mood = ((mixHash('bm' + ds) % 25) - 12) / 100;
    for (let i = 0; i < count; i++) {
      const dish = FEEDBACK_DISHES[mixHash('bd' + ds + i) % FEEDBACK_DISHES.length];
      const b = Math.max(0.3, Math.min(0.95, dish.liked + mood));
      const u = (mixHash('bs' + ds + i) % 1000) / 1000;
      const sent: FeedbackSentiment = u < b ? 'pos' : u < b + (1 - b) / 3 ? 'neu' : 'neg';
      const words = FEEDBACK_TEMPLATES[sent === 'neg' ? (dish.complaint ?? 'dry') : sent];
      const h = mixHash('bh' + ds + i);
      const r = R[h % R.length];
      out.push({
        id: `bfb${ds.replace(/\s/g, '')}_${i}`,
        at: atTime(day, dish.meal === 'L' ? 12 : 18, 5 + (h % 50)),
        dish: dish.name,
        text: words[h % words.length].replace('{d}', dish.name),
        sent,
        who: r.name,
        by: ['AA', 'MG', 'RJ'][h % 3],
        where: h % 3 === 2 ? 'Evergreen Dining Room' : 'Sequoia Dining Room',
        src: 'Voice note',
      });
    }
  }
  return out;
}

// ─── Today ───────────────────────────────────────────────────────────────

const NEGATIVE =
  /didn.?t like|did not like|not like|disappoint|not good|overcook|burnt|soggy|greasy|salt|\bdry\b|dried out|\bcold\b|lukewarm|bland|tough|chewy|hard to chew|left most|only ate half|no flavor|too spicy|rubbery/i;
const POSITIVE = /lov|great|perfect|tender|best|delicious|fantastic|wonderful|excellent|enjoy|\bgood\b|tasty|favorite|liked/i;

/** How a free-text comment reads: a complaint wins over praise in the same breath. */
export function sentimentOf(text: string): FeedbackSentiment {
  return NEGATIVE.test(text) ? 'neg' : POSITIVE.test(text) ? 'pos' : 'neu';
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const STOP = new Set(['the', 'and', 'with', 'her', 'his', 'their', 'side', 'plate', 'tonight', 'today', 'lunch', 'dinner', 'was', 'too', 'said', 'style', 'house', 'fresh', 'over']);
const GENERIC = /^(chicken|beef|pork|turkey|soup|salad|sandwich|fish|cake|pie|bowl|pasta|cookies?|steak|tacos?|wrap)$/;

/** How strongly a comment names a dish: the full name beats some of its words. */
function nameScore(text: string, name: string): number {
  const t = ` ${norm(text)} `;
  const n = norm(name);
  if (!n) return 0;
  if (t.includes(` ${n} `)) return 100 + n.length;
  const words = n.split(' ').filter((w) => w.length > 2 && !STOP.has(w));
  const hits = words.filter((w) => t.includes(` ${w} `) || t.includes(` ${w}s `) || (w.endsWith('s') && t.includes(` ${w.slice(0, -1)} `)));
  if (!hits.length) return 0;
  // "Chicken" alone says little; it only counts when nothing better is named.
  return ((hits.every((w) => GENERIC.test(w)) && hits.length < words.length ? 6 : 40) * hits.length) / words.length + hits.length;
}

/** The dish a comment is about: first what the resident ate today, then any dish we know. */
export function matchDish(text: string, onCheck: string[], known: string[]): string | null {
  const pick = (names: string[]) => {
    let best: string | null = null;
    let score = 14;
    for (const n of names) {
      const sc = nameScore(text, n);
      if (sc > score) {
        score = sc;
        best = n;
      }
    }
    if (best) return best;
    // A weak hit counts only when it is the one candidate: "her chicken" with one chicken dish on the check.
    const weak = names.filter((n) => nameScore(text, n) > 0);
    return weak.length === 1 ? weak[0] : null;
  };
  return pick(onCheck) ?? pick(known);
}

/** A dish rating given at the table, as feedback. */
export function ratingFeedback(r: DishRating, who: string, at: number): FeedbackItem {
  const dish = r.dish;
  return {
    id: r.id,
    at,
    dish,
    text: `${dish ?? 'A dish'}: ${r.verdict.toLowerCase()}${r.sub ? `, ${r.sub.toLowerCase()}` : ''}`,
    sent: r.verdict === 'Liked' ? 'pos' : r.verdict === 'Disliked' ? 'neg' : 'neu',
    who,
    src: 'Rating',
    sub: r.sub,
  };
}

// ─── Reading the comments ────────────────────────────────────────────────

export type ThemeKey = 'salt' | 'dry' | 'temp' | 'speed' | 'portion' | 'taste';

export interface Theme {
  key: ThemeKey;
  test: RegExp;
  /** How the complaint reads in a sentence: "too salty". */
  label: string;
  /** What to do about it for one dish. */
  tip: (dish: string) => string;
  /** What to do when it shows up across several dishes (a line problem, not a recipe). */
  lineAction: string;
}

export const THEMES: Theme[] = [
  { key: 'salt', test: /salt|sodium/i, label: 'too salty', tip: (d) => `Taste the ${d} for salt before the next service.`, lineAction: 'Taste soups and sauces for salt at the start of every service' },
  {
    key: 'dry',
    test: /dry|overcook|tough|hard to chew|chewy/i,
    label: 'dry or overcooked',
    tip: (d) => `Check hold times on the ${d}; it is drying out before it goes out.`,
    lineAction: 'Check hold times at the pass; food is drying out before it goes out',
  },
  { key: 'temp', test: /cold|lukewarm|not hot|temp/i, label: 'not hot enough', tip: (d) => `Check plate warmers and how long the ${d} waits at the pass.`, lineAction: 'Check plate warmers and how long plates wait at the pass' },
  { key: 'speed', test: /slow|speed|took long|waited/i, label: 'slow to arrive', tip: (d) => `Look at ticket times for the ${d}.`, lineAction: 'Pull ticket times for the slowest shifts' },
  { key: 'portion', test: /portion|too much|too big/i, label: 'portion size', tip: (d) => `Offer a smaller portion of the ${d}.`, lineAction: 'Review portion sizes with the line' },
  { key: 'taste', test: /taste|bland|no flavor/i, label: 'flavor', tip: (d) => `Taste the ${d} for seasoning before service.`, lineAction: 'Taste every dish for seasoning before service' },
];

export const themeOf = (k: string) => THEMES.find((t) => t.key === k);

export interface ReadComment extends FeedbackItem {
  themes: ThemeKey[];
  neg: boolean;
  pos: boolean;
}

/**
 * Tag a comment with its complaint themes. The dish's own name is taken out
 * first, so "Slow Roasted Prime Rib" is not read as a complaint about speed.
 */
export function readComment(x: FeedbackItem): ReadComment {
  const body = x.src === 'Rating' ? (x.sub ?? '') : x.dish ? x.text.split(x.dish).join(' ') : x.text;
  const themes = THEMES.filter((t) => t.test.test(body)).map((t) => t.key);
  const neg = x.sent === 'neg' || themes.length > 0;
  return { ...x, themes, neg, pos: !neg && x.sent === 'pos' };
}

export interface DishTally {
  dish: string;
  neg: number;
  pos: number;
  /** Days (local midnight) it drew a complaint. */
  badDays: Set<number>;
  /** Complaint themes and how often. */
  themes: Map<ThemeKey, number>;
  /** First complaint in the user's words. */
  quote: string | null;
}

/** Per dish: complaints, praise, which days and why. */
export function tallyDishes(days: Array<{ a: number; items: FeedbackItem[] }>): Map<string, DishTally> {
  const out = new Map<string, DishTally>();
  for (const d of days)
    for (const c of d.items.map(readComment)) {
      if (!c.dish) continue;
      const t = out.get(c.dish) ?? { dish: c.dish, neg: 0, pos: 0, badDays: new Set<number>(), themes: new Map<ThemeKey, number>(), quote: null };
      if (c.neg) {
        t.neg++;
        t.badDays.add(d.a);
        for (const th of c.themes) t.themes.set(th, (t.themes.get(th) ?? 0) + 1);
        if (!t.quote && c.src !== 'Rating') t.quote = c.text;
      }
      if (c.pos) t.pos++;
      out.set(c.dish, t);
    }
  return out;
}

/** The most common complaint across these comments, with how many and over how many dishes. */
export function topTheme(items: FeedbackItem[]): { theme: Theme; n: number; dishes: number } | null {
  const by = new Map<ThemeKey, { n: number; dishes: Set<string> }>();
  for (const c of items.map(readComment))
    if (c.neg)
      for (const th of c.themes) {
        const x = by.get(th) ?? { n: 0, dishes: new Set<string>() };
        x.n++;
        if (c.dish) x.dishes.add(c.dish);
        by.set(th, x);
      }
  const best = [...by.entries()].sort((a, b) => b[1].n - a[1].n)[0];
  return best ? { theme: themeOf(best[0])!, n: best[1].n, dishes: best[1].dishes.size } : null;
}

export interface SentimentCount {
  pos: number;
  neu: number;
  neg: number;
  n: number;
}

export function countSentiment(items: FeedbackItem[]): SentimentCount {
  const c = { pos: 0, neu: 0, neg: 0, n: items.length };
  for (const x of items) c[x.sent]++;
  return c;
}

export type Trend = 'up' | 'down' | 'flat' | 'none';

/** Better or worse than the period before, by net sentiment ((positive − negative) / comments). */
export function sentimentTrend(cur: SentimentCount, prev: SentimentCount): Trend {
  if (!cur.n || !prev.n) return 'none';
  const net = (x: SentimentCount) => (x.pos - x.neg) / x.n;
  const d = net(cur) - net(prev);
  return d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'flat';
}
