/**
 * Today's specials: how many were made and how many are ordered so far,
 * counting the dining room, pick up and delivery, and associate meals.
 */
import type { AssocMeal, CatalogItem, MealName, Order } from '../../../../../domain/types';

export interface SpecialToday {
  id: string;
  name: string;
  /** "Lunch & Dinner" */
  meals: string;
  category: string;
}

const MEAL_ORDER: MealName[] = ['Breakfast', 'Lunch', 'Dinner'];

/** Every special on today's menu, by meal and then menu order. */
export function specialsToday(catalog: CatalogItem[]): SpecialToday[] {
  const by = new Map<string, { it: CatalogItem; meals: MealName[] }>();
  for (const it of catalog) {
    if (!it.special) continue;
    const x = by.get(it.id) ?? { it, meals: [] };
    if (!x.meals.includes(it.meal)) x.meals.push(it.meal);
    by.set(it.id, x);
  }
  return [...by.values()]
    .map(({ it, meals }) => ({ it, meals: meals.sort((a, b) => MEAL_ORDER.indexOf(a) - MEAL_ORDER.indexOf(b)) }))
    .sort((a, b) => MEAL_ORDER.indexOf(a.meals[0]) - MEAL_ORDER.indexOf(b.meals[0]))
    .map(({ it, meals }) => ({ id: it.id, name: it.name, meals: meals.join(' & '), category: it.category }));
}

export interface SpecialCount {
  made: number;
  dine: number;
  pickupDelivery: number;
  associates: number;
  total: number;
  /** Negative when more were ordered than made. */
  left: number;
}

export function countSpecial(
  sp: SpecialToday,
  checks: Order[],
  assocMeals: AssocMeal[],
  o: { todayStart: number; todayIso: string; made: number; earlier: number },
): SpecialCount {
  let dine = o.earlier;
  let pud = 0;
  for (const c of checks) {
    if (Math.max(c.closedAt ?? 0, c.openedAt ?? 0) < o.todayStart) continue;
    for (const d of c.diners)
      for (const l of d.items)
        if (l.itemId === sp.id && l.sent && !l.cancelled) {
          if (c.queueType) pud++;
          else dine++;
        }
  }
  const name = sp.name.toLowerCase();
  const associates = assocMeals.filter((a) => a.date === o.todayIso && !/cancel/i.test(a.status ?? '') && String(a.item ?? '').toLowerCase() === name).length;
  const total = dine + pud + associates;
  return { made: o.made, dine, pickupDelivery: pud, associates, total, left: o.made - total };
}
