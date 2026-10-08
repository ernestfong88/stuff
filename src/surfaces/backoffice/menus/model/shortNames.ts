/** The short name servers and the kitchen see for a recipe. */
import type { DiningConfig } from '../../../../domain/config';
import { shortName } from '../../../../domain/menu';
import type { Recipe } from '../../../../store/menuEdits';

/** The built-in short name: the recipe's own, else the tablet's rule, else the full name. */
export function defaultShort(r: Pick<Recipe, 'name' | 'shortDefault'>): string {
  return r.shortDefault || shortName(r.name);
}

/** What servers see: a name set in Back Office, else the built-in one. */
export function recipeShort(r: Pick<Recipe, 'name' | 'shortDefault'>, cfg: DiningConfig): string {
  return cfg.shortNames[r.name] || defaultShort(r);
}

/** Other recipes that would show the same short name, so servers could not tell them apart. */
export function sameShortAs(r: Pick<Recipe, 'name' | 'shortDefault'>, all: Recipe[], cfg: DiningConfig): string[] {
  const key = recipeShort(r, cfg).trim().toLowerCase();
  if (!key) return [];
  return all.filter((x) => x.name !== r.name && recipeShort(x, cfg).trim().toLowerCase() === key).map((x) => x.name);
}
