/** Changes to menus and what is placed on them. */
import { now } from '../../../lib/clock';
import { uid } from '../../../lib/id';
import type { BoMenu, GridEntry, MenuKind } from '../../../store/menuEdits';
import { BACK_OFFICE_AUTHOR, getBo, updateBo } from './data';
import { addDays, dayStart, quarterMenuName } from '../../../domain/menuCycle';
import type { BuilderMeal } from './model/types';

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

/** Put back placements that were removed (undo). */
export function restorePlacements(list: GridEntry[]): void {
  updateBo((s) => ({ grid: [...s.grid, ...list.filter((g) => !s.grid.some((x) => x.id === g.id))] }));
}

/** Copy everything on one cycle day onto other days (what is there already stays). */
export function copyDay(menuId: string, from: number, to: number[]): void {
  updateBo((s) => {
    const src = s.grid.filter((g) => g.menuId === menuId && g.day === from);
    let sort = nextSort(s.grid);
    return { grid: [...s.grid, ...to.flatMap((d) => src.map((g) => ({ ...g, id: uid('g'), day: d, sort: sort++, with: undefined })))] };
  });
}

/** Move the builder's dates so that cycle day `day` falls on `date`; the other days move with it. */
export function setDayDate(menuId: string, day: number, date: Date): void {
  updateMenu(menuId, { startDt: addDays(dayStart(date), -(day - 1)).getTime() });
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
      name: quarterMenuName(quarter, kind),
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
  const m: BoMenu = {
    id,
    name: quarterMenuName(quarter, kind),
    kind,
    quarter,
    status: 'draft',
    cycleLen: kind === 'alc' ? 0 : 28,
    editedBy: BACK_OFFICE_AUTHOR,
    editedAt: now(),
  };
  updateBo((s) => ({ menus: [m, ...s.menus] }));
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
