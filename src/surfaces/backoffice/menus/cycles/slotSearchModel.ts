/** Matching recipes for a menu slot as the chef types. */
import type { Recipe } from '../../../../store/menuEdits';
import { dishLong, normCategory } from '../model/categories';

const LIMIT = 8;

/**
 * Recipes in a category (or any, when null) whose name has every typed word,
 * names that start with the text first. Retired recipes are left out.
 * `exact` says whether the typed text is already a recipe's name.
 */
export function searchRecipes(recipes: Recipe[], text: string, cat: string | null): { list: Recipe[]; exact: boolean } {
  const q = text.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const pool = recipes.filter((r) => !r.retired && (!cat || normCategory(r.cat) === cat));
  const hay = (r: Recipe) => `${r.name} ${dishLong(r.name)}`.toLowerCase();
  const list = pool
    .filter((r) => words.every((w) => hay(r).includes(w)))
    .map((r) => ({ r, rank: dishLong(r.name).toLowerCase().startsWith(q) || r.name.toLowerCase().startsWith(q) ? 0 : 1 }))
    .sort((a, b) => a.rank - b.rank || dishLong(a.r.name).localeCompare(dishLong(b.r.name)))
    .slice(0, LIMIT)
    .map((x) => x.r);
  const exact = !!q && recipes.some((r) => r.name.toLowerCase() === q || dishLong(r.name).toLowerCase() === q);
  return { list, exact };
}
