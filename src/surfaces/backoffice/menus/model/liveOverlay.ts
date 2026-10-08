/**
 * What the floor sees of Back Office's menu, as the difference from the
 * tablet menu that ships with the app (see src/store/menuEdits).
 *
 * Each room (kitchen) orders from the menu of the venue it belongs to (see
 * roomVenue: Sequoia for the Sequoia / Evergreen room, The Bistro for its
 * own): that venue's à la carte choice every day (an à la carte menu, or a
 * cycle's every-day items) and, with a cycle, today's specials, at the
 * venue's own prices. Today's cycle day is worked out as everywhere else
 * (venueServing). For each meal, a dish on today's lists that the tablet
 * lacks is added, and a tablet dish that is not on them is hidden (day -1,
 * so a check that has it still shows it). Recipe edits (name, description,
 * allergens, cook notes, who makes it, entrée type), prices, default sides
 * and reminders patch the tablet items; only what Back Office changed is
 * patched, so the dining room's seed produces an empty patch list.
 */
import type { MealName, MenuItem, ModGroup } from '../../../../domain/types';
import type { GridEntry, LiveItemPatch, LiveMenuOverlay, LiveRoomMenu, LiveRuledGroup, ModRuleEdit, Recipe, VenueSchedule } from '../../../../store/menuEdits';
import { DINING_ROOM, roomVenue, venueServing, type VenueServing } from '../../../../store/venueMenu';
import { rooms } from '../../../../data';
import { normCategory, subOf, subToEntreeType } from './categories';
import { resolveRule, ruleIsSet } from './modRules';
import { MEALS, recipeToItem, sectionGroup, tabletSection, toTabletAllergens, type TabletIndex } from './tablet';
import type { BoState } from './types';

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

/** What a room's venue serves today; null when the room has no active venue. */
export function roomServing(state: Pick<BoState, 'venues' | 'menus' | 'grid'>, room: string, at: number): VenueServing | null {
  const v = roomVenue<VenueSchedule>(room, state.venues);
  return v ? venueServing(v, at, state.menus, state.grid) : null;
}

/** The placements a venue serves on a cycle day: day 0 is its à la carte choice, day 1+ its cycle. */
export function servedOn(grid: GridEntry[], serve: VenueServing | null, day: number): GridEntry[] {
  if (!serve) return [];
  if (day > 0) return serve.cycleId ? grid.filter((g) => g.menuId === serve.cycleId && g.day === day) : [];
  const alc = serve.alcId;
  if (!alc) return [];
  const base = alc.replace(/:everyday$/, '');
  return grid.filter((g) => g.menuId === base && g.day === 0);
}

interface Shared {
  state: BoState;
  idx: TabletIndex;
  recipes: Map<string, Recipe>;
  /** Recipe edits by recipe id. */
  fields: Map<string, LiveItemPatch>;
  gone: Set<string>;
}

/** One room's day and price patches and added items. */
function roomMenu({ state, idx, recipes, fields: recipeFields, gone }: Shared, serve: VenueServing | null): LiveRoomMenu {
  const items: Record<string, LiveItemPatch> = {};
  const patch = (id: string, p: LiveItemPatch) => {
    if (Object.keys(p).length) items[id] = { ...items[id], ...p };
  };
  const added: LiveRoomMenu['added'] = [];
  const canon = (id: string) => idx.canonOf.get(id) ?? id;
  const today = serve?.day ?? 0;

  // Recipe and price changes, by recipe id.
  const fields = new Map(recipeFields);
  for (const row of state.prices) {
    if (!serve || row.venueId !== serve.venueId) continue;
    const p: LiveItemPatch = {};
    if (row.res != null) p.residentPrice = row.res;
    if (row.guest != null) p.guestPrice = row.guest;
    if (row.ala != null) p.alaPrice = row.ala;
    fields.set(row.recipeId, { ...fields.get(row.recipeId), ...p });
  }

  for (const meal of MEALS) {
    const cats = idx.menu[meal] ?? {};
    const sections = Object.keys(cats);
    const mealItems = Object.entries(cats).flatMap(([category, list]) => list.map((item) => ({ category, item })));
    // Every day (the à la carte choice), then today's cycle day.
    for (const day of today > 0 ? [0, today] : [0]) {
      const onTablet = new Set(mealItems.filter((x) => x.item.day === day).map((x) => canon(x.item.id)));
      const onMenu = new Set(
        servedOn(state.grid, serve, day)
          .filter((g) => g.meal === meal)
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
          // The tablet has it on this meal but hidden or on another day: show it on this one. An every-day
          // dish stays on every day, unless the à la carte choice left it off (then it is today's special).
          for (const x of here)
            if (x.item.day !== 0 || day === 0 || items[x.item.id]?.day === -1) patch(x.item.id, day > 0 ? { day, special: true } : { day });
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

  // Default sides chosen for a placement on the venue's menus.
  const sideIn = (sideId: string, meal: MealName): string => {
    const ids = idx.idsOf.get(sideId) ?? [sideId];
    const inMeal = ids.filter((id) => idx.placeOf.get(id)?.meal === meal);
    return inMeal[0] ?? ids[0];
  };
  const menuIds = [serve?.cycleId, serve?.alcId?.replace(/:everyday$/, '')].filter((x): x is string => !!x);
  for (const menuId of new Set(menuIds)) {
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
  }
  return { venueId: serve?.venueId ?? '', day: today, items, added };
}

export function computeLive({ state, seed, idx, ruleDefaults, pinSeq, at }: LiveInputs): LiveMenuOverlay {
  const recipes = new Map(state.recipes.map((r) => [r.id, r]));
  const seedRecipes = new Map(seed.recipes.map((r) => [r.id, r]));

  // Recipe changes reach every room.
  const fields = new Map<string, LiveItemPatch>();
  for (const r of state.recipes) {
    const p = recipePatch(r, seedRecipes.get(r.id));
    if (Object.keys(p).length) fields.set(r.id, p);
  }

  // A dish moved to Snacks leaves the server's menu.
  const removed: string[] = [];
  for (const r of state.recipes) {
    if (normCategory(r.cat) === 'Snacks' && normCategory(seedRecipes.get(r.id)?.cat) !== 'Snacks') removed.push(...(idx.idsOf.get(r.id) ?? []));
  }
  const shared: Shared = { state, idx, recipes, fields, gone: new Set(removed) };

  const dining = roomMenu(shared, roomServing(state, DINING_ROOM, at));
  const others: Record<string, LiveRoomMenu> = {};
  for (const room of Object.keys(rooms)) {
    if (room === DINING_ROOM) continue;
    const serve = roomServing(state, room, at);
    if (serve) others[room] = roomMenu(shared, serve);
  }

  const reminders: Record<string, string[]> = {};
  for (const r of state.recipes) {
    if (!r.reminders?.length) continue;
    for (const id of idx.idsOf.get(r.id) ?? [r.id]) reminders[id] = r.reminders;
  }

  const out: LiveMenuOverlay = { items: dining.items, added: dining.added, removed, reminders, day: dining.day, rooms: others };
  if (state.modGroups !== seed.modGroups || Object.keys(state.modRules).length) {
    const allAdded = [...dining.added, ...Object.values(others).flatMap((r) => r.added)];
    Object.assign(out, liveModifiers(state, idx, ruleDefaults, pinSeq, allAdded));
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
    // A group with no ordering rule still prices its up-charges ("Bacon +$2"), on every tablet.
    if (!ruleIsSet(rule) && !g.mods.some((m) => m.price)) continue;
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
    // Every group pinned to the dish, ruled or not: the server's Modify screen opens on them, as the kiosk does.
    const pinned = active
      .filter((grp) => grp.pinned.some((q) => q === id || q === g || ids.includes(q)))
      .map((grp) => grp.id)
      .sort((a, b) => rank(a) - rank(b));
    if (pinned.length) items[id] = pinned;
  }
  return { modGroups, modifierRules: { groups, items } };
}
