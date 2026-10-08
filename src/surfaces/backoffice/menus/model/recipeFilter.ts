/** Recipe Book filters and sorting. */
import type { Recipe } from '../../../../store/menuEdits';
import { CATEGORIES, dishLong, proteinOf, subcategoryGroups, subOf } from './categories';
import type { RecipeScore } from './score';

export type ScoreFilter = '' | 'love' | 'ok' | 'bad' | 'none';
export type StatusFilter = 'active' | 'retired' | 'all';
export type RecipeSort = 'name' | 'hi' | 'lo' | 'sold';

export interface RecipeFilters {
  q: string;
  /** '' = all categories. */
  cat: string;
  /** A named group of the category's subcategories, e.g. 'Alcoholic' or 'Non-Alcoholic' drinks; '' = any. */
  group: string;
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
  group: '',
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
  return [f.group, f.sub, f.protein, f.diet, f.score, f.onMenu, f.cat, f.q.trim()].filter(Boolean).length + (f.favorites ? 1 : 0) + (f.status !== 'active' ? 1 : 0);
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

interface SearchKeys {
  /** The long dish name, as the list sorts and shows it. */
  long: string;
  /** Name, long name and description, lower case. */
  text: string[];
}

/** Worked out once per recipe object (an edit replaces the recipe), not on every keystroke. */
const searchKeys = new WeakMap<Recipe, SearchKeys>();

function keysOf(r: Recipe): SearchKeys {
  let k = searchKeys.get(r);
  if (!k) {
    const long = dishLong(r.name);
    k = { long, text: [r.name.toLowerCase(), long.toLowerCase(), (r.desc || '').toLowerCase()] };
    searchKeys.set(r, k);
  }
  return k;
}

export function matchesText(r: Recipe, q: string, shortOf: (r: Recipe) => string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return keysOf(r).text.some((t) => t.includes(s)) || shortOf(r).toLowerCase().includes(s);
}

/** Whether a recipe's subcategory is in a named group of its category (Alcoholic / Non-Alcoholic drinks). */
export function inGroup(r: Recipe, group: string): boolean {
  return subcategoryGroups(r.cat).some(([name, subs]) => name === group && subs.includes(subOf(r)));
}

export function filterRecipes(recipes: Recipe[], f: RecipeFilters, c: FilterContext): Recipe[] {
  const list = recipes.filter(
    (r) =>
      (f.status === 'all' || (f.status === 'retired' ? !isActive(r) : isActive(r))) &&
      (!f.cat || r.cat === f.cat) &&
      matchesText(r, f.q, c.shortOf) &&
      (!f.group || inGroup(r, f.group)) &&
      (!f.sub || subOf(r) === f.sub) &&
      (!f.protein || proteinOf(r) === f.protein) &&
      (!f.diet || (r.dietFlags ?? []).includes(f.diet)) &&
      scoreOk(c.scoreOf(r), f.score) &&
      (!f.onMenu || (f.onMenu === 'on' ? c.onMenu.has(r.id) : !c.onMenu.has(r.id))) &&
      (!f.favorites || !!c.favorites[r.id]),
  );
  const sc = (r: Recipe) => c.scoreOf(r)?.score;
  const cmp: Record<RecipeSort, (a: Recipe, b: Recipe) => number> = {
    name: (a, b) => keysOf(a).long.localeCompare(keysOf(b).long),
    hi: (a, b) => (sc(b) ?? 0) - (sc(a) ?? 0),
    lo: (a, b) => (sc(a) ?? 9) - (sc(b) ?? 9),
    sold: (a, b) => (c.scoreOf(b)?.sales?.orders ?? 0) - (c.scoreOf(a)?.sales?.orders ?? 0),
  };
  return list.sort((a, b) => cmp[f.sort](a, b) || keysOf(a).long.localeCompare(keysOf(b).long));
}

/** Categories the master has recipes in, in menu order. */
export function presentCategories(recipes: Recipe[]): string[] {
  return CATEGORIES.filter((c) => recipes.some((r) => r.cat === c));
}
