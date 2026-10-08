/** Today's menu for the 86 list. */
import { DINING_ROOM, menuFor, rooms } from '../../../data';
import type { MealName, MenuItem } from '../../../domain/types';

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

/** Today's specials of a meal (from menuForToday), pinned at the top because they run out first. */
export function specialsOf(cats: Array<[string, MenuItem[]]>): MenuItem[] {
  return cats.flatMap(([, items]) => items.filter((it) => it.special));
}

/** How many items in a category are marked (out or counted), for its collapsed header. */
export function markedIn(items: MenuItem[], marked: (id: string) => boolean): number {
  return items.reduce((n, it) => n + (marked(it.id) ? 1 : 0), 0);
}

/**
 * Type-ahead over a meal: every word typed must appear in the item's name or
 * the short name the tablets show; names starting with what was typed come first.
 */
export function searchToday(meal: MealName, query: string, label: (it: MenuItem) => string = (it) => it.name): MenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  const text = (it: MenuItem) => `${label(it)} ${it.name}`.toLowerCase();
  const hits = menuForToday(meal, '')
    .flatMap(([, items]) => items)
    .filter((it) => words.every((w) => text(it).includes(w)));
  const first = (it: MenuItem) => label(it).toLowerCase().startsWith(q) || it.name.toLowerCase().startsWith(q);
  return [...hits.filter(first), ...hits.filter((it) => !first(it))];
}
