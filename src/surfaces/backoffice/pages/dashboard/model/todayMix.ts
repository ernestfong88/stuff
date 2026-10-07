/**
 * Today's P-Mix snapshot: every dish served so far today (dining room, pick
 * up and delivery, associate meals) and its share of the day's total.
 * Like P-Mix it counts plates (starters, entrées, desserts): drinks, sides
 * and add-ons are left out.
 */
import { mealAt, parseMeal } from '../../../../../domain/pickupService/meals';
import type { AssocMeal, CatalogItem, MealName, Order } from '../../../../../domain/types';

export interface MixRow {
  /** Item id (the first seen for the dish), or the associate meal's name when it is not on the menu. */
  id: string;
  name: string;
  n: number;
  /** Share of the day's total, rounded to a whole percent. */
  pct: number;
  special: boolean;
}

export interface TodayMix {
  tot: number;
  /** Best sellers, most served first. */
  top: MixRow[];
  /** Everything after the top rows, summed; null when nothing is left over. */
  rest: { n: number; pct: number; dishes: number } | null;
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
  /** How many rows to show before rolling the rest into one. */
  limit?: number;
  /** Only count plates served at this meal; every meal when left out. */
  meal?: MealName;
}

/** Menu categories that are not plates of their own. */
const NOT_PLATES = new Set(['Drinks', 'Cocktails', 'Alcohol', 'Add-Ons', 'Sides']);
const isPlate = (it: CatalogItem | undefined): it is CatalogItem => !!it && !NOT_PLATES.has(it.category) && it.route !== 'bar';

const share = (v: number, tot: number) => (tot ? Math.round((v / tot) * 100) : 0);

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
  const limit = o.limit ?? 7;
  const byId = new Map(o.catalog.map((it) => [it.id, it]));
  const byName = new Map(o.catalog.map((it) => [it.name.toLowerCase(), it]));
  const by = new Map<string, { name: string; n: number; special: boolean }>();
  // Keyed by name: the same dish can be on the menu under a different id at each meal.
  const ids = new Map<string, string>();
  const byMeal: Record<MealName, number> = { Breakfast: 0, Lunch: 0, Dinner: 0 };
  const add = (meal: MealName | null, id: string, name: string, special: boolean, n = 1) => {
    if (n <= 0) return;
    if (meal) byMeal[meal] += n;
    if (o.meal && meal !== o.meal) return;
    const key = name.toLowerCase();
    if (!ids.has(key)) ids.set(key, id);
    const x = by.get(key) ?? { name, n: 0, special };
    x.n += n;
    x.special ||= special;
    by.set(key, x);
  };
  // Earlier specials are counted by menu item, so they take the meal the item is listed under.
  for (const [id, n] of Object.entries(o.earlier ?? {})) {
    const it = byId.get(id);
    if (isPlate(it)) add(it.meal, id, it.name, !!it.special, n);
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
        add(meal, it.id, it.name, !!it.special);
      }
  }
  for (const a of assocMeals) {
    if (a.date !== o.todayIso || /cancel/i.test(a.status ?? '') || !a.item) continue;
    const it = byName.get(a.item.toLowerCase());
    if (it && !isPlate(it)) continue;
    add(assocMeal(a), it?.id ?? a.item, it?.name ?? a.item, !!it?.special);
  }
  const all = [...by.entries()].map(([key, x]) => ({ id: ids.get(key)!, ...x })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const tot = all.reduce((q, x) => q + x.n, 0);
  // Never roll a single dish into "Everything else": show it instead.
  const cut = all.length === limit + 1 ? all.length : limit;
  const top = all.slice(0, cut).map((x) => ({ ...x, pct: share(x.n, tot) }));
  const left = all.slice(cut);
  const restN = left.reduce((q, x) => q + x.n, 0);
  return { tot, top, rest: left.length ? { n: restN, pct: share(restN, tot), dishes: left.length } : null, byMeal };
}
