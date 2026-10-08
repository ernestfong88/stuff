/**
 * What the dining room TV shows: the current meal's special entrées, then
 * its soup, then its dessert special, one at a time. Anything the kitchen
 * has 86'd drops off the screen.
 */
import { getItem, todayCatalog } from '../../data';
import { defaultSides } from '../../domain/menu';
import type { CatalogItem, MealName } from '../../domain/types';
import { dishLongName, kioskMenu } from '../../domain/kioskMenu';
import { MEALS } from '../../domain/pickupService/meals';

export type SlideKind = 'entree' | 'soup' | 'dessert';

export interface DisplaySlide {
  item: CatalogItem;
  kind: SlideKind;
  /** "Peach Glazed Chicken Breast" (a catch of the day reads in full). */
  name: string;
  /** Names of the sides the entrée is plated with. */
  sides: string[];
}

/** Flagged as lunch's dessert special, but held off the screen until the community decides it belongs there. */
const NOT_ON_SCREEN = new Set(['Cereal Bar']);

/** The slides for a meal, in screen order, without anything 86'd. */
export function displaySlides(meal: MealName, isOut: (id: string) => boolean): DisplaySlide[] {
  const seen = new Set<string>();
  const once = (it: CatalogItem) => it.meal === meal && !isOut(it.id) && !seen.has(it.name) && !!seen.add(it.name);
  const slide = (item: CatalogItem, kind: SlideKind): DisplaySlide => ({
    item,
    kind,
    name: dishLongName(item.name),
    sides: kind === 'entree' ? defaultSides(item.id).map((id) => getItem(id)?.name ?? '').filter(Boolean) : [],
  });
  // Today's menu only: a special taken off in Menu Cycle, or another day's, never shows.
  const today = todayCatalog();
  const entrees = today.filter((it) => it.special && it.entree && once(it)).map((it) => slide(it, 'entree'));
  const soup = kioskMenu(meal, isOut).soups[0];
  const soups = soup && once(soup) ? [slide(soup, 'soup')] : [];
  const desserts = today
    .filter((it) => it.special && it.ctype === 'dessert' && !NOT_ON_SCREEN.has(it.name) && once(it))
    .map((it) => slide(it, 'dessert'));
  return [...entrees, ...soups, ...desserts];
}

const morning = (m: MealName) => m === 'Breakfast';
const lunch = (m: MealName) => m === 'Lunch';

/** "Tonight's Specials", "Today's Lunch Special", "This Morning's Special" ... */
export function specialsLabel(meal: MealName, one: boolean): string {
  if (morning(meal)) return one ? "This Morning's Special" : "This Morning's Specials";
  if (lunch(meal)) return one ? "Today's Lunch Special" : "Today's Lunch Specials";
  return one ? "Tonight's Special" : "Tonight's Specials";
}

export function soupLabel(meal: MealName): string {
  return morning(meal) ? "This Morning's Soup" : lunch(meal) ? "Today's Soup" : "Tonight's Soup";
}

export function dessertLabel(meal: MealName): string {
  return morning(meal) ? "This Morning's Sweet" : lunch(meal) ? "Today's Dessert Special" : "Tonight's Dessert";
}

/** The small line above a slide's dish name. */
export function slideLabel(slide: DisplaySlide, meal: MealName, entreeCount: number): string {
  if (slide.kind === 'soup') return soupLabel(meal);
  if (slide.kind === 'dessert') return dessertLabel(meal);
  return specialsLabel(meal, entreeCount === 1);
}

/** The meal after `pin` in the staff preview cycle; null goes back to following the clock. */
export function nextPreview(pin: MealName | null): MealName | null {
  if (pin == null) return MEALS[0];
  return MEALS[MEALS.indexOf(pin) + 1] ?? null;
}
