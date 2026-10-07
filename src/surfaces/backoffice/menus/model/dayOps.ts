/**
 * Copying and swapping whole cycle days in the menu builder. Pure: each
 * function takes the grid (and side choices) and returns new ones. Any Day
 * (day 0) and other menus are never touched.
 */
import type { GridEntry, SideOverrides } from '../../../../store/menuEdits';

export interface CopyDayOptions {
  /** One meal, or every meal when left out. */
  meal?: string;
  /** replace: the target day's dishes (for those meals) go; add: they stay. */
  mode: 'replace' | 'add';
  /** Fresh placement ids (tests pass a counter). */
  newId: () => string;
}

const onDay = (g: GridEntry, menuId: string, day: number, meal?: string) => g.menuId === menuId && g.day === day && (!meal || g.meal === meal);

const validDay = (d: number) => Number.isInteger(d) && d >= 1;

/** Dishes on a cycle day (for one meal, or all). */
export function dayCount(grid: GridEntry[], menuId: string, day: number, meal?: string): number {
  return grid.filter((g) => onDay(g, menuId, day, meal)).length;
}

/**
 * Copy what is on one cycle day onto other days: fresh ids, sides still tied
 * to their copied entrée. With mode replace, what was on the target days for
 * those meals is taken off first.
 */
export function copyDay(grid: GridEntry[], menuId: string, from: number, to: number | number[], opts: CopyDayOptions): GridEntry[] {
  const targets = [...new Set(Array.isArray(to) ? to : [to])].filter((d) => validDay(d) && d !== from);
  if (!validDay(from) || !targets.length) return grid;
  const src = grid.filter((g) => onDay(g, menuId, from, opts.meal)).sort((a, b) => a.sort - b.sort);
  const kept = opts.mode === 'replace' ? grid.filter((g) => !targets.some((d) => onDay(g, menuId, d, opts.meal))) : grid;
  let sort = grid.reduce((a, g) => Math.max(a, g.sort), 0) + 1;
  const added = targets.flatMap((d) => {
    const ids = new Map<string, string>();
    const copies = src.map((g) => {
      const id = opts.newId();
      ids.set(g.id, id);
      return { ...g, id, day: d, sort: sort++ };
    });
    // A side tied to an entrée that was not copied (another meal) stays loose.
    return copies.map((g) => (g.with ? { ...g, with: ids.get(g.with) } : g));
  });
  return [...kept, ...added];
}

/** Trade everything on two cycle days, every meal. */
export function swapDays(grid: GridEntry[], menuId: string, a: number, b: number): GridEntry[] {
  if (!validDay(a) || !validDay(b) || a === b) return grid;
  return grid.map((g) => (g.menuId !== menuId ? g : g.day === a ? { ...g, day: b } : g.day === b ? { ...g, day: a } : g));
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

/** Trade the side choices of two days (each written out in full). */
export function swapDaySides(sides: SideOverrides, seed: SideOverrides, menuId: string, a: number, b: number): SideOverrides {
  if (!validDay(a) || !validDay(b) || a === b) return sides;
  const ea = effective(sides, seed, menuId, a);
  const eb = effective(sides, seed, menuId, b);
  if (!Object.keys(ea).length && !Object.keys(eb).length) return sides;
  // Recipes the seed sets on a day but the other day lacks still need an entry, or the seed shows through.
  const fill = (mine: DaySides, other: DaySides) => {
    const out = { ...mine };
    for (const r of Object.keys(other)) if (!(r in out)) out[r] = [];
    return out;
  };
  return withDay(withDay(sides, menuId, a, fill(eb, ea)), menuId, b, fill(ea, eb));
}
