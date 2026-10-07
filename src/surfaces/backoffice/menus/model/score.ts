/**
 * Recipe score out of 5, built from resident feedback (70%) and how well it
 * sells against other dishes in its category (30%). Drinks have no score.
 */
import type { Recipe } from '../../../../store/menuEdits';
import { normCategory } from './categories';
import { DAY_MS } from './cycle';

export type Sentiment = 'pos' | 'neu' | 'neg';

export interface FeedbackEntry {
  id: string;
  /** Dish name as the resident or server said it. */
  name: string;
  rid: string;
  who: string;
  text: string;
  sent: Sentiment;
  at: number;
  meal?: string;
  venue?: string;
  src: string;
}

export interface RecipeScore {
  score: number;
  n: number;
  pos: number;
  neg: number;
  neu: number;
  sales: Recipe['sales'] | null;
  trend: 'up' | 'down' | 'flat';
  feedback: FeedbackEntry[];
}

/** Lower case, words only, so "Mac & Cheese" finds "mac and cheese". */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const value = (f: FeedbackEntry) => (f.sent === 'pos' ? 5 : f.sent === 'neg' ? 1 : 3);

/**
 * Popularity 1 to 5 for every recipe with sales: its rank by orders per run
 * within its category.
 */
export function popularity(recipes: Recipe[]): Map<string, number> {
  const by = new Map<string, Array<[string, number]>>();
  for (const r of recipes) {
    if (!r.sales) continue;
    const c = normCategory(r.cat);
    by.set(c, [...(by.get(c) ?? []), [r.id, r.sales.per]]);
  }
  const out = new Map<string, number>();
  for (const list of by.values()) {
    list.sort((a, b) => a[1] - b[1]);
    list.forEach(([id], i) => out.set(id, list.length > 1 ? 1 + (4 * i) / (list.length - 1) : 3.5));
  }
  return out;
}

export function recipeScore(r: Recipe, feedback: FeedbackEntry[], pop: Map<string, number>, at: number): RecipeScore | null {
  if (normCategory(r.cat) === 'Drinks') return null;
  const fb = feedback;
  const pos = fb.filter((f) => f.sent === 'pos').length;
  const neg = fb.filter((f) => f.sent === 'neg').length;
  // One neutral 3.5 vote keeps a single comment from swinging the score to 1 or 5.
  const fromFeedback = fb.length ? (fb.reduce((a, f) => a + value(f), 0) + 3.5) / (fb.length + 1) : null;
  const fromSales = r.sales ? 2.5 + ((pop.get(r.id) ?? 3) - 1) * 0.55 : null;
  if (fromFeedback == null && fromSales == null) return null;
  const sc = fromFeedback == null ? fromSales! : fromSales == null ? fromFeedback : 0.7 * fromFeedback + 0.3 * fromSales;
  const cut = at - 21 * DAY_MS;
  const recent = fb.filter((f) => f.at >= cut);
  const older = fb.filter((f) => f.at < cut);
  const mean = (a: FeedbackEntry[]) => a.reduce((x, f) => x + value(f), 0) / a.length;
  const tr = recent.length >= 3 && older.length >= 3 ? mean(recent) - mean(older) : 0;
  return {
    score: Math.round(sc * 10) / 10,
    n: fb.length,
    pos,
    neg,
    neu: fb.length - pos - neg,
    sales: r.sales ?? null,
    trend: tr >= 0.6 ? 'up' : tr <= -0.6 ? 'down' : 'flat',
    feedback: fb,
  };
}

/** Score colours: loved, okay, needs attention. */
export function scoreTone(v: number): 'good' | 'ok' | 'bad' {
  return v >= 4.2 ? 'good' : v < 3.2 ? 'bad' : 'ok';
}

// ─── Linking a server's note to a dish ───────────────────────────────────

const STOP = new Set(['the', 'and', 'with', 'her', 'his', 'their', 'side', 'plate', 'tonight', 'today', 'lunch', 'dinner', 'was', 'too', 'said', 'style', 'house', 'fresh', 'over']);
const GENERIC = /^(chicken|beef|pork|turkey|soup|salad|sandwich|fish|cake|pie|bowl|pasta|cookies?|steak|tacos?|wrap)$/;
const tokens = (name: string) => normName(name).split(' ').filter((w) => w.length > 2 && !STOP.has(w));

/** How strongly a note's text names a dish (0 = not at all). */
export function mentionScore(text: string, name: string, short?: string): number {
  const t = ' ' + normName(text) + ' ';
  const nn = normName(name);
  if (!nn) return 0;
  if (t.includes(' ' + nn + ' ')) return 100 + nn.length;
  const sh = short ? normName(short) : '';
  if (sh && sh !== nn && sh.length > 4 && t.includes(' ' + sh + ' ')) return 80 + sh.length;
  const tk = tokens(name);
  const hit = tk.filter((w) => t.includes(' ' + w + ' ') || t.includes(' ' + w + 's ') || (w.endsWith('s') && t.includes(' ' + w.slice(0, -1) + ' ')));
  if (!hit.length) return 0;
  return ((hit.every((w) => GENERIC.test(w)) && hit.length < tk.length ? 6 : 40) * hit.length) / tk.length + hit.length;
}

/** The dish a note is about, when one stands out. */
export function noteDish<T extends { name: string; shortDefault?: string }>(text: string, dishes: T[]): T | null {
  let best: T | null = null;
  let bestScore = 14;
  for (const d of dishes) {
    const sc = mentionScore(text, d.name, d.shortDefault);
    if (sc > bestScore) {
      bestScore = sc;
      best = d;
    }
  }
  if (best) return best;
  const weak = dishes.filter((d) => {
    const sc = mentionScore(text, d.name, d.shortDefault);
    return sc > 0 && sc <= 14;
  });
  return weak.length === 1 ? weak[0] : null;
}

const NEGATIVE =
  /didn.?t like|did not like|not like|disappoint|not good|overcook|burnt|soggy|greasy|salt|\bdry\b|dried out|\bcold\b|lukewarm|bland|tough|chewy|hard to chew|left most|only ate half|no flavor|too spicy|rubbery/i;
const POSITIVE = /lov|enjoy|delicious|perfect|wonderful|great|best|excellent|tender|asked for (it )?again|seconds|\bgood\b|tasty|favorite|liked/i;

/** Sentiment of a server's note about a dish. */
export function noteSentiment(text: string): Sentiment {
  return NEGATIVE.test(text) ? 'neg' : POSITIVE.test(text) ? 'pos' : 'neu';
}
