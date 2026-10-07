/**
 * Back Office menu data: the seed merged with the edits saved in
 * src/store/menuEdits, and the one way to change it (updateBo), which also
 * recomputes what the floor sees.
 */
import { useSyncExternalStore } from 'react';
import { pinSeq, SEED_GRID, TURNED_MENUS } from '../../../data';
import { revive } from '../../../data/revive';
import { now } from '../../../lib/clock';
import { venueSettingsStore, type VenueSettings } from '../../../store/venueSettings';
import {
  menuEditsStore,
  type BoMenu,
  type BoModGroup,
  type MenuEditsState,
  type ModRuleEdit,
  type Recipe,
  type SideOverrides,
  type VenueSchedule,
} from '../../../store/menuEdits';
import { quarterIndexOf, quarterLabel, quarterMenuName, seedShift, shiftDay } from '../../../domain/menuCycle';
import { computeLive } from './model/liveOverlay';
import { tabletIndex } from './model/tablet';
import type { BoState } from './model/types';
import recipesJson from './seed/recipes.json';
import menusJson from './seed/menus.json';
import modGroupsJson from './seed/modGroups.json';
import ruleDefaultsJson from './seed/ruleDefaults.json';
import seedSidesJson from './seed/seedSides.json';

/** Who Back Office records as the editor of a menu. */
export const BACK_OFFICE_AUTHOR = 'Ernest Fong';

/** Built-in ordering rules, by modifier group id. */
export const RULE_DEFAULTS = ruleDefaultsJson as Record<string, ModRuleEdit>;

/**
 * Default sides each placement comes with before a chef changes them:
 * menu → day → entrée recipe → side recipe ids.
 */
export const SEED_SIDES = turnSides(seedSidesJson as Record<string, Record<string, Record<string, string[]>>>, seedShift(now()));

/** Seeded side choices follow their turned days (see SEED_TODAY). */
function turnSides(sides: SideOverrides, shift: number): SideOverrides {
  if (!shift) return sides;
  const out: SideOverrides = { ...sides };
  for (const [menuId, len] of Object.entries(TURNED_MENUS))
    if (sides[menuId]) out[menuId] = Object.fromEntries(Object.entries(sides[menuId]).map(([d, v]) => [String(shiftDay(+d, shift, len)), v]));
  return out;
}


type SeedMenu = Omit<BoMenu, 'name' | 'quarter'> & { name?: string; quarterOffset?: number; yearRound?: boolean };

/** Seed menus carry their quarter relative to today, so this quarter's menu is always the live one. */
function seedMenus(at: number): BoMenu[] {
  const q0 = quarterIndexOf(at);
  return revive(menusJson as unknown as SeedMenu[], at).map(({ quarterOffset, yearRound, name, ...m }) => {
    const quarter = yearRound || quarterOffset == null ? 'Year-round' : quarterLabel(q0 + quarterOffset);
    return { ...m, quarter, name: name ?? quarterMenuName(quarter, m.kind) };
  });
}

/**
 * Which menu each venue serves and from when. Venue Settings owns the
 * schedule; the menu pages only read it.
 */
function schedulesOf(vs: VenueSettings): VenueSchedule[] {
  return vs.venues.map((v) => ({ id: v.id, name: v.name, menuId: v.menuId, menuStartDt: v.menuStartDt, alcMenuId: v.alcMenuId ?? null, active: v.active, upcoming: v.upcoming }));
}

function buildSeed(at: number): BoState {
  return {
    recipes: recipesJson as unknown as Recipe[],
    grid: SEED_GRID,
    menus: seedMenus(at),
    venues: schedulesOf(venueSettingsStore.get()),
    modGroups: modGroupsJson as BoModGroup[],
    modRules: {},
    prices: [],
    sides: {},
    favorites: {},
  };
}

export const SEED: BoState = buildSeed(now());

let cacheKey: MenuEditsState | null = null;
let cacheVenues: VenueSettings | null = null;
let cacheVal: BoState = SEED;

/** Back Office's menu data for a saved state. */
export function boStateOf(s: MenuEditsState, vs: VenueSettings = venueSettingsStore.get()): BoState {
  if (s === cacheKey && vs === cacheVenues) return cacheVal;
  cacheKey = s;
  cacheVenues = vs;
  cacheVal = {
    recipes: s.recipes ?? SEED.recipes,
    grid: s.grid ?? SEED.grid,
    menus: s.menus ?? SEED.menus,
    venues: schedulesOf(vs),
    modGroups: s.modGroups ?? SEED.modGroups,
    modRules: s.modRules ?? SEED.modRules,
    prices: s.prices ?? SEED.prices,
    sides: s.sides ?? SEED.sides,
    favorites: s.favorites ?? SEED.favorites,
  };
  return cacheVal;
}

export function getBo(): BoState {
  return boStateOf(menuEditsStore.get());
}

/** Back Office's menu data in a component. */
export function useBo(): BoState {
  return useSyncExternalStore(subscribeBo, getBo, getBo);
}

function subscribeBo(listener: () => void): () => void {
  const offMenus = menuEditsStore.subscribe(listener);
  const offVenues = venueSettingsStore.subscribe(listener);
  return () => {
    offMenus();
    offVenues();
  };
}

/**
 * Recompute what the floor sees, e.g. after Venue Settings starts a menu:
 * the cycle day, and so the specials, follow the venue's schedule.
 */
export function refreshLiveMenu(): void {
  updateBo(() => ({}));
}

/** Change Back Office's menu data; the floor sees the result at once. */
export function updateBo(change: (s: BoState) => Partial<BoState>): void {
  menuEditsStore.set((prev) => {
    const patch = change(boStateOf(prev));
    const next: MenuEditsState = { ...prev, ...patch };
    const state = boStateOf(next);
    return { ...next, live: computeLive({ state, seed: SEED, idx: tabletIndex(), ruleDefaults: RULE_DEFAULTS, pinSeq, at: now() }) };
  });
}

/** Put every menu, recipe and modifier back the way it shipped. */
export function resetMenuEdits(): void {
  menuEditsStore.reset();
}

// ─── Small helpers every page uses ───────────────────────────────────────

export function recipeById(s: BoState, id: string): Recipe | undefined {
  return s.recipes.find((r) => r.id === id);
}

/** Change one recipe. */
export function updateRecipe(id: string, patch: Partial<Recipe>): void {
  updateBo((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
}

/** Days in a menu's cycle: its set length, or the last day something is placed on. */
export function cycleLenOf(s: BoState, menuId: string): number {
  const m = s.menus.find((x) => x.id === menuId);
  if (!m || m.kind === 'alc') return 0;
  let last = 0;
  for (const g of s.grid) if (g.menuId === menuId && g.day > last) last = g.day;
  return last > 0 ? Math.max(m.cycleLen || 0, last) : m.cycleLen || 0;
}

/** The default sides of an entrée placement: the chef's choice, else the seed's. */
export function placementSides(s: BoState, menuId: string, day: number, recipeId: string): { sides: string[]; changed: boolean } {
  const own = s.sides[menuId]?.[day]?.[recipeId];
  if (own) return { sides: own, changed: true };
  return { sides: SEED_SIDES[menuId]?.[day]?.[recipeId] ?? [], changed: false };
}

/** Set (or with null, go back to the usual) default sides for a placement. */
export function setPlacementSides(menuId: string, day: number, recipeId: string, sides: string[] | null): void {
  updateBo((s) => {
    const menu = { ...s.sides[menuId] };
    const d = { ...menu[day] };
    if (sides) d[recipeId] = sides;
    else delete d[recipeId];
    menu[day] = d;
    return { sides: { ...s.sides, [menuId]: menu } };
  });
}
