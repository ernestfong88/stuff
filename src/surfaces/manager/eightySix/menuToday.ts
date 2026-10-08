/** Today's menu for the 86 list. */
import { DINING_ROOM, menuFor, rooms } from '../../../data';
import type { MealName, MenuItem } from '../../../domain/types';

/** __kMealNow: the meal the clock is in. */
export function mealByHour(hour: number): MealName {
  return hour >= 15 ? 'Dinner' : hour >= 10 ? 'Lunch' : 'Breakfast';
}

/**
 * Today's items of a meal by category, each item once, matching the search:
 * every room's menu (the dining room's first), each room on its own venue's
 * cycle day, so the kitchen can 86 anything any room serves today.
 */
export function menuForToday(meal: MealName, query: string): Array<[string, MenuItem[]]> {
  const seen = new Set<string>();
  const q = query.trim().toLowerCase();
  const byCat = new Map<string, MenuItem[]>();
  const order = [DINING_ROOM, ...Object.keys(rooms).filter((r) => r !== DINING_ROOM)];
  for (const room of order) {
    for (const [cat, items] of Object.entries(menuFor(room)[meal] ?? {})) {
      const list = byCat.get(cat) ?? [];
      for (const it of items) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        if (!q || it.name.toLowerCase().includes(q)) list.push(it);
      }
      byCat.set(cat, list);
    }
  }
  return [...byCat].filter(([, items]) => items.length > 0);
}

