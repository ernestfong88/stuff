/**
 * Back Office edits to the menu: recipes, menu cycles, à la carte menus,
 * modifier groups and prices, persisted and shared across tabs.
 *
 * Two parts:
 *
 * - The Back Office working copy (`recipes`, `grid`, `menus` ...). A key
 *   that is missing means "still the seed"; Back Office merges it with its
 *   seed (src/surfaces/backoffice/menus/data.ts).
 * - `live`: what the floor sees, as the difference from the tablet menu that
 *   ships in src/data. Back Office recomputes it on every edit, and
 *   src/data applies it to `menu`, `catalog`, `getItem`, `modGroups` and
 *   `modifierRules`, so servers, the kitchen and the kiosk pick up a rename,
 *   a price or an Any Day change at once, in every open tab.
 *
 * This module imports nothing from src/data (src/data imports it).
 */
import type { MealName, MenuItem, ModGroup } from '../domain/types';
import { createSharedStore, useShared } from '../lib/sharedStore';

// ─── Back Office working copy ────────────────────────────────────────────

export type RecipeCategory = 'Drinks' | 'Starters' | 'Entrees' | 'Sides' | 'Desserts' | 'Snacks';

/** Who cooks it: the cook line (KDS) or the server at the pass (expo). */
export type RecipeRoute = 'kds' | 'expo';

export interface Ingredient {
  qty: number;
  unit: string;
  name: string;
}

export interface Nutrition {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sodium?: number;
  fiber?: number;
  calcium?: number;
}

/** Seasonal and holiday tags the menu review reads. */
export interface RecipeTags {
  summer?: boolean;
  holiday?: string;
  week?: number;
}

export interface Recipe {
  /** For dishes on the tablet menu, the id of its first tablet item. */
  id: string;
  name: string;
  cat: RecipeCategory;
  /** Subcategory within the category ("Plates", "Soup" ...). */
  sub?: string;
  /** Entrée protein: chicken, turkey, beef, pork, lamb, fish, shellfish, egg, veg, other. */
  protein?: string;
  /** Protein group for menu balance (fish and shellfish count as seafood). */
  balance?: string;
  desc: string;
  /** What the printed menu and the kiosk say; falls back to desc. */
  menuDescriptor?: string;
  /** Built-in short name for servers and tickets, when it has one. */
  shortDefault?: string;
  cookNotes?: string;
  route?: RecipeRoute;
  servingDesc?: string;
  servingSize?: string;
  variations?: string;
  garnish?: string;
  prepMin?: number;
  cookMin?: number;
  baseServings?: number;
  ingredients?: Ingredient[];
  method?: string[];
  plating?: string[];
  equipment?: string[];
  nutrition?: Nutrition;
  /** Milk, Egg, Fish, Shellfish, Tree nuts, Peanuts, Wheat, Soy, Sesame. */
  allergens?: string[];
  dietFlags?: string[];
  /** "Don't forget" items Expo and the server see, like a steak knife. */
  reminders?: string[];
  /** A rotating special (not an everyday dish). */
  special?: boolean;
  /** A fee or placeholder line rather than a dish. */
  placeholder?: boolean;
  retired?: boolean;
  /** mine: the community owns it; linked: follows a Home Office recipe; global: Home Office's own. */
  scope?: 'mine' | 'linked' | 'global';
  globalId?: string;
  tags?: RecipeTags;
  /** Meals a special suits: "L", "D" or "LD". */
  meals?: string;
  /** Orders when it last ran (seeded from P-Mix). */
  sales?: { orders: number; per: number; src: string };
  /** Guest price for a recipe created in Back Office. */
  price?: number;
  /** Parts of the recipe AI drafted and a chef has not reviewed yet. */
  aiDrafted?: string[];
  importedFrom?: 'photo' | 'text';
  submittedToHO?: number;
  photo?: string;
}

/** One recipe placed on a menu: a cycle day (0 = every day) and a meal. */
export interface GridEntry {
  id: string;
  menuId: string;
  recipeId: string;
  /** Cycle day, 1 based; 0 = Any Day (every day). */
  day: number;
  meal: MealName | 'Snacks';
  cat: RecipeCategory;
  sort: number;
  /** For a side: the entrée placement it goes with. */
  with?: string;
}

export type MenuKind = 'cycle' | 'alc';

export interface BoMenu {
  id: string;
  name: string;
  kind: MenuKind;
  /** "Q4 2026", or "Year-round". */
  quarter: string;
  /** Length of the cycle in days (a multiple of 7); 0 for à la carte. */
  cycleLen: number;
  /** Draft, active or archived as set by hand; see menuState() for the shown state. */
  status: 'draft' | 'active' | 'archived';
  /** Day 1 of the cycle, when the builder moved the dates (ms). */
  startDt?: number;
  editedBy?: string;
  editedAt?: number;
  locked?: boolean;
  signedBy?: string | null;
  signedAt?: number | null;
  approveReq?: boolean;
  approval?: string;
  fav?: boolean;
  /** Default rows (starters, entree, desserts) the menu builder leaves off a meal, by meal. */
  hiddenLanes?: Record<string, string[]>;
}

/** Which menu a venue serves, from when, and what comes next. */
export interface VenueSchedule {
  id: string;
  name: string;
  /** Kitchen (a key of rooms) the venue cooks in; its tables order from this venue's menu. */
  room?: string | null;
  menuId: string | null;
  /** Day 1 of the cycle at this venue (ms). */
  menuStartDt: number | null;
  /** The à la carte menu it serves. */
  alcMenuId?: string | null;
  active: boolean;
  upcoming?: Array<{ menuId: string; startDt: number }>;
}

export interface BoModOption {
  n: string;
  /** Up-charge; missing means included. */
  price?: number;
}

export interface BoModGroup {
  id: string;
  name: string;
  active: boolean;
  /** Times used in the last 90 days. */
  usage90: number;
  /** Recipe ids it is pinned to (asked first when they are ordered). */
  pinned: string[];
  mods: BoModOption[];
}

/** Ordering rules for a modifier group, as Back Office edits them. */
export interface ModRuleEdit {
  req?: boolean;
  min?: number;
  max?: number;
  incl?: number | null;
  extra?: number;
  ask?: string;
  lbl?: string;
}

/** A price override for a recipe at a venue; null fields keep the menu price. */
export interface PriceRow {
  recipeId: string;
  venueId: string;
  res: number | null;
  guest: number | null;
  ala: number | null;
}

/** Default sides chosen for a placement: menu → day → entrée recipe → side recipe ids. */
export type SideOverrides = Record<string, Record<string, Record<string, string[]>>>;

export interface BoMenuEdits {
  recipes?: Recipe[];
  grid?: GridEntry[];
  menus?: BoMenu[];
  modGroups?: BoModGroup[];
  modRules?: Record<string, ModRuleEdit>;
  prices?: PriceRow[];
  sides?: SideOverrides;
  /** Starred recipes, by id. */
  favorites?: Record<string, true>;
}

// ─── What the floor sees ────────────────────────────────────────────────

/** Item fields Back Office can change on the tablet menu. */
export type LiveItemPatch = Partial<
  Pick<
    MenuItem,
    'name' | 'desc' | 'residentPrice' | 'guestPrice' | 'alaPrice' | 'day' | 'allergens' | 'cookNotes' | 'etype' | 'route' | 'defaultSideIds' | 'special'
  >
>;

export interface LiveRuledGroup {
  name: string;
  options: Array<{ name: string; price?: number }>;
  rule: { required: boolean; min: number; max: number; included: number | null; extra: number; ask: string; label: string };
}

export interface LiveMenuOverlay {
  /** Changes to tablet items, by item id. */
  items: Record<string, LiveItemPatch>;
  /** Items Back Office put on the menu, by meal and tablet category. */
  added: Array<{ meal: MealName; category: string; item: MenuItem }>;
  /** Tablet items taken off every meal (moved to Snacks). */
  removed: string[];
  /** "Don't forget" reminders by tablet item id. */
  reminders: Record<string, string[]>;
  /** Replaces the seed modifier groups once Back Office edits them. */
  modGroups?: ModGroup[];
  /** Replaces the seed modifier rules once Back Office edits them. */
  modifierRules?: { groups: Record<string, LiveRuledGroup>; items: Record<string, string[]> };
  /**
   * Today's cycle day in the dining room (DINING_ROOM): `items` and `added`
   * put today's specials on it. 0 when the room serves no cycle; missing in an
   * overlay saved before the floor followed the venue's cycle.
   */
  day?: number;
  /**
   * The other rooms (kitchens): each orders from its own venue's menu at its
   * own prices. A room not listed uses the dining room's menu.
   */
  rooms?: Record<string, LiveRoomMenu>;
}

/** One room's menu as the difference from the tablet menu (recipe edits included). */
export interface LiveRoomMenu {
  /** The venue whose menu and prices the room's tablets use. */
  venueId: string;
  /** Today's cycle day at that venue; 0 without a cycle. */
  day: number;
  items: Record<string, LiveItemPatch>;
  added: Array<{ meal: MealName; category: string; item: MenuItem }>;
}

export const EMPTY_OVERLAY: LiveMenuOverlay = { items: {}, added: [], removed: [], reminders: {} };

export interface MenuEditsState extends BoMenuEdits {
  live: LiveMenuOverlay;
}

export const menuEditsStore = createSharedStore<MenuEditsState>(() => ({ live: EMPTY_OVERLAY }), {
  persistKey: 'kisco.menuEdits.v1',
  channel: 'kisco-menu-edits',
});

/** Read the edits in a component. */
export function useMenuEdits(): MenuEditsState {
  return useShared(menuEditsStore);
}

/** The overlay the floor applies (always defined, even for an old saved copy). */
export function liveOverlay(state: MenuEditsState = menuEditsStore.get()): LiveMenuOverlay {
  return state.live ?? EMPTY_OVERLAY;
}

/** "Don't forget" reminders for a tablet item (steak knife, extra lemon). */
export function itemReminders(itemId: string, state: MenuEditsState = menuEditsStore.get()): string[] {
  return liveOverlay(state).reminders[itemId] ?? [];
}

/** Reminders for an item, re-rendering when Back Office changes them. */
export function useItemReminders(itemId: string): string[] {
  return useShared(menuEditsStore, (s) => liveOverlay(s).reminders[itemId] ?? NONE);
}
const NONE: string[] = [];
