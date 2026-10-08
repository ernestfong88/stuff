/**
 * Full Recipe Book recipes (ingredients, method, plating, cook notes) for the
 * kitchen tablets, looked up by dish name: the chef's Recipe Book edits when
 * there are any (src/store/menuEdits), else the shipped book. Only the prep
 * screen imports this, so the full book stays out of the other screens.
 */
import { useShared } from '../lib/sharedStore';
import { menuEditsStore, type MenuEditsState, type Recipe } from './menuEdits';
import { SHIPPED_RECIPES } from './shippedRecipes';

const shipped = SHIPPED_RECIPES;
const key = (name: string) => name.trim().toLowerCase();

/** The Recipe Book recipe for a dish name, or undefined when the book has no such dish. */
export function recipeCard(name: string, state: MenuEditsState = menuEditsStore.get()): Recipe | undefined {
  const k = key(name);
  return (state.recipes ?? shipped).find((r) => !r.placeholder && !r.retired && key(r.name) === k);
}

/** True when the recipe has something to cook from: ingredients or a method. */
export const isWritten = (r: Recipe | undefined): r is Recipe => !!r && (!!r.ingredients?.length || !!r.method?.length);

/** The recipe for a dish, re-rendering when the Recipe Book changes. */
export function useRecipeCard(name: string | null | undefined): Recipe | undefined {
  const recipes = useShared(menuEditsStore, (s) => s.recipes);
  return name ? recipeCard(name, { ...menuEditsStore.get(), recipes }) : undefined;
}
