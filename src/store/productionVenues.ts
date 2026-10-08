/**
 * The production venues and what each one's menu cycle places on a date.
 *
 * Kept apart from the production plan (src/store/production) so the
 * associate menu, which every screen reads, can ask for a day's cycle
 * dishes without loading the plan's seed (swap lists, scaled recipes).
 */
import { now } from '../lib/clock';
import { menuEditsStore } from './menuEdits';
import { recipeInfo } from './recipes';
import { gridNow, menusNow, settingsVenue, venueServing } from './venueMenu';

export type PrepMeal = 'Breakfast' | 'Lunch' | 'Dinner';
export type MenuKind = 'cycle' | 'fixed';

export interface ProductionVenue {
  id: string;
  /** Short name for tabs: "Sequoia". */
  name: string;
  /** The venue's name in Venue Settings (getProductionVenue reads it live). */
  fullName: string;
  /** "cycle": a rotating menu with daily specials; "fixed": the same menu every day (getProductionVenue reads it live). */
  menu: MenuKind;
  /** The venue in Venue Settings: its schedule, menus and name are looked up by this id, never by name. */
  venueId: string;
  /** The always-available dishes it starts from in the seed. */
  seedMenu: MenuKind;
}

export interface ProductionRow {
  id: string;
  kind: 'special' | 'anyDay';
  meal: PrepMeal;
  name: string;
  /** Menu category for cycle items, "Any Day" for the always-available ones. */
  category: string;
  /** Entrées also get an associate count. */
  entree: boolean;
  recommended: number;
  basis: string;
  /** "portions", "sandwich setups" ... for always-available items. */
  unit?: string;
  /** Recipe Book id of a cycle item. */
  recipeId?: string;
}

export const PRODUCTION_VENUES: ProductionVenue[] = [
  { id: 'sequoia', name: 'Sequoia', fullName: 'Sequoia Dining Room', menu: 'cycle', venueId: 'v1', seedMenu: 'cycle' },
  { id: 'evergreen', name: 'Evergreen', fullName: 'Evergreen Dining Room', menu: 'cycle', venueId: 'v2', seedMenu: 'cycle' },
  { id: 'bistro', name: 'The Bistro', fullName: 'The Bistro', menu: 'fixed', venueId: 'v3', seedMenu: 'fixed' },
];

/** What a production venue's Venue Settings venue serves on a date (its schedule, cycle and cycle day). */
function servingOn(pv: ProductionVenue, at: number) {
  const v = settingsVenue(pv.venueId);
  if (!v) return null;
  const edits = menuEditsStore.get();
  return venueServing(v, at, menusNow(edits), gridNow(edits));
}

/**
 * A production venue with its name and kind of menu as Venue Settings has
 * them now: renaming a venue, or giving it a cycle (or none), shows here.
 */
export function getProductionVenue(id: string | null | undefined): ProductionVenue {
  const pv = PRODUCTION_VENUES.find((v) => v.id === id) ?? PRODUCTION_VENUES[0];
  const v = settingsVenue(pv.venueId);
  if (!v) return pv;
  return { ...pv, fullName: v.name.trim() || pv.fullName, menu: servingOn(pv, now())?.cycleId ? 'cycle' : 'fixed' };
}

/** Small stable hash, so seed marks look scattered but never change between renders. */
export function seedHash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h;
}

/** A recipe's name as the Recipe Book has it now. */
const nameOf = (id: string) => recipeInfo(id, menuEditsStore.get())?.name;

/**
 * The cycle items a venue serves on a date, with a recommendation from past
 * runs: the venue's scheduled menu on that date (Venue Settings, found by
 * the venue's id), its cycle day (venueServing, as every screen works it
 * out), and what Menu Cycle places on that day. Two entrées in a meal split
 * the room, so each is recommended at 85%.
 */
export function cycleRows(venue: ProductionVenue, date: Date): { cycleDay: number; rows: ProductionRow[] } {
  const serve = servingOn(venue, date.getTime());
  if (!serve?.cycleId || !serve.day) return { cycleDay: 0, rows: [] };
  const cycleDay = serve.day;
  const placed = gridNow().filter((g) => g.menuId === serve.cycleId && g.day > 0);
  const today = placed.filter((g) => g.day === cycleDay && g.meal !== 'Snacks' && g.cat !== 'Drinks');
  const rows: ProductionRow[] = [];
  for (const g of today) {
    const name = nameOf(g.recipeId);
    if (!name) continue;
    const meal = g.meal as PrepMeal;
    const entree = g.cat === 'Entrees';
    const paired = today.filter((x) => x.meal === g.meal && x.cat === 'Entrees').length > 1;
    const base = 28 + (seedHash(`${g.recipeId}:${g.day}`) % 18);
    const recommended = entree ? (paired ? Math.round(base * 0.85) : base) : 24 + (seedHash(`${g.recipeId}:x${g.day}`) % 14);
    rows.push({
      id: g.id,
      kind: 'special',
      meal,
      name,
      recipeId: g.recipeId,
      category: g.cat,
      entree,
      recommended,
      basis: (entree ? (paired ? 'paired special · ' : 'solo special · ') : '') + `last runs ${recommended - 3} to ${recommended + 2}`,
    });
  }
  return { cycleDay, rows };
}

/**
 * The entrée specials on a venue's menu cycle for a date ("YYYY-MM-DD") and
 * meal, in menu order: what the chef can offer associates that day.
 */
export function cycleEntrees(venueId: string, iso: string, meal: PrepMeal): Array<{ recipeId: string; name: string }> {
  return cycleItems(venueId, iso, meal)
    .filter((r) => r.category === 'Entrees')
    .map(({ recipeId, name }) => ({ recipeId, name }));
}

/** Everything a venue's menu cycle places on a date ("YYYY-MM-DD") for a meal, in menu order, with its menu category. */
export function cycleItems(venueId: string, iso: string, meal: PrepMeal): Array<{ recipeId: string; name: string; category: string }> {
  const venue = getProductionVenue(venueId);
  const [y, m, d] = iso.split('-').map(Number);
  return cycleRows(venue, new Date(y, m - 1, d))
    .rows.filter((r) => r.meal === meal && r.recipeId)
    .map((r) => ({ recipeId: r.recipeId!, name: r.name, category: r.category }));
}
