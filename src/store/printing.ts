/**
 * Printer mode on the floor: what a tablet item is to the printers (its group,
 * Recipe Book category and recipe), and the categories and recipes Back
 * Office can pick for a printer. Rules live in src/domain/printing.
 */
import { catalog, getItem } from '../data';
import { isAlcoholFreeName } from '../domain/menu';
import { printGroupOf, subKey, type PrintGroup, type PrintItem } from '../domain/printing';
import { recipeInfo, recipesIn, type RecipeInfo } from './recipes';

const BOOK_CATS = ['Drinks', 'Starters', 'Entrees', 'Sides', 'Desserts', 'Snacks'];

/** Every Recipe Book entry by lower-case name, for tablet items whose id isn't a recipe id. */
function byName(): Map<string, RecipeInfo> {
  return new Map(BOOK_CATS.flatMap((c) => recipesIn(c)).map((r) => [r.name.toLowerCase(), r]));
}

/** The recipe behind a tablet item: same id, else same name. */
export function recipeForItem(itemId: string, names: Map<string, RecipeInfo> = byName()): RecipeInfo | undefined {
  const it = getItem(itemId);
  return recipeInfo(itemId) ?? (it ? names.get(it.name.toLowerCase()) : undefined);
}

/** A tablet item as the printers see it. */
export function printItemFor(itemId: string, names: Map<string, RecipeInfo> = byName()): PrintItem | undefined {
  const it = getItem(itemId);
  if (!it) return undefined;
  const r = recipeForItem(itemId, names);
  const group: PrintGroup = r ? printGroupOf(r.cat, r.sub) : printGroupOf(it.category);
  return { name: it.name, group, sub: r?.sub ? subKey(group, r.sub) : undefined, recipeId: r?.id };
}

/** Several items at once (one name index for all). */
export function printItemsFor(itemIds: string[]): PrintItem[] {
  const names = byName();
  return itemIds.flatMap((id) => {
    const p = printItemFor(id, names);
    return p ? [p] : [];
  });
}

export interface PrintOption {
  /** Category key or recipe id. */
  key: string;
  label: string;
  group: PrintGroup;
  kind: 'sub' | 'recipe';
  /** For a recipe: its category. For a category: how many dishes on the menu. */
  hint: string;
}

/** The categories and recipes on the tablet menu that a printer can be set to. */
export function printOptions(): PrintOption[] {
  const names = byName();
  const recipes = new Map<string, PrintItem & { recipeId: string }>();
  for (const it of catalog) {
    const p = printItemFor(it.id, names);
    if (p?.recipeId && !recipes.has(p.recipeId)) recipes.set(p.recipeId, { ...p, recipeId: p.recipeId });
  }
  const subs = new Map<string, { group: PrintGroup; n: number }>();
  for (const r of recipes.values()) if (r.sub) subs.set(r.sub, { group: r.group, n: (subs.get(r.sub)?.n ?? 0) + 1 });
  return [
    ...[...subs].map(
      ([key, v]): PrintOption => ({
        key,
        label: key.slice(key.indexOf('/') + 1),
        group: v.group,
        kind: 'sub',
        hint: `${v.group} · ${v.n} on the menu`,
      }),
    ),
    ...[...recipes.values()].map(
      (r): PrintOption => ({
        key: r.recipeId,
        label: r.name,
        group: r.group,
        kind: 'recipe',
        hint: r.sub ? `${r.group} · ${r.sub.slice(r.sub.indexOf('/') + 1)}` : r.group,
      }),
    ),
  ].sort((a, b) => a.label.localeCompare(b.label));
}

const alcoholCache = new Map<string, boolean>();

/** Is this tablet item an alcoholic drink (wine, beer, spirits, cocktails)? NA wines and beers are not. */
export function isAlcoholItem(itemId: string): boolean {
  let v = alcoholCache.get(itemId);
  if (v === undefined) {
    const name = getItem(itemId)?.name ?? '';
    v = printItemFor(itemId)?.group === 'Alcohol' && !isAlcoholFreeName(name);
    alcoholCache.set(itemId, v);
  }
  return v;
}
