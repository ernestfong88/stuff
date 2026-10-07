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
import barMenuJson from './seed/barMenu.json';
import venueFeesJson from './seed/venueFees.json';
import deliveryFeesJson from './seed/deliveryFees.json';
import payMethodsJson from './seed/payMethods.json';
import orderTypesJson from './seed/orderTypes.json';
import roomsJson from './seed/rooms.json';
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
export const menu = menuJson as unknown as Menu;
/** Bar and café menu by section (starters, mains, cocktails, bar, fees ...). */
export const barMenu = barMenuJson as unknown as Record<string, MenuItem[]>;
export const modGroups = modGroupsJson as ModGroup[];
/** Modifier prefixes offered on every item: Add, No, Sub, Xtra, Lite, Side. */
export const modPrefixes = modPrefixesJson as string[];
/** Colour per item kind (entree, side, ...). */
export const itemKinds = itemKindsJson as Record<string, { c: string; bg: string }>;
/** How often each modifier was picked, used to rank common choices first. */
export const modDefaults = modDefaultsJson as Record<string, Record<string, number>>;
/** Order in which modifier groups are asked for an item. */
export const pinSeq = pinSeqJson as Record<string, string[]>;

/** Every menu item, flattened, with the meal and category it sits under. */
export const catalog: CatalogItem[] = Object.entries(menu).flatMap(([meal, cats]) =>
  Object.entries(cats).flatMap(([category, items]) =>
    items.map((it) => ({ ...it, meal: meal as MealName, category })),
  ),
);
const catalogById = new Map<string, CatalogItem>();
for (const it of catalog) if (!catalogById.has(it.id)) catalogById.set(it.id, it);

export const getItem = (id: string | null | undefined) => (id ? catalogById.get(id) : undefined);

// ─── Venues & money ──────────────────────────────────────────────────────

export const rooms = roomsJson as Record<string, Room>;
export const allTables = Object.entries(rooms).flatMap(([roomId, r]) => r.tables.map((t) => ({ ...t, room: roomId })));
export const getTable = (id: string | null | undefined) => allTables.find((t) => t.id === id);

/** Pick up / delivery fee per venue. */
export const venueFees = venueFeesJson as Record<string, { pickup: number; delivery: number }>;
export const deliveryFees = deliveryFeesJson as Array<{ id: string; text: string; amt: number; isDefault?: boolean }>;
export const payMethods = payMethodsJson as Array<{ id: string; label: string }>;
export const orderTypes = orderTypesJson as Array<{ id: string; label: string }>;

// ─── Live seeds (times relative to the demo clock) ───────────────────────

/** Open checks and queued pick up / delivery orders at the start of the demo. */
export const seedOrders = (): Order[] => revive(ordersJson as unknown as Order[]);
/** Orders closed earlier today. */
export const seedHistory = (): Order[] => revive(historyJson as unknown as Order[]);
export const seedAssocMeals = (): AssocMeal[] => revive(assocMealsJson as unknown as AssocMeal[]);
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
