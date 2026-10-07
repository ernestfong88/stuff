/**
 * Sales history for P-Mix: what sold each day, by venue and meal, for the
 * last 8 weeks. Extracted from the prototype's sales model (menu cycle
 * specials plus the à la carte menu's weekly counts). Rows are keyed by
 * days back from today, so the history always ends yesterday.
 */
import pmixJson from './pmix.json';

export type PmixCategory = 'Entrees' | 'Starters' | 'Desserts' | string;
export type MealLetter = 'B' | 'L' | 'D';

export interface PmixRecipe {
  id: string;
  name: string;
  cat: PmixCategory;
  /** Protein key from PMIX_PROTEINS ('' when unknown). */
  protein: string;
}

export interface PmixDay {
  /** Days before today (1 = yesterday). */
  back: number;
  venue: string;
  meal: MealLetter;
  /** [recipe index, sold as a special, sold à la carte] */
  items: Array<[number, number, number]>;
  /** [side name index, count, [[entrée recipe index or -1 for on its own, count]]] */
  sides: Array<[number, number, Array<[number, number]>]>;
}

const seed = pmixJson as unknown as {
  venues: Array<{ id: string; name: string }>;
  proteins: Array<[string, string, string?]>;
  recipes: Array<[string, string, string, string]>;
  sides: string[];
  days: Array<[number, string, MealLetter, Array<[number, number, number]>, Array<[number, number, Array<[number, number]>]>]>;
};

export const PMIX_VENUES = seed.venues;
/** [key, label, short label] */
export const PMIX_PROTEINS = seed.proteins;
export const PMIX_RECIPES: PmixRecipe[] = seed.recipes.map(([id, name, cat, protein]) => ({ id, name, cat, protein }));
export const PMIX_SIDES = seed.sides;
export const PMIX_DAYS: PmixDay[] = seed.days.map(([back, venue, meal, items, sides]) => ({ back, venue, meal, items, sides }));
/** The oldest day with sales history. */
export const PMIX_OLDEST = Math.max(...PMIX_DAYS.map((d) => d.back));
