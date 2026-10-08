/**
 * The menu standard for an à la carte menu: at most 20 menu items in all,
 * and at most 8 of them sides.
 *
 * - Beverages (Drinks, including anything placed in a drinks row) are not
 *   menu items.
 * - Upcharges are not menu items and not sides. In this codebase an upcharge
 *   is an add-on sold on top of a dish: the tablet item is flagged `upcharge`
 *   and listed under Add-Ons (see isUpchargeRecipe in ./tablet). Fee and
 *   placeholder lines (Recipe.placeholder) are not dishes, so they do not
 *   count either.
 * - Sides count toward the 20.
 * - A dish counts once, however many meals it is offered at.
 */
import type { GridEntry, Recipe } from '../../../../store/menuEdits';
import { normCategory } from './categories';

/** Change these to change the standard everywhere. */
export const MENU_STANDARDS = { alcItems: 20, alcSides: 8 } as const;

export interface AlcCount {
  items: number;
  sides: number;
  limitItems: number;
  limitSides: number;
}

export type StandardLevel = 'under' | 'at' | 'over';

export function countAlc(
  placements: GridEntry[],
  recipeOf: (id: string) => Pick<Recipe, 'cat' | 'placeholder'> | undefined,
  isUpcharge: (recipeId: string) => boolean = () => false,
): AlcCount {
  const items = new Set<string>();
  const sides = new Set<string>();
  const drinks = new Set<string>();
  for (const g of placements) {
    const r = recipeOf(g.recipeId);
    const cat = normCategory(r?.cat ?? g.cat);
    if (cat === 'Drinks' || normCategory(g.cat) === 'Drinks') drinks.add(g.recipeId);
    if (r?.placeholder || isUpcharge(g.recipeId)) continue;
    items.add(g.recipeId);
    if (cat === 'Sides') sides.add(g.recipeId);
  }
  for (const id of drinks) {
    items.delete(id);
    sides.delete(id);
  }
  return { items: items.size, sides: sides.size, limitItems: MENU_STANDARDS.alcItems, limitSides: MENU_STANDARDS.alcSides };
}

/** Under, at or over a limit. */
export function standardLevel(n: number, limit: number): StandardLevel {
  return n > limit ? 'over' : n === limit ? 'at' : 'under';
}
