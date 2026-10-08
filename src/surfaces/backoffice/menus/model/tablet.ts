/**
 * How Back Office recipes map onto the tablet menu.
 *
 * The tablet lists a dish once per meal, each copy with its own id
 * ("l_burger", "d_burger"). In Back Office a recipe is one dish however many
 * meals carry it, so copies with the same name in the same kind of section
 * share one recipe, whose id is the first copy's id.
 */
import { baseMenu } from '../../../../data';
import type { MealName, Menu, MenuItem } from '../../../../domain/types';
import type { Recipe } from '../../../../store/menuEdits';
import { normCategory, subGroup, subOf, subToEntreeType } from './categories';

export { MEALS } from '../../../../domain/mealPeriods';

/** The kind of tablet section a category key is. */
export function sectionGroup(category: string): string {
  if (category === 'Starters') return 'app';
  if (category === 'Specials' || category === 'Entrées') return 'entree';
  if (category === 'Sides' || category === 'Add-Ons') return 'side';
  if (category === 'Desserts') return 'dessert';
  if (category === 'Drinks' || category === 'Beverages') return 'drink';
  if (category === 'Alcohol' || category === 'Cocktails') return 'alc';
  if (category === 'Fees') return 'fee';
  return 'other';
}

export interface TabletIndex {
  menu: Menu;
  /** Tablet item id → recipe id. */
  canonOf: Map<string, string>;
  /** Recipe id → every tablet item id for it. */
  idsOf: Map<string, string[]>;
  /** Tablet item id → where it sits (first place found). */
  placeOf: Map<string, { meal: MealName; category: string; item: MenuItem }>;
}

export function indexTablet(menu: Menu = baseMenu): TabletIndex {
  const canonOf = new Map<string, string>();
  const idsOf = new Map<string, string[]>();
  const placeOf = new Map<string, { meal: MealName; category: string; item: MenuItem }>();
  const firstByKey = new Map<string, string>();
  for (const [meal, cats] of Object.entries(menu) as Array<[MealName, Record<string, MenuItem[]>]>) {
    for (const [category, items] of Object.entries(cats)) {
      for (const it of items) {
        const key = it.name.toLowerCase() + '|' + sectionGroup(category);
        if (!firstByKey.has(key)) firstByKey.set(key, it.id);
        const g = firstByKey.get(key)!;
        canonOf.set(it.id, g);
        const list = idsOf.get(g) ?? [];
        if (!list.includes(it.id)) list.push(it.id);
        idsOf.set(g, list);
        if (!placeOf.has(it.id)) placeOf.set(it.id, { meal, category, item: it });
      }
    }
  }
  return { menu, canonOf, idsOf, placeOf };
}

let shared: TabletIndex | null = null;
/** The index of the tablet menu as it ships. */
export function tabletIndex(): TabletIndex {
  return (shared ??= indexTablet());
}

/** Tablet item ids for a recipe (itself when the tablet does not carry it). */
export function tabletIds(recipeId: string, idx: TabletIndex = tabletIndex()): string[] {
  return idx.idsOf.get(recipeId) ?? [recipeId];
}

/** The tablet item for a recipe, when the tablet carries it. */
export function tabletItem(recipeId: string, idx: TabletIndex = tabletIndex()): MenuItem | undefined {
  const id = idx.idsOf.get(recipeId)?.[0];
  return id ? idx.placeOf.get(id)?.item : undefined;
}

/**
 * The tablet section a Back Office recipe lands in on a meal's menu.
 * Snacks never reach the tablet.
 */
export function tabletSection(r: Pick<Recipe, 'cat' | 'name' | 'sub'>, sections: string[]): string | null {
  const c = normCategory(r.cat);
  if (c === 'Snacks') return null;
  if (c === 'Starters' || c === 'Sides' || c === 'Desserts') return c;
  if (c === 'Drinks') {
    const s = subOf(r);
    if (subGroup('Drinks', s) === 'Alcoholic') return s === 'Cocktails' && sections.includes('Cocktails') ? 'Cocktails' : 'Alcohol';
    return sections.includes('Beverages') && !sections.includes('Drinks') ? 'Beverages' : 'Drinks';
  }
  return 'Entrées';
}

/** A tablet item for a recipe Back Office made (the tablet has no copy of it). */
export function recipeToItem(r: Recipe): MenuItem {
  const price = Number(r.price) || 0;
  const item: MenuItem = {
    id: r.id,
    name: r.name,
    desc: r.menuDescriptor || r.desc || '',
    residentPrice: 0,
    guestPrice: price,
    alaPrice: price ? price + 2 : 0,
    day: 0,
    avail: null,
    mods: [],
    allergens: toTabletAllergens(r.allergens ?? []),
  };
  if (normCategory(r.cat) === 'Entrees') {
    item.entree = true;
    item.etype = subToEntreeType(subOf(r));
  }
  if (r.cookNotes) item.cookNotes = r.cookNotes;
  if (r.route) item.route = r.route;
  return item;
}

// ─── Allergens ────────────────────────────────────────────────────────────

/** Recipe Book allergen names → the tablet's (Milk is Dairy, Wheat is Gluten). */
const TO_TABLET: Record<string, string> = { Milk: 'Dairy', Wheat: 'Gluten', 'Tree nuts': 'Tree Nuts' };

export function toTabletAllergens(list: string[]): string[] {
  return list.map((a) => TO_TABLET[a] ?? a);
}

/**
 * An upcharge: an add-on sold on top of a dish (extra chicken on a salad).
 * The tablet marks these `upcharge` and lists them under Add-Ons.
 */
export function isUpchargeRecipe(recipeId: string, idx: TabletIndex = tabletIndex()): boolean {
  return tabletIds(recipeId, idx).some((id) => {
    const p = idx.placeOf.get(id);
    return !!p && (p.item.upcharge === true || p.category === 'Add-Ons');
  });
}
