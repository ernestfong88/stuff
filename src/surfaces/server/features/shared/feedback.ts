/**
 * Dining feedback: what residents said about the food, tied to a dish and
 * summed up for the culinary team.
 *
 * A comment is linked to the dish it is about: first the resident's own
 * check today, then today's menu. The summary groups comments by dish and
 * by theme (too salty, dry, not hot enough ...) and turns the most common
 * concerns into plain suggestions for the kitchen.
 */
import { catalog, getItem } from '../../../../data';
import { isDrink, shortName } from '../../../../domain/menu';
import type { Order, ResidentNote } from '../../../../domain/types';

export type Sentiment = 'pos' | 'neu' | 'neg';

export const SENTIMENT_LABEL: Record<Sentiment, string> = { pos: 'Positive', neu: 'Neutral', neg: 'Negative' };

const POSITIVE = /lov|great|perfect|tender|best|delicious|fantastic|wonderful|excellent|enjoy|\bgood\b|tasty|favorite|liked/i;
const NEGATIVE =
  /didn.?t like|did not like|not like|disappoint|not good|overcook|burnt|soggy|greasy|salt|\bdry\b|dried out|\bcold\b|lukewarm|bland|tough|chewy|hard to chew|left most|only ate half|no flavor|too spicy|rubbery/i;
const ASK = /wish|bring back|would like|could we|asked for|asked if|more of/i;

/** Is a comment positive, negative or neither? */
export function sentimentOf(text: string): Sentiment {
  if (NEGATIVE.test(text)) return 'neg';
  return POSITIVE.test(text) ? 'pos' : 'neu';
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
const tokens = (name: string) => norm(name).split(' ').filter((w) => w.length > 2 && !STOP.has(w));

/** How strongly a comment mentions a dish (0 = not at all). */
export function dishScore(text: string, name: string): number {
  const t = ` ${norm(text)} `;
  const full = norm(name);
  if (!full) return 0;
  if (t.includes(` ${full} `)) return 100 + full.length;
  const short = norm(shortName(name));
  if (short && short !== full && short.length > 4 && t.includes(` ${short} `)) return 80 + short.length;
  const tk = tokens(name);
  const hit = tk.filter((w) => t.includes(` ${w} `) || t.includes(` ${w}s `) || (w.endsWith('s') && t.includes(` ${w.slice(0, -1)} `)));
  if (!hit.length) return 0;
  const weak = hit.every((w) => GENERIC.test(w)) && hit.length < tk.length;
  return ((weak ? 6 : 40) * hit.length) / tk.length + hit.length;
}

interface DishCandidate {
  name: string;
  entree: boolean;
}

function bestDish(text: string, list: DishCandidate[]): DishCandidate | null {
  let best: DishCandidate | null = null;
  let bestScore = 14;
  for (const c of list) {
    const sc = dishScore(text, c.name);
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  if (best) return best;
  const weak = list.filter((c) => {
    const sc = dishScore(text, c.name);
    return sc > 0 && sc <= 14;
  });
  return weak.length === 1 ? weak[0] : null;
}

/** Dishes (not drinks) a resident had on these checks, once each. */
export function residentDishes(residentId: string, checks: Order[]): DishCandidate[] {
  const seen = new Set<string>();
  const out: DishCandidate[] = [];
  for (const o of checks)
    for (const d of o.diners)
      if (d.kind === 'resident' && !d.isGuest && d.refId === residentId)
        for (const l of d.items) {
          const it = l.cancelled ? undefined : getItem(l.itemId);
          if (!it || isDrink(it.id) || seen.has(it.name)) continue;
          seen.add(it.name);
          out.push({ name: it.name, entree: !!(it.entree || it.etype) });
        }
  return out;
}

let menuCache: DishCandidate[] | null = null;
function menuDishes(): DishCandidate[] {
  if (menuCache) return menuCache;
  const seen = new Set<string>();
  menuCache = [...catalog]
    .sort((a, b) => Number(!!b.special) - Number(!!a.special))
    .filter((it) => !isDrink(it.id) && !seen.has(it.name) && !!seen.add(it.name))
    .map((it) => ({ name: it.name, entree: !!it.entree }));
  return menuCache;
}

export type DishMatch = { name: string; how: 'check' | 'menu' | 'guess' } | null;

/** Which dish a comment is about: the resident's check first, then today's menu. */
export function matchDish(text: string, residentId: string, checks: Order[]): DishMatch {
  const mine = residentDishes(residentId, checks);
  const onCheck = bestDish(text, mine);
  if (onCheck) return { name: onCheck.name, how: 'check' };
  const onMenu = bestDish(text, menuDishes());
  if (onMenu) return { name: onMenu.name, how: 'menu' };
  const entrees = mine.filter((d) => d.entree);
  return entrees.length === 1 ? { name: entrees[0].name, how: 'guess' } : null;
}

// ─── Summary ─────────────────────────────────────────────────────────────

const THEMES: ReadonlyArray<{ key: string; re: RegExp; label: string; tip: (dish: string) => string }> = [
  { key: 'salt', re: /salt|sodium/i, label: 'too salty', tip: (d) => `Taste the ${d} for salt before the next service.` },
  { key: 'dry', re: /dry|overcook|tough|hard to chew|chewy/i, label: 'dry or overcooked', tip: (d) => `Check hold times on the ${d}; it is drying out before it goes out.` },
  { key: 'temp', re: /cold|lukewarm|not hot|temp/i, label: 'not hot enough', tip: (d) => `Check plate warmers and how long the ${d} waits at the pass.` },
  { key: 'speed', re: /slow|speed|took long|waited/i, label: 'slow to arrive', tip: (d) => `Look at ticket times for the ${d}.` },
  { key: 'portion', re: /portion|too much|too big/i, label: 'portion size', tip: (d) => `Offer a smaller portion of the ${d}.` },
  { key: 'taste', re: /taste|bland|no flavor/i, label: 'flavor', tip: (d) => `Taste the ${d} for seasoning before service.` },
];

export interface FeedbackItem {
  id: string;
  /** Resident's full name. */
  who: string;
  /** Staff initials of the server who passed it on. */
  by?: string;
  where?: string;
  text: string;
  at: number;
  source: string;
  dish: string | null;
}

export interface FeedbackRow extends FeedbackItem {
  themes: string[];
  pos: boolean;
  neg: boolean;
  ask: boolean;
}

export interface FeedbackSummary {
  rows: FeedbackRow[];
  head: string;
  liked: Array<[string, number]>;
  issues: Array<{ key: string; label: string; n: number; dishes: string[] }>;
  asks: FeedbackRow[];
  todo: string[];
  byDish: Array<{ dish: string; n: number; pos: number; neg: number; quote: string }>;
}

/** Today's feedback notes as items, each tied to a dish where one fits. */
export function feedbackItems(notes: ResidentNote[], since: number, checks: Order[], nameOf: (rid: string) => string): FeedbackItem[] {
  return notes
    .filter((n) => n.kind === 'fb' && n.at >= since)
    .map((n) => ({
      id: n.id,
      who: nameOf(n.rid),
      by: n.by,
      where: n.table,
      text: n.text,
      at: n.at,
      source: n.src === 'tap' ? 'Quick feedback' : 'Voice note',
      dish: matchDish(n.text, n.rid, checks)?.name ?? null,
    }))
    .sort((a, b) => b.at - a.at);
}

const countBy = <T>(list: T[], key: (x: T) => string | null): Array<[string, number]> => {
  const m: Record<string, number> = {};
  for (const x of list) {
    const k = key(x);
    if (k) m[k] = (m[k] ?? 0) + 1;
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

/** One summary for everyone: the headline, what went well, what to look at, and what to do. */
export function summarizeFeedback(items: FeedbackItem[]): FeedbackSummary {
  const rows: FeedbackRow[] = items.map((x) => {
    const themes = THEMES.filter((t) => t.re.test(x.text)).map((t) => t.key);
    const s = sentimentOf(x.text);
    const neg = s === 'neg' || themes.length > 0;
    return { ...x, themes, neg, ask: ASK.test(x.text), pos: !neg && s === 'pos' };
  });
  const pos = rows.filter((r) => r.pos);
  const neg = rows.filter((r) => r.neg);
  const asks = rows.filter((r) => r.ask);
  const liked = countBy(pos, (r) => r.dish);
  const issues: FeedbackSummary['issues'] = [];
  for (const t of THEMES) {
    const rs = neg.filter((r) => r.themes.includes(t.key));
    if (rs.length) issues.push({ key: t.key, label: t.label, n: rs.length, dishes: countBy(rs, (r) => r.dish).map((a) => a[0]) });
  }
  const other = neg.filter((r) => !r.themes.length);
  if (other.length) issues.push({ key: 'other', label: 'not enjoyed', n: other.length, dishes: countBy(other, (r) => r.dish).map((a) => a[0]) });
  issues.sort((a, b) => b.n - a.n);

  const residents = new Set(rows.map((r) => r.who).filter(Boolean)).size;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const isAre = (d: string) => (d.endsWith('s') ? 'are' : 'is');
  let head =
    `${plural(rows.length, 'comment', 'comments')} from ${plural(residents, 'resident', 'residents')} today: ` +
    `${pos.length} positive, ${plural(neg.length, 'concern', 'concerns')}` +
    (asks.length ? `, ${plural(asks.length, 'request', 'requests')}` : '') +
    '.';
  if (liked[0]) head += ` The ${liked[0][0]} ${isAre(liked[0][0])} the standout, with ${liked[0][1]} positive ${liked[0][1] === 1 ? 'comment' : 'comments'}.`;
  if (issues[0])
    head +=
      ` The most common concern is ${issues[0].label} (${issues[0].n})` +
      (issues[0].dishes.length ? `, mostly the ${issues[0].dishes.slice(0, 2).join(' and the ')}` : '') +
      '.';

  const todo = issues.slice(0, 3).map((i) => {
    const t = THEMES.find((x) => x.key === i.key);
    const dish = i.dishes[0] ?? 'dish';
    return t ? t.tip(dish) : `Ask the servers what residents did not like about the ${dish}.`;
  });
  if (asks.length) todo.push('Look at what residents asked for when you plan the next specials.');

  const byDishMap: Record<string, FeedbackSummary['byDish'][number]> = {};
  for (const r of rows) {
    if (!r.dish) continue;
    const b = (byDishMap[r.dish] ??= { dish: r.dish, n: 0, pos: 0, neg: 0, quote: '' });
    b.n++;
    if (r.pos) b.pos++;
    if (r.neg) b.neg++;
    if (!b.quote) b.quote = r.text;
  }
  const byDish = Object.values(byDishMap).sort((a, b) => b.n - a.n || b.neg - a.neg);
  return { rows, head, liked, issues, asks, todo, byDish };
}
