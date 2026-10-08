/**
 * The Recipe Book as it ships, every field of every recipe, for the screens
 * that work on whole recipes (Back Office, Prep's recipe cards). What every
 * screen reads (name, category, subcategory, description, allergens) ships
 * once, in the summaries src/store/recipes keeps; the rest (ingredients,
 * method, cook notes, sales ...) is in recipeDetails.json and is put
 * together with them here, so no screen downloads those fields twice.
 */
import details from '../surfaces/backoffice/menus/seed/recipeDetails.json';
import type { Recipe } from './menuEdits';
import { SHIPPED_SUMMARIES } from './recipes';

export const SHIPPED_RECIPES: Recipe[] = (details as unknown as Array<Partial<Recipe> & { id: string }>).map(
  ({ id, ...rest }) => ({ id, ...SHIPPED_SUMMARIES[id], ...rest }) as Recipe,
);
