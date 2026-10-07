/**
 * P-Mix sums: what sold over a date range, as specials and à la carte, with
 * the sides chosen. Pure functions over the sales history.
 */
import type { MealLetter, PmixDay, PmixRecipe } from '../../seed/pmix';

export type MealFilter = 'All' | 'Breakfast' | 'Lunch' | 'Dinner';

export interface MixItem {
  r: PmixRecipe;
  /** Sold in all. */
  n: number;
  /** As a special. */
  sp: number;
  /** From the à la carte menu. */
  al: number;
  meals: MealLetter[];
}

export interface MixSide {
  name: string;
  n: number;
  /** The entrée it went with most, or null when mostly ordered on its own. */
  top: string | null;
}

export interface Mix {
  items: MixItem[];
  tot: number;
  days: number;
  ent: number;
  sides: MixSide[];
}

const MEAL_ORDER: MealLetter[] = ['B', 'L', 'D'];
export const MEAL_NAMES: Record<MealLetter, string> = { B: 'Breakfast', L: 'Lunch', D: 'Dinner' };

/** Everything sold between `fromBack` and `toBack` days ago (inclusive; 1 = yesterday). */
export function mixFor(history: PmixDay[], recipes: PmixRecipe[], sideNames: string[], o: { fromBack: number; toBack: number; meal: MealFilter; venue: string }): Mix {
  const hi = Math.max(o.fromBack, o.toBack);
  const lo = Math.min(o.fromBack, o.toBack);
  const by = new Map<number, { sp: number; al: number; meals: Set<MealLetter> }>();
  const sides = new Map<number, { n: number; with: Map<number, number> }>();
  for (const d of history) {
    if (d.back < lo || d.back > hi) continue;
    if (o.venue !== 'All' && d.venue !== o.venue) continue;
    if (o.meal !== 'All' && d.meal !== o.meal[0]) continue;
    for (const [ri, sp, al] of d.items) {
      const x = by.get(ri) ?? { sp: 0, al: 0, meals: new Set<MealLetter>() };
      x.sp += sp;
      x.al += al;
      if (sp + al > 0) x.meals.add(d.meal);
      by.set(ri, x);
    }
    for (const [si, n, withs] of d.sides) {
      const x = sides.get(si) ?? { n: 0, with: new Map<number, number>() };
      x.n += n;
      for (const [ri, c] of withs) x.with.set(ri, (x.with.get(ri) ?? 0) + c);
      sides.set(si, x);
    }
  }
  const items = [...by.entries()]
    .map(([ri, x]) => ({ r: recipes[ri], n: x.sp + x.al, sp: x.sp, al: x.al, meals: MEAL_ORDER.filter((m) => x.meals.has(m)) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.r.name.localeCompare(b.r.name));
  const tot = items.reduce((s, x) => s + x.n, 0);
  return {
    items,
    tot,
    days: hi - lo + 1,
    ent: items.filter((x) => x.r.cat === 'Entrees').reduce((s, x) => s + x.n, 0),
    sides: [...sides.entries()]
      .map(([si, x]) => {
        const best = [...x.with.entries()].sort((a, b) => b[1] - a[1])[0];
        return { name: sideNames[si], n: x.n, top: best && best[0] >= 0 ? recipes[best[0]].name : null };
      })
      .sort((a, b) => b.n - a.n),
  };
}

/** Puréed and molded plates are texture versions of other dishes; they would double count. */
export const isTextureVersion = (name: string) => /pureed|molded/i.test(name);

export type ShowFilter = 'All' | 'Entrees' | 'SpEnt' | 'Starters' | 'Desserts';

export const SHOW_OPTIONS: Array<[ShowFilter, string]> = [
  ['All', 'Everything'],
  ['Entrees', 'Entrées'],
  ['SpEnt', 'Special entrées'],
  ['Starters', 'Soups and starters'],
  ['Desserts', 'Desserts'],
];

/** The items a Show + Protein choice keeps. */
export function visibleItems(items: MixItem[], show: ShowFilter, protein: string): MixItem[] {
  return items.filter(
    (x) =>
      !isTextureVersion(x.r.name) &&
      (show === 'All' || (show === 'SpEnt' ? x.r.cat === 'Entrees' : x.r.cat === show)) &&
      (!protein || (x.r.cat === 'Entrees' && x.r.protein === protein)),
  );
}

export const CATEGORY_NAMES: Record<string, string> = { Entrees: 'Entrées', Starters: 'Soups and starters', Desserts: 'Desserts' };
export const categoryName = (c: string) => CATEGORY_NAMES[c] ?? c;
/** Categories in menu order, then any others. */
export function orderedCategories(items: MixItem[]): string[] {
  const known = Object.keys(CATEGORY_NAMES);
  return [...known, ...[...new Set(items.map((x) => x.r.cat))].filter((c) => !known.includes(c))];
}

/** Percent of a whole, rounded. */
export const pct = (v: number, total: number) => (total ? Math.round((v / total) * 100) : 0);
