/**
 * Chart colours, drawn from the brand palette. Fills are a step softer than
 * the text tokens so value labels in ink stay readable next to them.
 * Sentiment and on/off goal are diverging: green and red poles with a
 * neutral grey between, never a hue in the middle.
 */
export const CHART = {
  good: '#4E9A55',
  goodSoft: '#B5D9B4',
  bad: '#C9584B',
  badSoft: '#E9B4AC',
  watch: '#D9A13B',
  neutral: '#A3AEB8',
  empty: '#E4E8EC',
  ink: '#1B2630',
  goalLine: '#5E6B74',
  /** Revenue: made (soft ocean, today in full ocean) with comps stacked on top in clay. */
  made: '#A9C3D6',
  madeNow: '#3F7FA8',
  comped: '#C9805E',
} as const;

/**
 * Course categories, shared by the dashboard P-Mix wheel and the P-Mix page.
 * Categorical hues (validated all-pairs for colour blindness), each with a
 * one-hue ramp, darkest first, for its dishes when drilled in. `soft` is the
 * base half way to white, for a second series of the same category (the P-Mix
 * page's à la carte beside specials).
 */
export type CategoryHue = { base: string; soft: string; ramp: readonly string[] };
export const CATEGORY_HUES = {
  Starters: { base: '#eb6834', soft: '#f5b49a', ramp: ['#8f3810', '#c94f1e', '#eb6834', '#f0956a'] },
  Entrées: { base: '#2a78d6', soft: '#95bceb', ramp: ['#184f95', '#2a78d6', '#5598e7', '#86b6ef'] },
  Desserts: { base: '#1baf7a', soft: '#8dd7bd', ramp: ['#085c3d', '#0e7f56', '#1baf7a', '#50c497'] },
} as const satisfies Record<string, CategoryHue>;
/** Any category that is not a starter, entrée or dessert. */
export const CATEGORY_GREY: CategoryHue = { base: '#8a949b', soft: '#c5cacd', ramp: ['#3a4751', '#5e6b74', '#8a949b', '#aeb6bc'] };
/** "Everything else": the dishes rolled into one slice. */
export const CATEGORY_OTHER = '#c9cfd3';

/** Which of the three courses a menu or recipe category name belongs to ("Soups and starters", "Entrees", "Sandwiches"...), if any. */
export function courseOf(name: string): keyof typeof CATEGORY_HUES | null {
  const n = name.toLowerCase();
  if (/soup|starter|appeti[sz]er|salad/.test(n)) return 'Starters';
  if (/entr[ée]e|sandwich|plate/.test(n)) return 'Entrées';
  if (/dessert/.test(n)) return 'Desserts';
  return null;
}
/** A category's hue and ramp; grey for anything outside the three courses. */
export function categoryHue(name: string): CategoryHue {
  const c = courseOf(name);
  return c ? CATEGORY_HUES[c] : CATEGORY_GREY;
}
