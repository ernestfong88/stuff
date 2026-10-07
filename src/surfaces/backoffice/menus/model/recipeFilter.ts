/** Recipe Book filters and sorting. */
import type { Recipe } from '../../../../store/menuEdits';
import { CATEGORIES, dishLong, proteinOf, subOf } from './categories';
import type { RecipeScore } from './score';

export type ScoreFilter = '' | 'love' | 'ok' | 'bad' | 'none';
export type StatusFilter = 'active' | 'retired' | 'all';
export type RecipeSort = 'name' | 'hi' | 'lo' | 'sold';

export interface RecipeFilters {
  q: string;
  /** '' = all categories. */
  cat: string;
  sub: string;
  protein: string;
  diet: string;
  score: ScoreFilter;
  /** '' = either, 'on' = on a menu, 'off' = never scheduled. */
  onMenu: '' | 'on' | 'off';
  status: StatusFilter;
  favorites: boolean;
  sort: RecipeSort;
}

export const NO_FILTERS: RecipeFilters = {
  q: '',
  cat: '',
  sub: '',
  protein: '',
  diet: '',
  score: '',
  onMenu: '',
  status: 'active',
  favorites: false,
  sort: 'name',
};

/** How many filters narrow the list (sort does not count). */
export function filterCount(f: RecipeFilters): number {
  return [f.sub, f.protein, f.diet, f.score, f.onMenu, f.cat, f.q.trim()].filter(Boolean).length + (f.favorites ? 1 : 0) + (f.status !== 'active' ? 1 : 0);
}

export function isActive(r: Recipe): boolean {
  return !r.retired;
}

export interface FilterContext {
  scoreOf: (r: Recipe) => RecipeScore | null;
  onMenu: Set<string>;
  favorites: Record<string, true>;
  shortOf: (r: Recipe) => string;
}

function scoreOk(sc: RecipeScore | null, f: ScoreFilter): boolean {
  if (!f) return true;
  if (f === 'none') return !sc;
  if (!sc) return false;
  return f === 'love' ? sc.score >= 4 : f === 'ok' ? sc.score >= 3 && sc.score < 4 : sc.score < 3;
}

export function matchesText(r: Recipe, q: string, shortOf: (r: Recipe) => string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    r.name.toLowerCase().includes(s) ||
    dishLong(r.name).toLowerCase().includes(s) ||
    (r.desc || '').toLowerCase().includes(s) ||
    shortOf(r).toLowerCase().includes(s)
  );
}

export function filterRecipes(recipes: Recipe[], f: RecipeFilters, c: FilterContext): Recipe[] {
  const list = recipes.filter(
    (r) =>
      (f.status === 'all' || (f.status === 'retired' ? !isActive(r) : isActive(r))) &&
      (!f.cat || r.cat === f.cat) &&
      matchesText(r, f.q, c.shortOf) &&
      (!f.sub || subOf(r) === f.sub) &&
      (!f.protein || proteinOf(r) === f.protein) &&
      (!f.diet || (r.dietFlags ?? []).includes(f.diet)) &&
      scoreOk(c.scoreOf(r), f.score) &&
      (!f.onMenu || (f.onMenu === 'on' ? c.onMenu.has(r.id) : !c.onMenu.has(r.id))) &&
      (!f.favorites || !!c.favorites[r.id]),
  );
  const sc = (r: Recipe) => c.scoreOf(r)?.score;
  const cmp: Record<RecipeSort, (a: Recipe, b: Recipe) => number> = {
    name: (a, b) => dishLong(a.name).localeCompare(dishLong(b.name)),
    hi: (a, b) => (sc(b) ?? 0) - (sc(a) ?? 0),
    lo: (a, b) => (sc(a) ?? 9) - (sc(b) ?? 9),
    sold: (a, b) => (c.scoreOf(b)?.sales?.orders ?? 0) - (c.scoreOf(a)?.sales?.orders ?? 0),
  };
  return list.sort((a, b) => cmp[f.sort](a, b) || dishLong(a.name).localeCompare(dishLong(b.name)));
}

/** Categories the master has recipes in, in menu order. */
export function presentCategories(recipes: Recipe[]): string[] {
  return CATEGORIES.filter((c) => recipes.some((r) => r.cat === c));
}
