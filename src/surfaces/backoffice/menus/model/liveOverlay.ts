/**
 * What the floor sees of Back Office's menu, as the difference from the
 * tablet menu that ships with the app (see src/store/menuEdits).
 *
 * The dining room orders from the menu its venue serves. For each meal, a
 * dish on that menu's Any Day list that the tablet lacks is added, and a
 * tablet dish Back Office took off is hidden (day -1, so a check that has it
 * still shows it). Specials follow the same rule on the cycle days the
 * tablet carries. Recipe edits (name, description, allergens, cook notes,
 * who makes it, entrée type), prices, default sides and reminders patch the
 * tablet items; only what Back Office changed is patched, so the seed
 * produces an empty overlay.
 */
import type { MealName, MenuItem, ModGroup } from '../../../../domain/types';
import type { LiveItemPatch, LiveMenuOverlay, LiveRuledGroup, ModRuleEdit, Recipe } from '../../../../store/menuEdits';
import { normCategory, subOf, subToEntreeType } from './categories';
import { venuesAt } from './cycle';
import { resolveRule, ruleIsSet } from './modRules';
import { MEALS, recipeToItem, sectionGroup, tabletSection, toTabletAllergens, type TabletIndex } from './tablet';
import type { BoState } from './types';

/** The venue whose menu the dining room tablets order from. */
export const DINING_VENUE_ID = 'v1';

export interface LiveInputs {
  state: BoState;
  seed: BoState;
  idx: TabletIndex;
  ruleDefaults: Record<string, ModRuleEdit>;
  /** Order modifier groups are asked in, by tablet item id. */
  pinSeq: Record<string, string[]>;
  at: number;
}

const sameList = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((x) => b.includes(x));
const descOf = (r: Recipe) => r.menuDescriptor || r.desc || '';

/** Fields a recipe edit changes on its tablet items. */
function recipePatch(r: Recipe, before: Recipe | undefined): LiveItemPatch {
  if (!before) return {};
  const p: LiveItemPatch = {};
  if (r.name !== before.name) p.name = r.name;
  if (descOf(r) !== descOf(before)) p.desc = descOf(r);
  if (!sameList(r.allergens, before.allergens)) p.allergens = toTabletAllergens(r.allergens ?? []);
  if ((r.cookNotes ?? '') !== (before.cookNotes ?? '')) p.cookNotes = r.cookNotes ?? '';
  if (r.route && r.route !== before.route) p.route = r.route;
  if (normCategory(r.cat) === 'Entrees' && subOf(r) !== subOf(before)) p.etype = subToEntreeType(subOf(r));
  return p;
}

export function computeLive({ state, seed, idx, ruleDefaults, pinSeq, at }: LiveInputs): LiveMenuOverlay {
  const items: Record<string, LiveItemPatch> = {};
  const patch = (id: string, p: LiveItemPatch) => {
    if (Object.keys(p).length) items[id] = { ...items[id], ...p };
  };
  const added: LiveMenuOverlay['added'] = [];
  const recipes = new Map(state.recipes.map((r) => [r.id, r]));
  const seedRecipes = new Map(seed.recipes.map((r) => [r.id, r]));
  const canon = (id: string) => idx.canonOf.get(id) ?? id;
  const venue = venuesAt(state.venues, at).find((v) => v.id === DINING_VENUE_ID);
  const menuId = venue?.menuId ?? 'm1';

  // Recipe and price changes, by recipe id.
  const fields = new Map<string, LiveItemPatch>();
  for (const r of state.recipes) {
    const p = recipePatch(r, seedRecipes.get(r.id));
    if (Object.keys(p).length) fields.set(r.id, p);
  }
  for (const row of state.prices) {
    if (row.venueId !== DINING_VENUE_ID) continue;
    const p: LiveItemPatch = {};
    if (row.res != null) p.residentPrice = row.res;
    if (row.guest != null) p.guestPrice = row.guest;
    if (row.ala != null) p.alaPrice = row.ala;
    fields.set(row.recipeId, { ...fields.get(row.recipeId), ...p });
  }

  // A dish moved to Snacks leaves the server's menu.
  const removed: string[] = [];
  for (const r of state.recipes) {
    if (normCategory(r.cat) === 'Snacks' && normCategory(seedRecipes.get(r.id)?.cat) !== 'Snacks') removed.push(...(idx.idsOf.get(r.id) ?? []));
  }
  const gone = new Set(removed);

  for (const meal of MEALS) {
    const cats = idx.menu[meal] ?? {};
    const sections = Object.keys(cats);
    const mealItems = Object.entries(cats).flatMap(([category, list]) => list.map((item) => ({ category, item })));
    const days = new Set(mealItems.map((x) => x.item.day).filter((d) => d >= 0));
    for (const day of days) {
      const onTablet = new Set(mealItems.filter((x) => x.item.day === day).map((x) => canon(x.item.id)));
      const onMenu = new Set(
        state.grid
          .filter((g) => g.menuId === menuId && g.day === day && g.meal === meal)
          .map((g) => g.recipeId)
          .filter((id) => {
            const r = recipes.get(id);
            return r ? normCategory(r.cat) !== 'Snacks' : idx.idsOf.has(id);
          }),
      );
      for (const g of onTablet) {
        if (onMenu.has(g)) continue;
        for (const x of mealItems) if (x.item.day === day && canon(x.item.id) === g) patch(x.item.id, { day: -1 });
      }
      for (const g of onMenu) {
        if (onTablet.has(g)) continue;
        const here = mealItems.filter((x) => canon(x.item.id) === g && !gone.has(x.item.id));
        if (here.length) {
          // The tablet has it on this meal but hidden or on another day: show it on this one.
          for (const x of here) if (x.item.day !== 0 || day === 0) patch(x.item.id, { day });
          continue;
        }
        const src = (idx.idsOf.get(g) ?? []).map((id) => idx.placeOf.get(id)).find(Boolean);
        const r = recipes.get(g);
        let item: MenuItem;
        let section: string | null;
        if (src) {
          item = { ...src.item, ...fields.get(g), day };
          section = sectionGroup(src.category) === 'drink' && r ? tabletSection(r, sections) : src.category;
        } else if (r) {
          item = { ...recipeToItem(r), ...fields.get(g), day };
          section = tabletSection(r, sections);
        } else continue;
        if (!section) continue;
        if (day > 0) item.special = true;
        added.push({ meal, category: section, item });
      }
    }
  }

  for (const [g, p] of fields) for (const id of idx.idsOf.get(g) ?? []) patch(id, p);

  // Default sides chosen for a placement on the dining room's menu.
  const sideIn = (sideId: string, meal: MealName): string => {
    const ids = idx.idsOf.get(sideId) ?? [sideId];
    const inMeal = ids.filter((id) => idx.placeOf.get(id)?.meal === meal);
    return inMeal[0] ?? ids[0];
  };
  for (const [day, byRecipe] of Object.entries(state.sides[menuId] ?? {})) {
    for (const [g, sides] of Object.entries(byRecipe)) {
      for (const id of idx.idsOf.get(g) ?? []) {
        const place = idx.placeOf.get(id);
        if (!place || Math.max(place.item.day, 0) !== +day) continue;
        patch(id, { defaultSideIds: sides.map((s) => sideIn(s, place.meal)) });
      }
      for (const a of added) if (canon(a.item.id) === g && a.item.day === +day) a.item.defaultSideIds = sides.map((s) => sideIn(s, a.meal));
    }
  }

  const reminders: Record<string, string[]> = {};
  for (const r of state.recipes) {
    if (!r.reminders?.length) continue;
    for (const id of idx.idsOf.get(r.id) ?? [r.id]) reminders[id] = r.reminders;
  }

  const out: LiveMenuOverlay = { items, added, removed, reminders };
  if (state.modGroups !== seed.modGroups || Object.keys(state.modRules).length) {
    Object.assign(out, liveModifiers(state, idx, ruleDefaults, pinSeq, added));
  }
  return out;
}

/** Modifier groups and their ordering rules as the order screens read them. */
export function liveModifiers(
  state: Pick<BoState, 'modGroups' | 'modRules'>,
  idx: TabletIndex,
  ruleDefaults: Record<string, ModRuleEdit>,
  pinSeq: Record<string, string[]>,
  added: LiveMenuOverlay['added'] = [],
): Pick<LiveMenuOverlay, 'modGroups' | 'modifierRules'> {
  const active = state.modGroups.filter((g) => g.active);
  const modGroups: ModGroup[] = active.map((g) => ({ id: g.id, name: g.name, mods: g.mods.map((m) => m.n) }));
  const groups: Record<string, LiveRuledGroup> = {};
  for (const g of active) {
    const rule = resolveRule(ruleDefaults[g.id], state.modRules[g.id]);
    if (!ruleIsSet(rule)) continue;
    groups[g.id] = { name: g.name, options: g.mods.map((m) => (m.price ? { name: m.n, price: m.price } : { name: m.n })), rule };
  }
  const itemIds = [...idx.placeOf.keys(), ...added.map((a) => a.item.id)];
  const canon = (id: string) => idx.canonOf.get(id) ?? id;
  const items: Record<string, string[]> = {};
  for (const id of new Set(itemIds)) {
    const g = canon(id);
    const ids = idx.idsOf.get(g) ?? [id];
    const seq = pinSeq[id] ?? [];
    const rank = (gid: string) => (seq.includes(gid) ? seq.indexOf(gid) : 99);
    const pinned = active
      .filter((grp) => groups[grp.id] && grp.pinned.some((q) => q === id || q === g || ids.includes(q)))
      .map((grp) => grp.id)
      .sort((a, b) => rank(a) - rank(b));
    if (pinned.length) items[id] = pinned;
  }
  return { modGroups, modifierRules: { groups, items } };
}
