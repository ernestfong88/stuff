import { menu } from '../../../../data';
import { isDrink } from '../../../../domain/menu';
import { mealAtHour } from '../../../../domain/mealPeriods';
import type { MealName, MenuItem } from '../../../../domain/types';

export const MEALS: MealName[] = ['Breakfast', 'Lunch', 'Dinner'];

/** The meal being served at an hour of the day (see domain/mealPeriods: breakfast until 10:30, lunch until 3, then dinner). */
export const mealAt = (hour: number): MealName => mealAtHour(hour);

export interface MenuSections {
  /** Today's specials, entrées first, then starters, sides, desserts. */
  specials: MenuItem[];
  /** Everything else by category, in menu order. */
  categories: Array<{ name: string; items: MenuItem[] }>;
  /** Every dish once (specials first), for the photo gallery. */
  all: MenuItem[];
}

const specialOrder = (it: MenuItem) => (it.entree ? 0 : it.course === 1 ? 1 : it.course === 3 ? 3 : 2);

/**
 * A meal's menu for the reference: dishes only (no drinks, add-ons or
 * fees), each listed once, specials pulled to the top.
 */
export function menuSections(meal: MealName): MenuSections {
  const seen = new Set<string>();
  const dishes: Array<[string, MenuItem]> = [];
  for (const [category, items] of Object.entries(menu[meal] ?? {})) {
    if (/add-?ons?|fees?/i.test(category)) continue;
    for (const it of items) {
      if (isDrink(it.id) || seen.has(it.id)) continue;
      seen.add(it.id);
      dishes.push([category, it]);
    }
  }
  const specials = dishes
    .filter(([, it]) => it.special)
    .map(([, it]) => it)
    .sort((a, b) => specialOrder(a) - specialOrder(b));
  const categories: MenuSections['categories'] = [];
  for (const [category, it] of dishes) {
    if (it.special) continue;
    let group = categories.find((c) => c.name === category);
    if (!group) categories.push((group = { name: category, items: [] }));
    group.items.push(it);
  }
  return { specials, categories, all: [...specials, ...categories.flatMap((c) => c.items)] };
}
