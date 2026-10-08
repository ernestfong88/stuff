/**
 * Seed data for the demo community (Valencia Terrace).
 *
 * Everything here was extracted from the original mockup. In production these
 * come from the KiscoConnect API; keep components reading through this module
 * (or the stores built on it) so the source can be swapped in one place.
 */
import type {
  Associate,
  AssocMeal,
  Broadcast,
  CatalogItem,
  MealName,
  MealPlan,
  Menu,
  MenuItem,
  ModGroup,
  Order,
  Resident,
  ResidentNote,
  Room,
  StaffMember,
} from '../domain/types';
import { useSyncExternalStore } from 'react';
import { today } from '../lib/clock';
import { SEED_TODAY, seedShift, shiftDay } from '../domain/menuCycle';
import { liveOverlay, menuEditsStore, type GridEntry, type LiveMenuOverlay } from '../store/menuEdits';
import { revive } from './revive';

import residentsJson from './seed/residents.json';
import mealPlansJson from './seed/mealPlans.json';
import avatarColorsJson from './seed/avatarColors.json';
import associatesJson from './seed/associates.json';
import staffJson from './seed/staff.json';
import serverColorsJson from './seed/serverColors.json';
import mealsJson from './seed/meals.json';
import modGroupsJson from './seed/modGroups.json';
import modPrefixesJson from './seed/modPrefixes.json';
import itemKindsJson from './seed/itemKinds.json';
import modDefaultsJson from './seed/modDefaults.json';
import pinSeqJson from './seed/pinSeq.json';
import menuJson from './seed/menu.json';
import gridSeedJson from './seed/menuGrid.json';
import barMenuJson from './seed/barMenu.json';
import venueFeesJson from './seed/venueFees.json';
import deliveryFeesJson from './seed/deliveryFees.json';
import payMethodsJson from './seed/payMethods.json';
import orderTypesJson from './seed/orderTypes.json';
import roomsJson from './seed/rooms.json';
import { savedTable } from '../store/layoutStore';
import ordersJson from './seed/orders.json';
import historyJson from './seed/history.json';
import assocMealsJson from './seed/assocMeals.json';
import broadcastsJson from './seed/broadcasts.json';
import boResidentsJson from './seed/boResidents.json';
import modifierRulesJson from './seed/modifierRules.json';
import residentNotesJson from './seed/residentNotes.json';
import pickupPromisesJson from './seed/pickupPromises.json';

export const COMMUNITY_NAME = 'Valencia Terrace';

// ─── People ──────────────────────────────────────────────────────────────

export const residents = residentsJson as Resident[];
export const mealPlans = mealPlansJson as Record<string, MealPlan>;
/** Avatar gradient [from, to] keyed by the resident's photo initials. */
export const avatarColors = avatarColorsJson as unknown as Record<string, [string, string]>;
export const associates = associatesJson as Associate[];
export const staff = staffJson as StaffMember[];
/** Fixed colour for each server's checks on floor plans. */
export const serverColors = serverColorsJson as Record<string, string>;
/** Back office resident records (billing, plan start, kitchen notes). */
export const boResidents = boResidentsJson as Array<Record<string, unknown> & { id: string; name: string }>;

const residentById = new Map(residents.map((r) => [r.id, r]));
const associateById = new Map(associates.map((a) => [a.id, a]));

export const getResident = (id: string | null | undefined) => (id ? residentById.get(id) : undefined);
export const getAssociate = (id: string | null | undefined) => (id ? associateById.get(id) : undefined);
export const getStaff = (idOrInitials: string | null | undefined) =>
  staff.find((s) => s.id === idOrInitials || s.initials === idOrInitials);

// ─── Menu ────────────────────────────────────────────────────────────────

export const meals = mealsJson as Array<{ id: MealName; time: string }>;
/** The seeded menu cycle's length, for turning its days (see SEED_TODAY in domain/menuCycle). */
const SEED_CYCLE_LEN = 35;
/** Menus whose seeded days are written with today as day 15: the cycle the seeded venues serve. */
export const TURNED_MENUS: Record<string, number> = { m1: SEED_CYCLE_LEN };

/** The Back Office menu grid as it ships, with the served cycle turned so today's specials are on today. */
export const SEED_GRID: GridEntry[] = (gridSeedJson as unknown as GridEntry[]).map((g) => {
  const shift = seedShift(today().getTime());
  return shift && TURNED_MENUS[g.menuId] ? { ...g, day: shiftDay(g.day, shift, TURNED_MENUS[g.menuId]) } : g;
});
/** The tablet menu as it ships, every item of every day; today's seeded specials sit on today's cycle day. */
const shippedMenu = turnSeedDays(menuJson as unknown as Menu, seedShift(today().getTime()));
/** Today's cycle day as the seed is written (see SEED_TODAY), until Back Office works out each venue's. */
export const SEED_MENU_DAY = shiftDay(SEED_TODAY, seedShift(today().getTime()), SEED_CYCLE_LEN);
/** The room (kitchen) whose menu `menu` is: Sequoia / Evergreen. Other rooms: menuFor(room). */
export const DINING_ROOM = 'sequoia';
/**
 * Today's menu in the dining room: the every-day items and today's specials
 * of the venue it belongs to, after Back Office edits (see applyMenuEdits).
 * Dishes on other days, or taken off, are not listed; they stay in `catalog`
 * so a check that has them still names and prices them.
 */
export const menu = { Breakfast: {}, Lunch: {}, Dinner: {} } as Menu;

function turnSeedDays(m: Menu, shift: number): Menu {
  if (!shift) return m;
  return Object.fromEntries(
    Object.entries(m).map(([meal, cats]) => [
      meal,
      Object.fromEntries(Object.entries(cats).map(([cat, items]) => [cat, items.map((it) => (it.day > 0 ? { ...it, day: shiftDay(it.day, shift, SEED_CYCLE_LEN) } : it))])),
    ]),
  ) as Menu;
}
/** The tablet menu as it ships, before Back Office edits (see applyMenuEdits). */
export const baseMenu: Menu = structuredClone(shippedMenu);
/** Bar and café menu by section (starters, mains, cocktails, bar, fees ...). */
export const barMenu = barMenuJson as unknown as Record<string, MenuItem[]>;
export const modGroups = modGroupsJson as ModGroup[];
const baseModGroups: ModGroup[] = structuredClone(modGroups);
/** Modifier prefixes offered on every item: Add, No, Sub, Xtra, Lite, Side. */
export const modPrefixes = modPrefixesJson as string[];
/** Colour per item kind (entree, side, ...). */
export const itemKinds = itemKindsJson as Record<string, { c: string; bg: string }>;
/** How often each modifier was picked, used to rank common choices first. */
export const modDefaults = modDefaultsJson as Record<string, Record<string, number>>;
/** Order in which modifier groups are asked for an item. */
export const pinSeq = pinSeqJson as Record<string, string[]>;

/** Every menu item (every day's, and those taken off), flattened, with the meal and category it sits under. */
export const catalog: CatalogItem[] = Object.entries(shippedMenu).flatMap(([meal, cats]) =>
  Object.entries(cats).flatMap(([category, items]) =>
    items.map((it) => ({ ...it, meal: meal as MealName, category })),
  ),
);
const catalogById = new Map<string, CatalogItem>();
function indexCatalog() {
  catalogById.clear();
  for (const it of catalog) if (!catalogById.has(it.id)) catalogById.set(it.id, it);
}
indexCatalog();

/**
 * Dishes that can be ordered without being on a meal's menu: the associate
 * menu's standing choices (a sandwich of the month that the dining room
 * doesn't serve). They are in the catalog, so tickets and checks name them,
 * but on no menu tab.
 */
const extraItems = new Map<string, CatalogItem>();
export function ensureItems(items: CatalogItem[]): void {
  for (const it of items) {
    if (catalogById.has(it.id)) continue;
    extraItems.set(it.id, it);
    catalog.push(it);
    catalogById.set(it.id, it);
  }
}

export const getItem = (id: string | null | undefined) => (id ? catalogById.get(id) : undefined);

// ─── Venues & money ──────────────────────────────────────────────────────

export const rooms = roomsJson as Record<string, Room>;
export const allTables = Object.entries(rooms).flatMap(([roomId, r]) => r.tables.map((t) => ({ ...t, room: roomId })));
/**
 * __kGetTable: a table by id. A table added, renamed or moved in Back Office
 * Floor Plans comes from the saved layout, so every screen shows its name.
 */
export const getTable = (id: string | null | undefined) => (id ? (savedTable(id) ?? allTables.find((t) => t.id === id)) : undefined);

/** Pick up / delivery fee per venue. */
export const venueFees = venueFeesJson as Record<string, { pickup: number; delivery: number }>;
export const deliveryFees = deliveryFeesJson as Array<{ id: string; text: string; amt: number; isDefault?: boolean }>;
export const payMethods = payMethodsJson as Array<{ id: string; label: string }>;
export const orderTypes = orderTypesJson as Array<{ id: string; label: string }>;

// ─── Live seeds (times relative to the demo clock) ───────────────────────

/** Open checks and queued pick up / delivery orders at the start of the demo. */
export const seedOrders = (): Order[] =>
  revive(ordersJson as unknown as Order[]).map((o) => {
    // Checks outside the dining room ring up at their own venue's prices (see OrderLine.room).
    const room = priceRoom(o);
    return room === DINING_ROOM ? o : { ...o, diners: o.diners.map((d) => ({ ...d, items: d.items.map((l) => ({ ...l, room })) })) };
  });
/** Orders closed earlier today. */
export const seedHistory = (): Order[] => revive(historyJson as unknown as Order[]);
/** The calendar day the associate meal seeds were written for; dates are shifted onto the demo's today. */
const ASSOC_SEED_DAY = '2026-10-07';

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const seedAssocMeals = (): AssocMeal[] => {
  const t = today();
  const todayIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  const offset = Math.round((new Date(todayIso + 'T12:00:00').getTime() - new Date(ASSOC_SEED_DAY + 'T12:00:00').getTime()) / 86_400_000);
  return revive(assocMealsJson as unknown as AssocMeal[]).map((m) => ({ ...m, date: shiftIsoDate(m.date, offset) }));
};
export const seedBroadcasts = (): Broadcast[] => revive(broadcastsJson as unknown as Broadcast[]);

// ─── Modifier ordering rules ─────────────────────────────────────────────

export interface ModifierRule {
  required: boolean;
  min: number;
  /** 0 = no limit. */
  max: number;
  /** Picks included before the per-pick charge starts; null when not set (counts as 0). */
  included: number | null;
  /** Charge per pick past the included ones. */
  extra: number;
  ask: string;
  label: string;
}

export interface RuledModifierGroup {
  name: string;
  options: Array<{ name: string; price?: number }>;
  rule: ModifierRule;
}

/**
 * Modifier groups that carry ordering rules (required, pick limits, priced
 * options), and which items they are pinned to. Extracted from the
 * prototype's pinned modifier groups with their default rules.
 */
export const modifierRules = modifierRulesJson as {
  groups: Record<string, RuledModifierGroup>;
  items: Record<string, string[]>;
};
const baseModifierRules: typeof modifierRules = structuredClone(modifierRules);

// ─── Resident notes ──────────────────────────────────────────────────────

/** Notes servers added about residents earlier today, newest added first. */
export const seedResidentNotes = (): ResidentNote[] => revive(residentNotesJson as unknown as ResidentNote[]);

// ─── Pick up / delivery promised times ───────────────────────────────────

/**
 * Minutes from "now" to each seeded pick up / delivery promise. The seed's
 * readyAt labels ("4:15 PM") were written on the wall clock when they were
 * extracted, so the dining store re-derives them from these offsets on the
 * demo clock (see seedDiningState).
 */
export const pickupPromiseOffsets = pickupPromisesJson as Record<string, number>;

// ─── Back Office menu edits ──────────────────────────────────────────────

/*
 * Back Office edits the menu (renames, prices, what is on each meal's
 * everyday list, modifier groups) and stores the difference from the menu
 * above in src/store/menuEdits. It is applied here, in place, so `menu`,
 * `catalog`, `getItem`, `modGroups` and `modifierRules` keep their shape
 * and every surface sees the edit without changing how it reads the menu.
 * A component that lists the menu can re-render on a change with
 * useMenuVersion().
 */
let menuVersionNo = 0;
let appliedOverlay: LiveMenuOverlay | null = null;
const menuListeners = new Set<() => void>();

function replaceContents<T extends object>(target: T, source: T) {
  for (const k of Object.keys(target)) delete (target as Record<string, unknown>)[k];
  Object.assign(target, source);
}

/** Each room's whole menu after Back Office edits: every day's items, those taken off at day -1. */
const roomFull: Record<string, Menu> = {};
/** Today's menu per room; the dining room's is `menu`. */
const roomToday: Record<string, Menu> = { [DINING_ROOM]: menu };
const roomDay: Record<string, number> = {};
const roomItems: Record<string, Map<string, CatalogItem>> = {};

/** Served today: every day (day 0), or on today's cycle day. */
const servedOn = (it: Pick<MenuItem, 'day'>, day: number) => it.day == null || it.day === 0 || (day > 0 && it.day === day);

function buildMenu(items: LiveMenuOverlay['items'], added: LiveMenuOverlay['added'], removed: Set<string>): Menu {
  const out = {} as Menu;
  for (const [meal, cats] of Object.entries(baseMenu) as Array<[MealName, Record<string, MenuItem[]>]>) {
    const next: Record<string, MenuItem[]> = {};
    for (const [category, list] of Object.entries(cats)) {
      next[category] = list.filter((it) => !removed.has(it.id)).map((it) => (items[it.id] ? { ...it, ...items[it.id] } : it));
    }
    for (const a of added) if (a.meal === meal) (next[a.category] ??= []).push(a.item);
    out[meal] = next;
  }
  return out;
}

const flatten = (m: Menu): CatalogItem[] =>
  (Object.entries(m) as Array<[MealName, Record<string, MenuItem[]>]>).flatMap(([meal, cats]) =>
    Object.entries(cats).flatMap(([category, items]) => items.map((it) => ({ ...it, meal, category }))),
  );

function applyMenuEdits(o: LiveMenuOverlay) {
  const removed = new Set(o.removed);
  for (const room of Object.keys(roomsJson)) {
    const own = room === DINING_ROOM ? undefined : o.rooms?.[room];
    const full = buildMenu(own?.items ?? o.items, own?.added ?? o.added, removed);
    const day = (own ? own.day : o.day) ?? SEED_MENU_DAY;
    roomFull[room] = full;
    roomDay[room] = day;
    const today = {} as Menu;
    for (const [meal, cats] of Object.entries(full) as Array<[MealName, Record<string, MenuItem[]>]>) {
      // A section with nothing on it today is left out, so no empty tab shows.
      today[meal] = Object.fromEntries(
        Object.entries(cats)
          .map(([c, list]) => [c, list.filter((it) => servedOn(it, day))] as const)
          .filter(([, list]) => list.length > 0),
      );
    }
    if (room === DINING_ROOM) for (const meal of Object.keys(today) as MealName[]) replaceContents((menu[meal] ??= {}), today[meal]);
    else roomToday[room] = today;
    const byId = new Map<string, CatalogItem>();
    for (const it of flatten(full)) if (!byId.has(it.id)) byId.set(it.id, it);
    roomItems[room] = byId;
  }
  catalog.length = 0;
  catalog.push(...flatten(roomFull[DINING_ROOM]));
  const known = new Set(catalog.map((x) => x.id));
  for (const room of Object.keys(roomFull)) {
    if (room === DINING_ROOM) continue;
    for (const it of flatten(roomFull[room])) {
      if (known.has(it.id)) continue;
      known.add(it.id);
      catalog.push(it);
    }
  }
  for (const it of extraItems.values()) if (!known.has(it.id)) catalog.push(it);
  indexCatalog();
  todayCache.clear();
  modGroups.splice(0, modGroups.length, ...(o.modGroups ?? baseModGroups));
  const rules = o.modifierRules ?? baseModifierRules;
  replaceContents(modifierRules.groups, rules.groups);
  replaceContents(modifierRules.items, rules.items);
}

/** Today's menu in a room (kitchen): what its tablets order from. The dining room's when the room is unknown. */
export function menuFor(room?: string | null): Menu {
  return (room && roomToday[room]) || menu;
}

/** Today's cycle day in a room; 0 when its venue serves no menu cycle. */
export function menuDayOf(room?: string | null): number {
  return roomDay[room ?? DINING_ROOM] ?? roomDay[DINING_ROOM] ?? SEED_MENU_DAY;
}

/** An item as a room's menu has it (that venue's prices), else as getItem has it. */
export function itemIn(id: string | null | undefined, room?: string | null): CatalogItem | undefined {
  if (!id) return undefined;
  return (room ? roomItems[room]?.get(id) : undefined) ?? getItem(id);
}

/** The item behind a check line, as the menu it was ordered from prices it (see OrderLine.room). */
export function lineItem(line: { itemId: string; room?: unknown }): CatalogItem | undefined {
  return itemIn(line.itemId, typeof line.room === 'string' ? line.room : undefined);
}

/** The room whose menu and prices a check orders from: where its table is, else (pick up, delivery) its venue. */
export function priceRoom(o: { tableId?: string; room?: string }): string {
  return getTable(o.tableId)?.room ?? o.room ?? DINING_ROOM;
}

const todayCache = new Map<string, CatalogItem[]>();
/** Today's items in a room, flattened with their meal and category (an item on several meals is listed on each). */
export function todayCatalog(room?: string | null): CatalogItem[] {
  const key = room && roomToday[room] ? room : DINING_ROOM;
  let list = todayCache.get(key);
  if (!list) todayCache.set(key, (list = flatten(menuFor(key))));
  return list;
}

function syncMenuEdits() {
  const o = liveOverlay(menuEditsStore.get());
  if (o === appliedOverlay) return;
  appliedOverlay = o;
  applyMenuEdits(o);
  menuVersionNo++;
  menuListeners.forEach((l) => l());
}
syncMenuEdits();
menuEditsStore.subscribe(syncMenuEdits);

/** Called after Back Office menu edits are applied to the menu. */
export function subscribeMenu(listener: () => void): () => void {
  menuListeners.add(listener);
  return () => menuListeners.delete(listener);
}

/** Increases each time Back Office menu edits are applied. */
export function menuVersion(): number {
  return menuVersionNo;
}

/** Re-render a component when Back Office changes the menu; returns the version. */
export function useMenuVersion(): number {
  return useSyncExternalStore(subscribeMenu, menuVersion, menuVersion);
}
