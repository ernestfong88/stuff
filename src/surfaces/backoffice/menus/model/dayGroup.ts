/**
 * How one meal on one cycle day lays out in the menu builder. Sides belong
 * to the entrée they sit with: a side added under an entrée is tied to it;
 * otherwise it goes with the entrée whose default sides it matches; anything
 * still loose fills an entrée that has no side yet, in order; the rest show
 * as Other sides.
 */
import type { GridEntry } from '../../../../store/menuEdits';
import { normCategory } from './categories';

export interface DayGroup {
  starters: GridEntry[];
  entrees: Array<{ entree: GridEntry; sides: GridEntry[] }>;
  looseSides: GridEntry[];
  desserts: GridEntry[];
  drinks: GridEntry[];
  other: GridEntry[];
}

const IGNORE = ['with', 'and', 'the', 'side', 'fresh', 'baked', 'house', 'warm', 'creamy', 'seasoned'];
const words = (t: string) =>
  t
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((x) => x.length > 2 && !IGNORE.includes(x));

/** A side named like an entrée's default side ("Mashed Potatoes" for "Garlic Mashed Potatoes"). */
export function sideMatches(sideName: string, defaultName: string): boolean {
  const a = words(sideName);
  const b = words(defaultName);
  return b.length > 0 && b.every((x) => a.some((y) => y === x || y.startsWith(x) || x.startsWith(y)));
}

export function groupDay(entries: GridEntry[], defaultSides: (recipeId: string) => string[], nameOf: (recipeId: string) => string): DayGroup {
  const g: DayGroup = { starters: [], entrees: [], looseSides: [], desserts: [], drinks: [], other: [] };
  const sides: GridEntry[] = [];
  for (const q of entries) {
    const c = normCategory(q.cat);
    if (c === 'Starters') g.starters.push(q);
    else if (c === 'Entrees') g.entrees.push({ entree: q, sides: [] });
    else if (c === 'Sides') sides.push(q);
    else if (c === 'Desserts') g.desserts.push(q);
    else if (c === 'Drinks') g.drinks.push(q);
    else g.other.push(q);
  }
  let left = sides.filter((q) => {
    const t = q.with ? g.entrees.find((e) => e.entree.id === q.with) : undefined;
    if (t) t.sides.push(q);
    return !t;
  });
  for (const e of g.entrees) {
    for (const id of defaultSides(e.entree.recipeId)) {
      const dn = nameOf(id);
      const k = left.findIndex((q) => q.recipeId === id || (!!dn && sideMatches(nameOf(q.recipeId), dn)));
      if (k >= 0) e.sides.push(left.splice(k, 1)[0]);
    }
  }
  for (const e of g.entrees) if (!e.sides.length && left.length) e.sides.push(left.shift()!);
  g.looseSides = left;
  return g;
}

/** Placements on a menu day and meal, soups first, then in the order they were added. */
export function placementsAt(grid: GridEntry[], menuId: string, day: number, meal: string): GridEntry[] {
  return grid
    .filter((g) => g.menuId === menuId && g.day === day && g.meal === meal)
    .sort((a, b) => (normCategory(a.cat) === 'Starters' ? 0 : 1) - (normCategory(b.cat) === 'Starters' ? 0 : 1) || a.sort - b.sort);
}

/** Cycle days with nothing placed on them. */
export function emptyDays(grid: GridEntry[], menuId: string, len: number): number[] {
  const used = new Set(grid.filter((g) => g.menuId === menuId).map((g) => g.day));
  const out: number[] = [];
  for (let d = 1; d <= len; d++) if (!used.has(d)) out.push(d);
  return out;
}

/** Parse "7, 8 9" into valid target days (1 to len, not the source day). */
export function parseDays(text: string, len: number, from: number): number[] {
  return [
    ...new Set(
      text
        .split(/[ ,]+/)
        .map((x) => parseInt(x, 10))
        .filter((d) => d >= 1 && d <= len && d !== from),
    ),
  ];
}
