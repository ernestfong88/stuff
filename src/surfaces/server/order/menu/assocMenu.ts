/**
 * The associate menu on the tablet: when a server orders an associate's
 * meal, the menu is only the day's chef special, the special of the week
 * and the standing choices (the soup is the soup of the day), each shown as
 * the tablet items its recipes are.
 */
import { catalog } from '../../../../data';
import { itemsLeft, type AssocMealKind, type AssocMenuItem } from '../../../../domain/assocMeals/menu';
import { serverRungCount } from '../../../../domain/assocMeals/serverRung';
import type { AssocMeal, CatalogItem, MealName, MenuItem, Order } from '../../../../domain/types';
import { assocMenuFor } from '../../../../store/assocMenu';
import { recipeInfo } from '../../../../store/recipes';

export interface AssocSection {
  key: string;
  label: string;
  sub: string;
  /** Shown as a special: the chef's special of the day or the special of the week. */
  special: boolean;
  items: MenuItem[];
  /** The associate menu choice behind the section (its daily limit, for the special). */
  menuItem: AssocMenuItem;
}

/** The section heading for a choice: what kind of choice it is, then its name. */
export function assocSectionLabel(m: AssocMenuItem): string {
  if (m.special) return `Chef's special · ${m.name}`;
  if (m.weekly) return `Special of the week · ${m.name}`;
  if (m.soupOfDay) return `Soup of the day · ${m.name}`;
  return m.name;
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
    label: assocSectionLabel(m),
    sub: m.sub,
    special: !!(m.special || m.weekly),
    items: m.recipeIds.map((id) => tabletItemFor(id, meal, items)).filter((x): x is MenuItem => !!x),
    menuItem: m,
  }));
}

/**
 * How many more of a limited choice (the associate special) can be had
 * today: its daily limit less the meals planned in the Associate App and the
 * ones servers rang in on a tablet. Null when it has no limit.
 */
export function assocSectionLeft(sec: AssocSection, planned: AssocMeal[], checks: readonly Order[], todayIso: string): number | null {
  const left = itemsLeft(planned, todayIso, sec.menuItem);
  if (left == null) return null;
  const rung = serverRungCount(
    checks,
    todayIso,
    sec.items.map((i) => i.id),
    sec.menuItem.capMeals,
  );
  return Math.max(0, left - rung);
}

/** Today's associate menu for this meal (any day, so a server can always ring one in). */
export function todaysAssocMenu(meal: MealName, todayIso: string): AssocMenuItem[] {
  return assocMenuFor(todayIso, assocMealOf(meal), todayIso, undefined, true) ?? [];
}
