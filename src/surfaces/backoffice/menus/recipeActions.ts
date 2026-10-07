/** Changes to recipes that touch more than the recipe itself. */
import { uid } from '../../../lib/id';
import { getConfig, updateConfig } from '../../../store/config';
import type { Recipe } from '../../../store/menuEdits';
import { getBo, updateBo } from './data';
import { categoryCourse, guessCategory } from './model/categories';
import { defaultShort } from './model/shortNames';

/** Add a new recipe to the master; returns its id. */
export function createRecipe(name: string, extra: Partial<Recipe> = {}): string {
  const id = uid('rc');
  const r: Recipe = { id, name: name.trim(), cat: guessCategory(name), desc: '', ...extra };
  updateBo((s) => ({ recipes: [r, ...s.recipes] }));
  return id;
}

/** Rename a recipe; a short name set for the old name moves with it. */
export function renameRecipe(id: string, name: string): void {
  const r = getBo().recipes.find((x) => x.id === id);
  if (!r || r.name === name) return;
  const shorts = getConfig().shortNames;
  if (shorts[r.name]) {
    const next = { ...shorts, [name]: shorts[r.name] };
    delete next[r.name];
    updateConfig({ shortNames: next });
  }
  updateBo((s) => ({ recipes: s.recipes.map((x) => (x.id === id ? { ...x, name } : x)) }));
}

/** Set the short name servers and the kitchen see; blank (or the built-in one) clears it. */
export function setRecipeShort(r: Pick<Recipe, 'name' | 'shortDefault'>, value: string): void {
  const v = value.trim();
  const next = { ...getConfig().shortNames };
  if (v && v !== defaultShort(r)) next[r.name] = v;
  else delete next[r.name];
  updateConfig({ shortNames: next });
}

/** The course a category rings in on, for a recipe. */
export function courseOf(r: Pick<Recipe, 'cat'>): number {
  return categoryCourse(r.cat);
}
