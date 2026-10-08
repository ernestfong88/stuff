/**
 * Today's P-Mix snapshot: every dish served so far today (dining room, pick
 * up and delivery, associate meals) and its share of the day's total.
 * Like P-Mix it counts plates (starters, entrées, desserts): drinks, sides
 * and add-ons are left out.
 */
import { mealAt, parseMeal } from '../../../../../domain/pickupService/meals';
import type { AssocMeal, CatalogItem, MealName, Order } from '../../../../../domain/types';

export interface MixDish {
  /** Item id (the first seen for the dish), or the associate meal's name when it is not on the menu. */
  id: string;
  name: string;
  /** Menu category: "Starters", "Entrées", "Desserts"... */
  category: string;
  n: number;
  special: boolean;
}

export interface MixRow extends MixDish {
  /** Share of the whole it was cut from, rounded to a whole percent. */
  pct: number;
}

export interface TodayMix {
  tot: number;
  /** Every dish served, most served first. */
  dishes: MixDish[];
  /** Plates served so far at each meal, whatever the filter. */
  byMeal: Record<MealName, number>;
}

export interface TodayMixOptions {
  todayStart: number;
  /** "YYYY-MM-DD" for associate meals. */
  todayIso: string;
  /** The menu, to name lines and match associate meals by name. */
  catalog: CatalogItem[];
  /** Served before the floor's live checks begin, by item id. */
  earlier?: Record<string, number>;
  /** Only count plates served at this meal; every meal when left out. */
  meal?: MealName;
}

/** Menu categories that are not plates of their own. */
const NOT_PLATES = new Set(['Drinks', 'Cocktails', 'Alcohol', 'Add-Ons', 'Sides']);
const isPlate = (it: CatalogItem | undefined): it is CatalogItem => !!it && !NOT_PLATES.has(it.category) && it.route !== 'bar';

const share = (v: number, tot: number) => (tot ? Math.round((v / tot) * 100) : 0);

/** Plate categories in course order; any other category comes after them. */
export const CATEGORY_ORDER = ['Starters', 'Entrées', 'Desserts'];
/** An associate meal that is not on the menu is a main plate. */
const ASSOC_CATEGORY = 'Entrées';

/**
 * An associate meal's meal. Bookings carry "Lunch" or "Dinner"; NOC (overnight,
 * 10 PM to 6 AM) has no meal of its own, so it counts with dinner, the day's
 * last service. Anything else falls back to the time it was made ready.
 */
function assocMeal(a: AssocMeal): MealName | null {
  if (/^noc$/i.test(a.meal ?? '')) return 'Dinner';
  return parseMeal(a.meal) ?? (a.readyAt ? mealAt(a.readyAt) : null);
}

export function todayMix(checks: Order[], assocMeals: AssocMeal[], o: TodayMixOptions): TodayMix {
  const byId = new Map(o.catalog.map((it) => [it.id, it]));
  const byName = new Map(o.catalog.map((it) => [it.name.toLowerCase(), it]));
  const by = new Map<string, { name: string; category: string; n: number; special: boolean }>();
  // Keyed by name: the same dish can be on the menu under a different id at each meal.
  const ids = new Map<string, string>();
  const byMeal: Record<MealName, number> = { Breakfast: 0, Lunch: 0, Dinner: 0 };
  const add = (meal: MealName | null, id: string, name: string, category: string, special: boolean, n = 1) => {
    if (n <= 0) return;
    if (meal) byMeal[meal] += n;
    if (o.meal && meal !== o.meal) return;
    const key = name.toLowerCase();
    if (!ids.has(key)) ids.set(key, id);
    const x = by.get(key) ?? { name, category, n: 0, special };
    x.n += n;
    x.special ||= special;
    by.set(key, x);
  };
  // Earlier specials are counted by menu item, so they take the meal the item is listed under.
  for (const [id, n] of Object.entries(o.earlier ?? {})) {
    const it = byId.get(id);
    if (isPlate(it)) add(it.meal, id, it.name, it.category, !!it.special, n);
  }
  for (const c of checks) {
    if (Math.max(c.closedAt ?? 0, c.openedAt ?? 0) < o.todayStart) continue;
    // Every check carries its meal; an old one without it goes by when it was opened.
    const meal = parseMeal(c.meal) ?? mealAt(c.openedAt);
    for (const d of c.diners)
      for (const l of d.items) {
        if (!l.sent || l.cancelled || l.drink || l.autoSide) continue;
        const it = byId.get(l.itemId);
        if (!isPlate(it)) continue;
        add(meal, it.id, it.name, it.category, !!it.special);
      }
  }
  for (const a of assocMeals) {
    if (a.date !== o.todayIso || /cancel/i.test(a.status ?? '') || !a.item) continue;
    const it = byName.get(a.item.toLowerCase());
    if (it && !isPlate(it)) continue;
    add(assocMeal(a), it?.id ?? a.item, it?.name ?? a.item, it?.category ?? ASSOC_CATEGORY, !!it?.special);
  }
  const dishes = [...by.entries()].map(([key, x]) => ({ id: ids.get(key)!, ...x })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  return { tot: dishes.reduce((q, x) => q + x.n, 0), dishes, byMeal };
}

export interface CategoryTotal {
  category: string;
  n: number;
  /** Share of all plates, rounded. */
  pct: number;
  /** How many different dishes. */
  dishes: number;
}

/** Plates per category, in course order (starters, entrées, desserts, then any other), empty ones left out. */
export function categoryTotals(dishes: MixDish[]): CategoryTotal[] {
  const tot = dishes.reduce((q, x) => q + x.n, 0);
  const by = new Map<string, { n: number; dishes: number }>();
  for (const d of dishes) {
    const x = by.get(d.category) ?? { n: 0, dishes: 0 };
    x.n += d.n;
    x.dishes += 1;
    by.set(d.category, x);
  }
  const rank = (c: string) => (CATEGORY_ORDER.includes(c) ? CATEGORY_ORDER.indexOf(c) : CATEGORY_ORDER.length);
  return [...by.entries()]
    .filter(([, x]) => x.n > 0)
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, x]) => ({ category, n: x.n, pct: share(x.n, tot), dishes: x.dishes }));
}

export interface CategoryMix {
  tot: number;
  /** Best sellers in the category, most served first, with their share of the category. */
  top: MixRow[];
  /** Everything after the top rows, summed; null when nothing is left over. */
  rest: { n: number; pct: number; dishes: number } | null;
}

/** One category's dishes (every category when left out): the best `limit` sellers, the rest rolled into one, but never a single dish. */
export function categoryDishes(dishes: MixDish[], category?: string, limit = 4): CategoryMix {
  const all = category ? dishes.filter((d) => d.category === category) : dishes;
  const tot = all.reduce((q, x) => q + x.n, 0);
  const cut = all.length === limit + 1 ? all.length : limit;
  const top = all.slice(0, cut).map((x) => ({ ...x, pct: share(x.n, tot) }));
  const left = all.slice(cut);
  const restN = left.reduce((q, x) => q + x.n, 0);
  return { tot, top, rest: left.length ? { n: restN, pct: share(restN, tot), dishes: left.length } : null };
}
