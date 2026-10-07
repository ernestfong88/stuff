/**
 * Kitchen Routing's list. Routing follows the recipe, so the list spans
 * every meal rather than whichever one the clock is in, with each recipe
 * once.
 */
import { menu } from '../../../data';
import type { DiningConfig } from '../../../domain/config';
import { isDrink } from '../../../domain/menu';
import { defaultDrinkRoute, defaultFoodRoute, drinkRoute, foodRoute } from '../../../domain/routing';
import type { MenuItem } from '../../../domain/types';
import { canonicalItemId, groupLabel, isMainCategory, menuGroupOf, type MenuGroup } from '../../../domain/subcategories';

/** Where a dish goes: the cook line, the server, or the bar (drinks). */
export type RouteChoice = 'kds' | 'expo' | 'server' | 'bar';

export interface RoutedItem {
  item: MenuItem;
  /** Tablet menu category it was listed under. */
  category: string;
  drink: boolean;
  /** An entree: it has an entree type. */
  main: boolean;
}

const CATEGORY_ORDER = ['Entrées', 'Specials', 'Starters', 'Sides', 'Desserts', 'Drinks', 'Beverages', 'Alcohol', 'Cocktails'];
const GROUP_ORDER: MenuGroup[] = ['Drinks', 'Starters', 'Entrees', 'Sides', 'Desserts', 'Snacks'];

/** Every recipe on any meal's menu, once. */
export function routableItems(): RoutedItem[] {
  const seenIds = new Set<string>();
  const byCategory = new Map<string, MenuItem[]>();
  for (const meal of Object.values(menu))
    for (const category of CATEGORY_ORDER)
      for (const item of meal[category] ?? []) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        byCategory.set(category, [...(byCategory.get(category) ?? []), item]);
      }
  const seenRecipes = new Set<string>();
  return CATEGORY_ORDER.flatMap((category) =>
    (byCategory.get(category) ?? []).flatMap((item) => {
      const canon = canonicalItemId(item.id);
      if (seenRecipes.has(canon)) return [];
      seenRecipes.add(canon);
      return [{ item, category, drink: isDrink(item.id), main: isMainCategory(category) }];
    }),
  );
}

export function currentRoute(it: RoutedItem, room: string, cfg: DiningConfig): RouteChoice {
  return it.drink ? drinkRoute(it.item.id, room, cfg) : (foodRoute(it.item.id, room, cfg) as RouteChoice);
}

export function defaultRoute(it: RoutedItem, room: string): RouteChoice {
  return it.drink ? defaultDrinkRoute(it.item.id, room) : (defaultFoodRoute(it.item.id) as RouteChoice);
}

/**
 * The groups to show. Without a search, only the exceptions: what the
 * server makes and the drinks made at the bar. With one, or when asked for
 * the whole menu, every match, by menu group.
 */
export function routingView(items: readonly RoutedItem[], room: string, cfg: DiningConfig, query: string, wholeMenu = false): Array<{ title: string; items: RoutedItem[] }> {
  const q = query.trim().toLowerCase();
  if (q || wholeMenu)
    return GROUP_ORDER.map((g) => ({
      title: groupLabel(g),
      items: items.filter((it) => menuGroupOf(it.category) === g && it.item.name.toLowerCase().includes(q)),
    })).filter((x) => x.items.length);
  return [
    { title: 'Server makes it', items: items.filter((it) => !it.drink && currentRoute(it, room, cfg) === 'expo') },
    { title: 'Made at the bar', items: items.filter((it) => it.drink && currentRoute(it, room, cfg) === 'bar') },
  ].filter((x) => x.items.length);
}
