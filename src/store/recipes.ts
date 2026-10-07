/**
 * Recipe Book entries for everyone outside the back office: name, category,
 * description and allergens. Reads the chef's Recipe Book edits when there
 * are any (src/store/menuEdits), else the shipped book. The back office
 * itself works on the full recipes in surfaces/backoffice/menus.
 */
import summaries from '../data/seed/recipeSummaries.json';
import { useShared } from '../lib/sharedStore';
import { menuEditsStore, type MenuEditsState } from './menuEdits';

export interface RecipeInfo {
  id: string;
  name: string;
  /** Menu category: Entrees, Starters, Sides, Desserts, Drinks. */
  cat: string;
  /** Subcategory: "Entrée Salad", "Sandwiches", "Soup" ... */
  sub?: string;
  desc?: string;
  allergens?: string[];
}

const shipped = summaries as Record<string, Omit<RecipeInfo, 'id'>>;

function fromEdits(state: MenuEditsState, id: string): RecipeInfo | undefined {
  const r = state.recipes?.find((x) => x.id === id);
  if (!r || r.placeholder) return undefined;
  return { id: r.id, name: r.name, cat: r.cat, sub: r.sub, desc: r.desc, allergens: r.allergens };
}

/** A recipe by id, or undefined when it doesn't exist (or is a placeholder line). */
export function recipeInfo(id: string | null | undefined, state: MenuEditsState = menuEditsStore.get()): RecipeInfo | undefined {
  if (!id) return undefined;
  if (state.recipes) return fromEdits(state, id);
  const r = shipped[id];
  return r ? { id, ...r } : undefined;
}

/** Every recipe in a category (and optionally a subcategory), A to Z. */
export function recipesIn(cat: string, sub?: string, state: MenuEditsState = menuEditsStore.get()): RecipeInfo[] {
  const ids = state.recipes ? state.recipes.map((r) => r.id) : Object.keys(shipped);
  return ids
    .map((id) => recipeInfo(id, state))
    .filter((r): r is RecipeInfo => !!r && r.cat === cat && (!sub || r.sub === sub))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Re-render when the Recipe Book changes. */
export function useRecipeBookVersion(): MenuEditsState['recipes'] {
  return useShared(menuEditsStore, (s) => s.recipes);
}
