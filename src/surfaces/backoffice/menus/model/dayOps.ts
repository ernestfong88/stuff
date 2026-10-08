/**
 * Copying and swapping meals in the menu builder: one meal on one day onto
 * any other day and meal. Pure: each function takes the grid (and side
 * choices) and returns new ones. Any Day (day 0) and other menus are never
 * touched.
 */
import type { GridEntry, SideOverrides } from '../../../../store/menuEdits';

/** One meal on one cycle day: Monday lunch is { day: 1, meal: 'Lunch' }. */
export interface MealSlot {
  day: number;
  meal: string;
}

export interface CopyMealOptions {
  /** replace: what the target meal has goes; add: it stays. */
  mode: 'replace' | 'add';
  /** Fresh placement ids (tests pass a counter). */
  newId: () => string;
}

const inSlot = (g: GridEntry, menuId: string, x: MealSlot) => g.menuId === menuId && g.day === x.day && g.meal === x.meal;
const sameSlot = (a: MealSlot, b: MealSlot) => a.day === b.day && a.meal === b.meal;
const validDay = (d: number) => Number.isInteger(d) && d >= 1;

/** Dishes on one meal of a cycle day. */
export function mealCount(grid: GridEntry[], menuId: string, x: MealSlot): number {
  return grid.filter((g) => inSlot(g, menuId, x)).length;
}

/**
 * Copy one meal onto other meals, on any days: Monday lunch onto Wednesday
 * dinner. Fresh ids, sides still tied to their copied entrée. With replace,
 * what the target meals had is taken off first.
 */
export function copyMeal(grid: GridEntry[], menuId: string, from: MealSlot, to: MealSlot[], opts: CopyMealOptions): GridEntry[] {
  const targets = to.filter((x, i) => validDay(x.day) && !sameSlot(x, from) && to.findIndex((y) => sameSlot(x, y)) === i);
  if (!validDay(from.day) || !targets.length) return grid;
  const src = grid.filter((g) => inSlot(g, menuId, from)).sort((a, b) => a.sort - b.sort);
  const kept = opts.mode === 'replace' ? grid.filter((g) => !targets.some((x) => inSlot(g, menuId, x))) : grid;
  let sort = grid.reduce((a, g) => Math.max(a, g.sort), 0) + 1;
  const added = targets.flatMap((x) => {
    const ids = new Map<string, string>();
    const copies = src.map((g) => {
      const id = opts.newId();
      ids.set(g.id, id);
      return { ...g, id, day: x.day, meal: x.meal as GridEntry['meal'], sort: sort++ };
    });
    return copies.map((g) => (g.with ? { ...g, with: ids.get(g.with) } : g));
  });
  return [...kept, ...added];
}

/** Trade two meals, on the same day or different days: Monday lunch and Wednesday dinner change places. */
export function swapMeals(grid: GridEntry[], menuId: string, a: MealSlot, b: MealSlot): GridEntry[] {
  if (!validDay(a.day) || !validDay(b.day) || sameSlot(a, b)) return grid;
  const to = (x: MealSlot) => ({ day: x.day, meal: x.meal as GridEntry['meal'] });
  return grid.map((g) => (inSlot(g, menuId, a) ? { ...g, ...to(b) } : inSlot(g, menuId, b) ? { ...g, ...to(a) } : g));
}

type DaySides = Record<string, string[]>;

/** A day's side choices as the builder sees them: the chef's over the seed's. */
function effective(sides: SideOverrides, seed: SideOverrides, menuId: string, day: number): DaySides {
  return { ...seed[menuId]?.[day], ...sides[menuId]?.[day] };
}

function withDay(sides: SideOverrides, menuId: string, day: number, value: DaySides): SideOverrides {
  return { ...sides, [menuId]: { ...sides[menuId], [day]: value } };
}

/**
 * Carry the source day's side choices for the copied entrées onto the
 * target days, written out so the target's own seed sides do not show through.
 */
export function copyDaySides(
  sides: SideOverrides,
  seed: SideOverrides,
  menuId: string,
  from: number,
  to: number | number[],
  recipeIds: Iterable<string>,
): SideOverrides {
  const src = effective(sides, seed, menuId, from);
  let out = sides;
  for (const d of Array.isArray(to) ? to : [to]) {
    if (!validDay(d) || d === from) continue;
    const there = effective(out, seed, menuId, d);
    const own: DaySides = { ...out[menuId]?.[d] };
    let changed = false;
    for (const r of recipeIds) {
      if (!(r in src) && !(r in there)) continue;
      own[r] = src[r] ?? [];
      changed = true;
    }
    if (changed) out = withDay(out, menuId, d, own);
  }
  return out;
}
