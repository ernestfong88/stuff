/**
 * The associate menu on the tablet: when a server orders an associate's
 * meal, the menu is only the day's chef special and the standing choices,
 * each shown as the tablet items its recipes are.
 */
import { catalog } from '../../../../data';
import type { AssocMealKind, AssocMenuItem } from '../../../../domain/assocMeals/menu';
import type { CatalogItem, MealName, MenuItem } from '../../../../domain/types';
import { assocMenuFor } from '../../../../store/assocMenu';
import { recipeInfo } from '../../../../store/recipes';

export interface AssocSection {
  key: string;
  label: string;
  sub: string;
  items: MenuItem[];
}

/** The meal an associate order counts as: breakfast and lunch get the lunch special, dinner the dinner one. */
export const assocMealOf = (meal: MealName): AssocMealKind => (meal === 'Dinner' ? 'Dinner' : 'Lunch');

/** The tablet item for a recipe at this meal: same name on this meal's menu first, then the recipe's own item. */
export function tabletItemFor(recipeId: string, meal: MealName, items: CatalogItem[] = catalog): MenuItem | undefined {
  const name = (recipeInfo(recipeId)?.name ?? items.find((i) => i.id === recipeId)?.name ?? '').toLowerCase();
  return (
    items.find((i) => i.meal === meal && i.name.toLowerCase() === name) ??
    items.find((i) => i.id === recipeId) ??
    items.find((i) => i.name.toLowerCase() === name)
  );
}

/** One section per associate menu choice, holding the tablet items it is made of. */
export function assocSections(menu: AssocMenuItem[], meal: MealName, items: CatalogItem[] = catalog): AssocSection[] {
  return menu.map((m) => ({
    key: m.id,
    label: m.special ? `Chef's special · ${m.name}` : m.name,
    sub: m.sub,
    items: m.recipeIds.map((id) => tabletItemFor(id, meal, items)).filter((x): x is MenuItem => !!x),
  }));
}

/** Today's associate menu for this meal (any day, so a server can always ring one in). */
export function todaysAssocMenu(meal: MealName, todayIso: string): AssocMenuItem[] {
  return assocMenuFor(todayIso, assocMealOf(meal), todayIso, undefined, true) ?? [];
}
