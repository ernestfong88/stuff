/** Today's menu for the 86 list. */
import { menu } from '../../../data';
import { TODAY_MENU_DAY } from '../../server/order/menu/menuCatalog';
import type { MealName, MenuItem } from '../../../domain/types';

/** Day of the menu cycle being served (the server tablet's); items with day 0 are on every day. */
export const MENU_CYCLE_DAY = TODAY_MENU_DAY;

/** __kMealNow: the meal the clock is in. */
export function mealByHour(hour: number): MealName {
  return hour >= 15 ? 'Dinner' : hour >= 10 ? 'Lunch' : 'Breakfast';
}

/** Today's items of a meal by category, each item once, matching the search. */
export function menuForToday(meal: MealName, query: string): Array<[string, MenuItem[]]> {
  const seen = new Set<string>();
  const q = query.trim().toLowerCase();
  return Object.entries(menu[meal] ?? {})
    .map(([cat, items]): [string, MenuItem[]] => [
      cat,
      items.filter((it) => {
        if (!(it.day == null || it.day === 0 || it.day === MENU_CYCLE_DAY) || seen.has(it.id)) return false;
        seen.add(it.id);
        return !q || it.name.toLowerCase().includes(q);
      }),
    ])
    .filter(([, items]) => items.length > 0);
}

