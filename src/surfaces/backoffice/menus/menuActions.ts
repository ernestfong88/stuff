/** Changes to menus and what is placed on them. */
import { now } from '../../../lib/clock';
import { uid } from '../../../lib/id';
import type { BoMenu, GridEntry, MenuKind, SideOverrides } from '../../../store/menuEdits';
import { BACK_OFFICE_AUTHOR, SEED_SIDES, getBo, updateBo } from './data';
import { copyDaySides, copyMeal as copyMealGrid, swapMeals as swapMealGrid, type MealSlot } from './model/dayOps';
import { addDays, dayStart, quarterMenuName, uniqueMenuName, weekStart } from '../../../domain/menuCycle';
import type { BoState, BuilderMeal } from './model/types';

/** Change a menu, recording who edited it and when. */
export function updateMenu(id: string, patch: Partial<BoMenu>): void {
  updateBo((s) => ({ menus: s.menus.map((m) => (m.id === id ? { ...m, ...patch, editedBy: BACK_OFFICE_AUTHOR, editedAt: now() } : m)) }));
}

function nextSort(grid: GridEntry[]): number {
  return grid.reduce((a, g) => Math.max(a, g.sort), 0) + 1;
}

/** Place recipes on a menu. */
export function addPlacements(list: Array<Omit<GridEntry, 'id' | 'sort' | 'cat'> & { cat?: GridEntry['cat'] }>): void {
  updateBo((s) => {
    let sort = nextSort(s.grid);
    const added = list.map((p) => ({
      ...p,
      id: uid('g'),
      sort: sort++,
      cat: p.cat ?? s.recipes.find((r) => r.id === p.recipeId)?.cat ?? 'Entrees',
    }));
    return { grid: [...s.grid, ...added] };
  });
}

export function removePlacements(pred: (g: GridEntry) => boolean): void {
  updateBo((s) => ({ grid: s.grid.filter((g) => !pred(g)) }));
}

/**
 * Set a cycle's length. Days past the new length leave the cycle, with what
 * was placed on them (a shorter cycle never keeps a week it no longer has).
 * Returns a function that puts the length and those dishes back (Undo).
 */
export function setCycleLength(menuId: string, len: number): () => void {
  const before = getBo();
  const was = before.menus.find((m) => m.id === menuId)?.cycleLen ?? 0;
  const dropped = before.grid.filter((g) => g.menuId === menuId && g.day > len);
  updateBo((s) => ({
    menus: s.menus.map((m) => (m.id === menuId ? { ...m, cycleLen: len, editedBy: BACK_OFFICE_AUTHOR, editedAt: now() } : m)),
    grid: dropped.length ? s.grid.filter((g) => !(g.menuId === menuId && g.day > len)) : s.grid,
  }));
  return () =>
    updateBo((s) => ({
      menus: s.menus.map((m) => (m.id === menuId ? { ...m, cycleLen: was } : m)),
      grid: [...s.grid, ...dropped.filter((g) => !s.grid.some((x) => x.id === g.id))],
    }));
}

/** Put back placements that were removed (undo). */
export function restorePlacements(list: GridEntry[]): void {
  updateBo((s) => ({ grid: [...s.grid, ...list.filter((g) => !s.grid.some((x) => x.id === g.id))] }));
}

/** What a set of days held before a meal copy or swap, to put back with Undo. */
export interface DaySnapshot {
  menuId: string;
  days: number[];
  grid: GridEntry[];
  sides: SideOverrides[string];
}

function snapshot(s: BoState, menuId: string, days: number[]): DaySnapshot {
  const own = s.sides[menuId] ?? {};
  return {
    menuId,
    days,
    grid: s.grid.filter((g) => g.menuId === menuId && days.includes(g.day)),
    sides: Object.fromEntries(days.filter((d) => own[d]).map((d) => [d, own[d]])),
  };
}

const isLocked = (s: BoState, menuId: string) => !!s.menus.find((m) => m.id === menuId)?.locked;

const recipesIn = (s: BoState, menuId: string, x: MealSlot) =>
  new Set(s.grid.filter((g) => g.menuId === menuId && g.day === x.day && g.meal === x.meal).map((g) => g.recipeId));

/**
 * Copy one meal onto other meals, on any days (Monday lunch onto Wednesday
 * dinner). With replace, what the target meals had is taken off. The copied
 * entrées keep their side choices. Returns what to restore for Undo, or null
 * when the menu is locked.
 */
export function copyMeal(menuId: string, from: MealSlot, to: MealSlot[], mode: 'replace' | 'add'): DaySnapshot | null {
  let snap: DaySnapshot | null = null;
  updateBo((s) => {
    if (isLocked(s, menuId)) return {};
    const days = [...new Set(to.map((x) => x.day))];
    snap = snapshot(s, menuId, days);
    const grid = copyMealGrid(s.grid, menuId, from, to, { mode, newId: () => uid('g') });
    return { grid, sides: copyDaySides(s.sides, SEED_SIDES, menuId, from.day, days, recipesIn(s, menuId, from)) };
  });
  return snap;
}

/** Trade two meals, on the same day or different days, side choices included. Returns what to restore for Undo, or null when the menu is locked. */
export function swapMeals(menuId: string, a: MealSlot, b: MealSlot): DaySnapshot | null {
  let snap: DaySnapshot | null = null;
  updateBo((s) => {
    if (isLocked(s, menuId)) return {};
    snap = snapshot(s, menuId, [...new Set([a.day, b.day])]);
    let sides = copyDaySides(s.sides, SEED_SIDES, menuId, a.day, [b.day], recipesIn(s, menuId, a));
    sides = copyDaySides(sides, SEED_SIDES, menuId, b.day, [a.day], recipesIn(s, menuId, b));
    return { grid: swapMealGrid(s.grid, menuId, a, b), sides };
  });
  return snap;
}

/** Put days back the way a snapshot saw them (Undo for a copy or swap). */
export function restoreDays(snap: DaySnapshot): void {
  updateBo((s) => {
    const own = { ...s.sides[snap.menuId] };
    for (const d of snap.days) {
      if (snap.sides[d]) own[d] = snap.sides[d];
      else delete own[d];
    }
    return {
      grid: [...s.grid.filter((g) => !(g.menuId === snap.menuId && snap.days.includes(g.day))), ...snap.grid],
      sides: { ...s.sides, [snap.menuId]: own },
    };
  });
}

/** Move the builder's dates so that cycle day `day` falls on `date`; the other days move with it. */
export function setDayDate(menuId: string, day: number, date: Date): void {
  // Weeks run Sunday to Saturday, so day 1 lands on the Sunday of that week.
  updateMenu(menuId, { startDt: weekStart(addDays(dayStart(date), -(day - 1))).getTime() });
}

/** A copy of a menu (and everything on it) as a draft in a quarter; returns its id. */
export function cloneMenu(srcId: string, quarter: string, kind: MenuKind): string {
  const id = uid('m');
  updateBo((s) => {
    const src = s.menus.find((m) => m.id === srcId)!;
    const copy: BoMenu = {
      ...src,
      id,
      kind,
      quarter,
      // Never the live menu's name: a copy into the same quarter reads "VT Fall 2026 (draft)".
      name: uniqueMenuName(quarterMenuName(quarter, kind), s.menus),
      status: 'draft',
      locked: false,
      signedBy: null,
      signedAt: null,
      approveReq: false,
      approval: '',
      fav: false,
      startDt: undefined,
      editedBy: BACK_OFFICE_AUTHOR,
      editedAt: now(),
    };
    const ids = new Map<string, string>();
    const placed = s.grid
      .filter((g) => g.menuId === srcId)
      .map((g) => {
        const nid = uid('g');
        ids.set(g.id, nid);
        return { ...g, id: nid, menuId: id };
      });
    const sides = s.sides[srcId] ? { ...s.sides, [id]: s.sides[srcId] } : s.sides;
    return { menus: [copy, ...s.menus], grid: [...s.grid, ...placed.map((g) => (g.with ? { ...g, with: ids.get(g.with) } : g))], sides };
  });
  return id;
}

/** A new, empty menu in a quarter; returns its id. */
export function blankMenu(quarter: string, kind: MenuKind): string {
  const id = uid('m');
  updateBo((s) => {
    const m: BoMenu = {
      id,
      // Never the name of a menu that exists (the live one, most likely): "VT Fall 2026 (draft)".
      name: uniqueMenuName(quarterMenuName(quarter, kind), s.menus),
      kind,
      quarter,
      status: 'draft',
      cycleLen: kind === 'alc' ? 0 : 28,
      editedBy: BACK_OFFICE_AUTHOR,
      editedAt: now(),
    };
    return { menus: [m, ...s.menus] };
  });
  return id;
}

/** Recipe ids on a menu's Any Day list, with the meals each is served at. */
export function anyDayMeals(menuId: string): Map<string, Set<BuilderMeal>> {
  const out = new Map<string, Set<BuilderMeal>>();
  for (const g of getBo().grid) {
    if (g.menuId !== menuId || g.day !== 0) continue;
    const set = out.get(g.recipeId) ?? new Set<BuilderMeal>();
    set.add(g.meal);
    out.set(g.recipeId, set);
  }
  return out;
}

/** Serve an Any Day recipe at exactly these meals (none takes it off). */
export function setAnyDayMeals(menuId: string, recipeId: string, meals: BuilderMeal[]): void {
  updateBo((s) => {
    const have = new Set(s.grid.filter((g) => g.menuId === menuId && g.day === 0 && g.recipeId === recipeId).map((g) => g.meal));
    const kept = s.grid.filter((g) => !(g.menuId === menuId && g.day === 0 && g.recipeId === recipeId && !meals.includes(g.meal)));
    const cat = s.recipes.find((r) => r.id === recipeId)?.cat ?? 'Entrees';
    let sort = nextSort(s.grid);
    const added = meals.filter((m) => !have.has(m)).map((meal) => ({ id: uid('g'), menuId, recipeId, day: 0, meal, cat, sort: sort++ }));
    return { grid: [...kept, ...added] };
  });
}
