/** Prices per venue: the menu's own price unless the venue set another. */
import type { PriceRow, Recipe } from '../../../../store/menuEdits';
import { tabletItem } from './tablet';
import type { BoState } from './types';

export type PriceField = 'res' | 'guest' | 'ala';

export interface Prices {
  res: number | null;
  guest: number | null;
  ala: number | null;
}

/** The price a recipe has before any venue changes it: the tablet's, or what Back Office set when it made the recipe. */
export function menuPrices(r: Recipe): Prices {
  const it = tabletItem(r.id);
  if (it) return { res: it.residentPrice, guest: it.guestPrice, ala: it.alaPrice };
  const p = Number(r.price) || 0;
  return p ? { res: 0, guest: p, ala: p + 2 } : { res: null, guest: null, ala: null };
}

/** Recipes on a menu, each once. */
export function recipesOnMenu(s: BoState, menuId: string | null): string[] {
  if (!menuId) return [];
  return [...new Set(s.grid.filter((g) => g.menuId === menuId).map((g) => g.recipeId))];
}

export function priceRow(prices: PriceRow[], venueId: string, recipeId: string): PriceRow | undefined {
  return prices.find((p) => p.venueId === venueId && p.recipeId === recipeId);
}

/** Set one price; a value equal to the menu price (or blank) goes back to following the menu. */
export function setPrice(prices: PriceRow[], venueId: string, r: Recipe, field: PriceField, value: number | null): PriceRow[] {
  const base = menuPrices(r)[field];
  const v = value === base ? null : value;
  const cur = priceRow(prices, venueId, r.id) ?? { recipeId: r.id, venueId, res: null, guest: null, ala: null };
  const next = { ...cur, [field]: v };
  const rest = prices.filter((p) => p !== priceRow(prices, venueId, r.id));
  return next.res == null && next.guest == null && next.ala == null ? rest : [...rest, next];
}

/** Price rows at a venue for recipes no longer on its menu. */
export function orphanPrices(prices: PriceRow[], venueId: string, onMenu: string[]): PriceRow[] {
  const ids = new Set(onMenu);
  return prices.filter((p) => p.venueId === venueId && !ids.has(p.recipeId));
}

/** A recipe's prices at a venue: the menu's, with the venue's own where it set one. */
export function venuePrices(prices: PriceRow[], venueId: string | null | undefined, r: Recipe): Prices {
  const base = menuPrices(r);
  const row = venueId ? priceRow(prices, venueId, r.id) : undefined;
  return { res: row?.res ?? base.res, guest: row?.guest ?? base.guest, ala: row?.ala ?? base.ala };
}

/** "$12.50" */
export function money(n: number): string {
  return '$' + n.toFixed(2);
}

/**
 * The price a printed menu shows for a dish: "$12.50", or "+$2.00" for an
 * add-on sold on top of a dish. Nothing for a dish with no price (included
 * in the meal plan, or never priced), never "$0.00".
 */
export function printedPrice(p: Prices, field: PriceField, upcharge = false): string | undefined {
  const v = p[field];
  if (v == null || !(v > 0)) return undefined;
  return (upcharge ? '+' : '') + money(v);
}
