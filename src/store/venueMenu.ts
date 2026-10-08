/**
 * What a venue serves today, worked out one way for every screen: the
 * server tablet, the 86 list, kiosk, specials display, Production Prep,
 * Back Office Production, the associate menu and printed menus.
 *
 * A venue serves a menu cycle (from its "Week 1 started" Sunday, or a
 * scheduled changeover that has started) and an à la carte choice: an
 * à la carte menu, a cycle's every-day items ("m1:everyday"), or nothing.
 * Today's cycle day is cycleDayOn(start, length, today); the length is the
 * menu's cycle length, or the last day something is placed on when that is
 * later (see cycleLength).
 *
 * Venues are dining rooms as Back Office names them; the floor works by
 * kitchen ("room"). A room's menu is the menu of the first active venue that
 * cooks in it (Sequoia for the Sequoia / Evergreen room).
 */
import { DINING_ROOM, SEED_GRID } from '../data';
import { cycleDayOn, cycleLength, servingAt } from '../domain/menuCycle';
import { now } from '../lib/clock';
import seedMenusJson from '../surfaces/backoffice/menus/seed/menus.json';
import { menuEditsStore, type GridEntry, type MenuEditsState } from './menuEdits';
import { venueSettingsStore, type Venue } from './venueSettings';

/** The room the dining room tablets default to (and whose menu `menu` in src/data is). */
export { DINING_ROOM };

/** Just what working out a venue's day needs from a menu. */
export interface MenuShape {
  id: string;
  kind: string;
  cycleLen: number;
}

/** A venue as far as its menus go (a Venue Settings venue, or Back Office's schedule of it). */
export interface VenueLike {
  id: string;
  name: string;
  room?: string | null;
  active: boolean;
  menuId: string | null;
  menuStartDt: number | null;
  alcMenuId?: string | null;
  upcoming?: Array<{ menuId: string; startDt: number }>;
}

export interface VenueServing {
  venueId: string;
  name: string;
  room: string | null;
  /** The cycle it serves today, or null for none. */
  cycleId: string | null;
  /** Its à la carte choice: an à la carte menu id, "<cycle>:everyday", or null for none. */
  alcId: string | null;
  /** Day 1 of the cycle (ms), when it has one. */
  start: number | null;
  /** Days in the cycle; 0 without one. */
  len: number;
  /** Today's cycle day (1 to len); 0 when it serves no cycle. */
  day: number;
}

const SEED_MENUS = seedMenusJson as unknown as MenuShape[];

/** The menus as Menu Cycle & À la Carte has them: the chef's edits, else the shipped ones. */
export function menusNow(edits: MenuEditsState = menuEditsStore.get()): MenuShape[] {
  return edits.menus ?? SEED_MENUS;
}

/** The menu grid as Menu Cycle & À la Carte has it: the chef's edits, else the shipped one. */
export function gridNow(edits: MenuEditsState = menuEditsStore.get()): GridEntry[] {
  return edits.grid ?? SEED_GRID;
}

const isAlcMenu = (m: MenuShape | undefined) => !!m && (m.kind === 'alc' || !(m.cycleLen > 0));

/** Days in a cycle menu: its set length, or the last day something is placed on when later; 0 for à la carte. */
export function menuLength(menuId: string | null, menus: MenuShape[], grid: GridEntry[]): number {
  if (!menuId) return 0;
  const m = menus.find((x) => x.id === menuId);
  let last = 0;
  for (const g of grid) if (g.menuId === menuId && g.day > last) last = g.day;
  if (!m) return last;
  return cycleLength({ kind: m.kind === 'alc' ? 'alc' : 'cycle', cycleLen: m.cycleLen }, last);
}

/**
 * What a venue serves on a date: the menu its schedule has on that date,
 * its à la carte choice, and the cycle day. An à la carte menu saved as the
 * venue's menu (older saved settings) counts as its à la carte choice.
 */
export function venueServing(v: VenueLike, at: number, menus: MenuShape[], grid: GridEntry[]): VenueServing {
  const s = servingAt({ ...v, upcoming: v.upcoming ?? [] }, at);
  const first = menus.find((m) => m.id === s.menuId);
  const alcFirst = isAlcMenu(first);
  const cycleId = s.menuId && !alcFirst ? s.menuId : null;
  const alcId = alcFirst ? (v.alcMenuId ?? s.menuId) : (v.alcMenuId ?? null);
  const len = cycleId ? menuLength(cycleId, menus, grid) : 0;
  const day = cycleId && len > 0 ? (cycleDayOn(s.start, len, at) ?? 0) : 0;
  return { venueId: v.id, name: v.name, room: v.room ?? null, cycleId, alcId, start: cycleId ? s.start : null, len, day };
}

/** The venue whose menu a room's tablets order from: its first active venue (null when every one is retired). */
export function roomVenue<V extends VenueLike>(room: string, venues: V[]): V | null {
  return venues.find((v) => v.active && v.room === room) ?? null;
}

/** Rooms (kitchens) that still have an active venue: the ones the floor can pick. */
export function activeRooms(roomIds: string[], venues: VenueLike[]): string[] {
  const on = roomIds.filter((r) => venues.some((v) => v.active && v.room === r));
  return on.length ? on : roomIds.slice(0, 1);
}

/** A Venue Settings venue by id. */
export function settingsVenue(venueId: string): Venue | undefined {
  return venueSettingsStore.get().venues.find((x) => x.id === venueId);
}

/**
 * Every recipe the active venues' menus place, once: each cycle's every day
 * (not just this week) and each à la carte choice. Routing and printers use
 * it, so a chef can set up next week's soup or dessert ahead of time.
 */
export function activeMenuRecipes(at: number = now()): Array<{ recipeId: string; cat: string }> {
  const edits = menuEditsStore.get();
  const menus = menusNow(edits);
  const grid = gridNow(edits);
  const lists = new Set<string>();
  const anyDay = new Set<string>();
  for (const v of venueSettingsStore.get().venues) {
    if (!v.active) continue;
    const s = venueServing(v, at, menus, grid);
    if (s.cycleId) lists.add(s.cycleId);
    if (s.alcId) anyDay.add(s.alcId.replace(/:everyday$/, ''));
  }
  const out = new Map<string, string>();
  for (const g of grid) {
    if (g.meal === 'Snacks' || out.has(g.recipeId)) continue;
    if (lists.has(g.menuId) || (anyDay.has(g.menuId) && g.day === 0)) out.set(g.recipeId, g.cat);
  }
  return [...out].map(([recipeId, cat]) => ({ recipeId, cat }));
}
