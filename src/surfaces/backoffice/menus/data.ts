/**
 * Back Office menu data: the seed merged with the edits saved in
 * src/store/menuEdits, and the one way to change it (updateBo), which also
 * recomputes what the floor sees.
 */
import { useSyncExternalStore } from 'react';
import { forgetMenusAhead, pinSeq, SEED_GRID, setMenuForDay, TURNED_MENUS } from '../../../data';
import { revive } from '../../../data/revive';
import { now } from '../../../lib/clock';
import { venueSettingsStore, type VenueSettings } from '../../../store/venueSettings';
import {
  menuEditsStore,
  type BoMenu,
  type BoModGroup,
  type LiveMenuOverlay,
  type MenuEditsState,
  type ModRuleEdit,
  type Recipe,
  type SideOverrides,
  type VenueSchedule,
} from '../../../store/menuEdits';
import { isoDay, parseIsoDay, quarterIndexOf, quarterLabel, quarterMenuName, seedShift, shiftDay } from '../../../domain/menuCycle';
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
  return vs.venues.map((v) => ({ id: v.id, name: v.name, room: v.room, menuId: v.menuId, menuStartDt: v.menuStartDt, alcMenuId: v.alcMenuId ?? null, active: v.active, upcoming: v.upcoming }));
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

/** What the floor should see now, from the saved edits and Venue Settings. */
export function liveNow(edits: MenuEditsState = menuEditsStore.get()): LiveMenuOverlay {
  return computeLive({ state: boStateOf(edits), seed: SEED, idx: tabletIndex(), ruleDefaults: RULE_DEFAULTS, pinSeq, at: now() });
}

/**
 * What the floor would see on a later day ("YYYY-MM-DD"): the same overlay
 * as today's, worked out at noon that day, so a pick up or delivery booked
 * ahead orders from that day's cycle specials and à la carte choice.
 */
export function liveOn(date: string, edits: MenuEditsState = menuEditsStore.get()): LiveMenuOverlay {
  const day = parseIsoDay(date);
  const at = day ? day.getTime() + 12 * 3_600_000 : now();
  return computeLive({ state: boStateOf(edits), seed: SEED, idx: tabletIndex(), ruleDefaults: RULE_DEFAULTS, pinSeq, at });
}

/**
 * Work out what the floor sees again when the saved copy is from another day
 * (a tab left open overnight before it noticed, or a copy saved before the
 * overlay kept its day). An order screen calls it when it opens.
 */
export function freshenLiveMenu(): void {
  const edits = menuEditsStore.get();
  if (edits.live?.date === isoDay(new Date(now()))) return;
  const live = liveNow(edits);
  if (JSON.stringify(live) !== JSON.stringify(edits.live)) menuEditsStore.set((p) => ({ ...p, live }));
}

/**
 * Keep what the floor sees up to date in this tab, with nobody editing in
 * Back Office: when a venue's menu or "Week 1 started" changes, after a demo
 * reset, and when the day rolls over (a new cycle day, so new specials, and
 * a scheduled menu that starts today). Writes only when the result differs,
 * so every open tab can run it. Also hands the floor the way to work out a
 * later day's menu (see liveOn). Returns a function that stops it.
 */
export function keepLiveMenu(): () => void {
  let busy = false;
  let day = isoDay(new Date(now()));
  const check = () => {
    if (busy) return;
    busy = true;
    try {
      const edits = menuEditsStore.get();
      const live = liveNow(edits);
      if (JSON.stringify(live) !== JSON.stringify(edits.live)) menuEditsStore.set((p) => ({ ...p, live }));
    } finally {
      busy = false;
    }
  };
  setMenuForDay((date) => liveOn(date));
  check();
  // A venue's schedule can change a later day's menu without changing today's.
  // Only the schedule counts (what schedulesOf reads); other venue settings leave the menus alone.
  let venues = venueSettingsStore.get().venues;
  let schedules = JSON.stringify(schedulesOf(venueSettingsStore.get()));
  const offVenues = venueSettingsStore.subscribe(() => {
    const vs = venueSettingsStore.get();
    if (vs.venues === venues) return;
    venues = vs.venues;
    const next = JSON.stringify(schedulesOf(vs));
    if (next === schedules) return;
    schedules = next;
    check();
    forgetMenusAhead();
  });
  // A reset (or a copy saved before the floor followed each venue) has no rooms yet.
  const offEdits = menuEditsStore.subscribe(() => {
    if (!menuEditsStore.get().live?.rooms) check();
  });
  const timer = setInterval(() => {
    const d = isoDay(new Date(now()));
    if (d === day) return;
    day = d;
    check();
  }, 30_000);
  return () => {
    offVenues();
    offEdits();
    clearInterval(timer);
    setMenuForDay(null);
  };
}

/** Back Office data the floor's menu never reads: a change to only these leaves what the floor sees as it is. */
const OFF_FLOOR: ReadonlySet<string> = new Set<keyof BoState>(['favorites']);

/**
 * Change Back Office's menu data; the floor sees the result at once. What the
 * floor sees keeps its identity when the change doesn't move it (a favourite,
 * a cook's note), so no tab rebuilds its menus for nothing.
 */
export function updateBo(change: (s: BoState) => Partial<BoState>): void {
  let sameLive = false;
  menuEditsStore.set((prev) => {
    const patch = change(boStateOf(prev));
    const next: MenuEditsState = { ...prev, ...patch };
    const keys = Object.keys(patch);
    if (prev.live && keys.length > 0 && keys.every((k) => OFF_FLOOR.has(k))) return next;
    const state = boStateOf(next);
    const live = computeLive({ state, seed: SEED, idx: tabletIndex(), ruleDefaults: RULE_DEFAULTS, pinSeq, at: now() });
    sameLive = !!prev.live && JSON.stringify(live) === JSON.stringify(prev.live);
    return { ...next, live: sameLive ? prev.live : live };
  });
  // Today's menu is the same, but a later day's might not be (a dish placed on another cycle day).
  if (sameLive) forgetMenusAhead();
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
