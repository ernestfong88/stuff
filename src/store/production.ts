/**
 * Production plan: what each kitchen venue makes, and what Production Prep
 * has done about it.
 *
 * The Culinary Director sets how many of each special to make (Back Office
 * Production, or the Manager specials view), may swap a special for another
 * recipe of the same kind, and keeps each venue's prep checklist. Production
 * Prep reads all of it, marks specials prepped, leaves progress notes on a
 * special and checks off the checklist. The back office dashboard and the
 * Specials Display read the same plan. Everything is kept per venue, service
 * date ("YYYY-MM-DD") and meal, so tomorrow starts fresh.
 *
 * ── Reading (pure; pass the state from useProduction()) ──────────────────
 *   PRODUCTION_VENUES, PREP_MEALS, SPECIAL_KIND_LABEL, getProductionVenue(id)
 *   specialsFor(state, venueId, dayOffset, meal) → PrepSpecial[]   (dayOffset 0 or 1)
 *   specialAmount(state, venueId, iso, meal, special) → SpecialAmount   (set amount or forecast)
 *   specialForecast(special, meal) → number
 *   preppedMark(state, venueId, iso, meal, slot) → Stamp | null
 *   prepNotes(state, venueId, iso, meal, name) → PrepNote[]        (newest first)
 *   checklistFor(state, venueId) → ChecklistGroup[]   (+ isChecklistEdited)
 *   checklistForMeal(state, venueId, meal) → ChecklistGroup[]       (only that meal's items)
 *   checkMark(state, venueId, iso, meal, itemId) → CheckMark | null
 *   productionDay(venueId, dayOffset) → ProductionDay               (dayOffset 0 to PLAN_DAYS - 1)
 *   cycleEntrees(venueId, iso, meal) → [{recipeId, name}]           (the day's entrée specials)
 *   cycleItems(venueId, iso, meal) → [{recipeId, name, category}]   (everything the cycle places that day)
 *   productionCount(state, venueId, iso, row) → ProductionCount
 *   productionOpen(state, dayOffsets?) → {open, total, byMeal}      (counts still to confirm)
 *   prepTasks(state) → PrepTask[]
 *   specialsMadeAndOrdered(state, venueId, orders, assocMeals) → SpecialTally[]   (today, per special)
 *   recipeFor(name), swapCandidates(kind)
 *
 * ── Writing (sync to every open tab) ─────────────────────────────────────
 *   setSpecialAmount(venueId, iso, meal, slot, n | null, by?)
 *   setSpecialSwap(venueId, iso, meal, slot, recipeName | null, by?)
 *   setPrepped(venueId, iso, meal, slot, on, by)
 *   addPrepNote(venueId, iso, meal, name, {text, voice}, by), removePrepNote(..., noteId)
 *   setChecklist(venueId, groups | null)       (null restores the starter list)
 *   setCheck(venueId, iso, meal, itemId, how | null, by)
 *   updateProductionCounts(venueId, iso, rows, patch)
 *   setPrepTasks(tasks)
 *   resetProduction()
 *
 * ── Hook ─────────────────────────────────────────────────────────────────
 *   useProduction() → ProductionState
 *
 * A special keeps its "slot" (its name on the menu cycle) when the director
 * swaps it, so the amount, the prepped mark and the slot stay with the
 * special's place. Seed marks (the morning crew's checks, counts confirmed
 * earlier) are derived from the demo clock and never show a time later than
 * now.
 */
import seedJson from '../surfaces/prep/seed/production.json';
import swapJson from '../surfaces/prep/seed/swapCandidates.json';
import { catalog, SEED_GRID } from '../data';
import { isoDate } from '../domain/pickup';
import type { AssocMeal, Order } from '../domain/types';
import { MINUTE, now, today } from '../lib/clock';
import { createSharedStore, useShared } from '../lib/sharedStore';
import { cycleDayOn, servingAt } from '../domain/menuCycle';
import { menuEditsStore, type GridEntry } from './menuEdits';
import { recipeInfo } from './recipes';
import { venueSettingsStore } from './venueSettings';

// ─── Types ───────────────────────────────────────────────────────────────

export type PrepMeal = 'Breakfast' | 'Lunch' | 'Dinner';
export type SpecialKind = 'entree' | 'soup' | 'dessert';
type MenuKind = 'cycle' | 'fixed';

export interface ProductionVenue {
  id: string;
  /** Short name for tabs: "Sequoia". */
  name: string;
  fullName: string;
  /** "cycle": a rotating menu with daily specials; "fixed": the same menu every day. */
  menu: MenuKind;
}

/** Who did something, and when (ms on the demo clock). */
export interface Stamp {
  by: string;
  at: number;
}

export interface ScaledRecipe {
  /** Servings the base recipe makes. */
  base: number;
  /** One serving, e.g. "1 breast (6 oz) · 1 oz glaze". */
  serving: string;
  /** [quantity for the base, unit, ingredient]. */
  ingredients: Array<[number, string, string]>;
  method: string[];
}

export interface PrepSpecial {
  name: string;
  kind: SpecialKind;
  desc: string;
  /** Cook notes from the recipe. */
  cook: string;
  sides: string[];
  /** Share of the meal's covers expected to order it. */
  share: number;
  /** The special's place on the menu cycle; amounts and marks are kept by slot. */
  slot: string;
  /** Set when the director swapped another recipe in: the original special. */
  from?: string;
  swapBy?: string;
  recipe: ScaledRecipe | null;
}

export interface SpecialAmount {
  n: number;
  /** True when the director set it; false for a forecast. */
  set: boolean;
  by?: string;
  at?: number;
}

export interface PrepNote extends Stamp {
  id: string;
  text: string;
  /** Said out loud rather than typed. */
  voice: boolean;
}

export interface ChecklistItem {
  id: string;
  text: string;
  meals: PrepMeal[];
  /** Offers Stocked and Made a backup instead of a plain check. */
  stock: boolean;
}

export interface ChecklistGroup {
  id: string;
  name: string;
  items: ChecklistItem[];
}

export type CheckHow = 'done' | 'stocked' | 'backup';

export interface CheckMark extends Stamp {
  how: CheckHow;
}

interface SpecialRowSeed {
  id: string;
  kind: 'special';
  meal: PrepMeal;
  name: string;
  category: string;
  entree: boolean;
  recommended: number;
  basis: string;
}

interface AnyDayRowSeed {
  id: string;
  kind: 'anyDay';
  meal: PrepMeal;
  name: string;
  /** Average sold per week over the last 4 weeks. */
  weekly: number;
  unit: string;
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

export interface ProductionDay {
  offset: number;
  iso: string;
  date: Date;
  /** Day of the menu cycle, 0 when the venue serves the same menu every day. */
  cycleDay: number;
  rows: ProductionRow[];
}

export interface ProductionCount {
  /** Confirmed by the director. */
  ok: boolean;
  make: number;
  /** Associate meals of this entrée; null when not set. */
  assoc: number | null;
  by?: string;
  at?: number;
}

export interface PrepTask {
  id: string;
  date: string;
  text: string;
  /** Who or what it is for: "Resident council, 3 PM". */
  note: string;
  done: boolean;
}

type StoredCheck = CheckMark | { off: true };

export interface ProductionState {
  amounts: Record<string, Stamp & { n: number }>;
  swaps: Record<string, Stamp & { name: string }>;
  prepped: Record<string, Stamp>;
  /** A list here replaces the seed notes for that special. */
  notes: Record<string, PrepNote[]>;
  /** `{off: true}` records an unchecked seed mark. */
  checks: Record<string, StoredCheck>;
  /** Back Office edits; a venue without one uses the starter list. */
  checklists: Record<string, ChecklistGroup[]>;
  counts: Record<string, ProductionCount>;
  /** null until edited: the seed tasks. */
  tasks: PrepTask[] | null;
}

// ─── Reference data ──────────────────────────────────────────────────────

interface SpecialSeed {
  name: string;
  kind: SpecialKind;
  desc: string;
  cook: string;
  sides: string[];
  share?: number;
}

interface MenuSeed {
  specials: Array<Record<PrepMeal, SpecialSeed[]>> | null;
  production: Array<{ cycleDay: number; cycleLength: number; rows: Array<SpecialRowSeed | AnyDayRowSeed> }>;
}

const seed = seedJson as unknown as {
  covers: Record<PrepMeal, number>;
  menus: Record<MenuKind, MenuSeed>;
  recipes: Record<string, ScaledRecipe>;
};

export interface SwapCandidate {
  name: string;
  desc: string;
  cook: string;
}

const swapLists = swapJson as Record<SpecialKind, SwapCandidate[]>;

export const PREP_MEALS: PrepMeal[] = ['Breakfast', 'Lunch', 'Dinner'];

/** Usual covers per meal, used to forecast a special until an amount is set. */
export const PREP_COVERS: Record<PrepMeal, number> = seed.covers;

export const SPECIAL_KIND_LABEL: Record<SpecialKind, string> = {
  entree: 'Entrée special',
  soup: 'Soup',
  dessert: 'Dessert special',
};

/** Share of covers for a soup or dessert; entrées split 80% between them. */
const DEFAULT_SHARE: Record<Exclude<SpecialKind, 'entree'>, number> = { soup: 0.35, dessert: 0.4 };
const KIND_ORDER: Record<SpecialKind, number> = { entree: 0, soup: 1, dessert: 2 };
/** Sales on each weekday relative to an average day (Sunday first). */
const WEEKDAY_FACTOR = [0.95, 0.9, 0.95, 1, 1, 1.15, 1.1];

export const PRODUCTION_VENUES: ProductionVenue[] = [
  { id: 'sequoia', name: 'Sequoia', fullName: 'Sequoia Dining Room', menu: 'cycle' },
  { id: 'evergreen', name: 'Evergreen', fullName: 'Evergreen Dining Room', menu: 'cycle' },
  { id: 'bistro', name: 'The Bistro', fullName: 'The Bistro', menu: 'fixed' },
];

/** Signs Back Office changes when a page passes no name. */
export const DEFAULT_DIRECTOR = 'E. Fong';

export function getProductionVenue(id: string | null | undefined): ProductionVenue {
  return PRODUCTION_VENUES.find((v) => v.id === id) ?? PRODUCTION_VENUES[0];
}

export function recipeFor(name: string): ScaledRecipe | null {
  return seed.recipes[name] ?? null;
}

/** Recipes the director can swap in for a special of this kind, A to Z. */
export function swapCandidates(kind: SpecialKind): SwapCandidate[] {
  return swapLists[kind] ?? [];
}

/** Small stable hash, so seed marks look scattered but never change between renders. */
export function seedHash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h;
}

const slotKey = (name: string) => String(name).replace(/[^A-Za-z0-9]+/g, '_');
const specialKey = (venueId: string, iso: string, meal: string, slot: string) => `${venueId}|${iso}|${meal}|${slotKey(slot)}`;
const checkKey = (venueId: string, iso: string, meal: string, itemId: string) => `${venueId}|${iso}|${meal}|${itemId}`;
const countKey = (venueId: string, iso: string, rowId: string) => `${venueId}|${iso}|${rowId}`;

/** A time today on the demo clock. */
function todayAt(hours: number, minutes: number): number {
  const d = today();
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

// ─── Store ───────────────────────────────────────────────────────────────

const emptyState = (): ProductionState => ({
  amounts: {},
  swaps: {},
  prepped: {},
  notes: {},
  checks: {},
  checklists: {},
  counts: {},
  tasks: null,
});

export const productionStore = createSharedStore<ProductionState>(emptyState, {
  persistKey: 'kisco_production_v1',
  channel: 'kisco-production',
});

export function useProduction(): ProductionState {
  return useShared(productionStore);
}

/** Put the whole plan back to the start of the demo. */
export function resetProduction(): void {
  productionStore.reset();
}

function patchMap<K extends 'amounts' | 'swaps' | 'prepped' | 'notes' | 'checks' | 'checklists' | 'counts'>(
  field: K,
  key: string,
  value: ProductionState[K][string] | undefined,
): void {
  productionStore.set((s) => {
    const next = { ...s[field] } as Record<string, ProductionState[K][string]>;
    if (value === undefined) delete next[key];
    else next[key] = value;
    return { ...s, [field]: next };
  });
}

// ─── Specials ────────────────────────────────────────────────────────────

/**
 * The specials Production Prep makes for a meal, entrées first. Today's are
 * the menu on the tablets; tomorrow's come from the next day of the cycle.
 * A venue with the same menu every day has none.
 */
export function specialsFor(state: ProductionState, venueId: string, dayOffset: number, meal: PrepMeal): PrepSpecial[] {
  const venue = getProductionVenue(venueId);
  const day = seed.menus[venue.menu].specials?.[dayOffset];
  if (!day) return [];
  const list = day[meal] ?? [];
  const entrees = list.filter((s) => s.kind === 'entree').length || 1;
  const iso = isoDate(dayOffset);
  return list
    .map((s): PrepSpecial => {
      const share = s.share ?? (s.kind === 'entree' ? 0.8 / entrees : DEFAULT_SHARE[s.kind]);
      const base: PrepSpecial = { ...s, share, slot: s.name, recipe: recipeFor(s.name) };
      const swap = state.swaps[specialKey(venueId, iso, meal, s.name)];
      const swapped = swap && swapCandidates(s.kind).find((c) => c.name === swap.name);
      if (!swapped) return base;
      return {
        ...base,
        name: swapped.name,
        desc: swapped.desc,
        cook: swapped.cook,
        sides: [],
        recipe: recipeFor(swapped.name),
        from: s.name,
        swapBy: swap.by,
      };
    })
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

/** Forecast from the meal's usual covers: at least one. */
export function specialForecast(special: Pick<PrepSpecial, 'share'>, meal: PrepMeal): number {
  return Math.max(1, Math.round(special.share * PREP_COVERS[meal]));
}

/**
 * How many to make. The director's latest word wins: an amount set on the
 * specials view, or a count confirmed on Back Office Production for this
 * special. Until either exists it is the forecast.
 */
export function specialAmount(state: ProductionState, venueId: string, iso: string, meal: PrepMeal, special: PrepSpecial): SpecialAmount {
  const set = state.amounts[specialKey(venueId, iso, meal, special.slot)];
  const offset = dayOffsetOf(iso);
  const row =
    offset == null ? undefined : productionDay(venueId, offset).rows.find((r) => r.kind === 'special' && r.meal === meal && r.name === special.slot);
  const count = row && productionCount(state, venueId, iso, row);
  const confirmed = count?.ok && count.by ? { n: count.make, by: count.by, at: count.at ?? 0 } : null;
  const latest = set && confirmed ? (confirmed.at > set.at ? confirmed : set) : (set ?? confirmed);
  if (latest) return { n: latest.n, set: true, by: latest.by, at: latest.at };
  return { n: specialForecast(special, meal), set: false };
}

export function setSpecialAmount(venueId: string, iso: string, meal: PrepMeal, slot: string, n: number | null, by = DEFAULT_DIRECTOR): void {
  patchMap('amounts', specialKey(venueId, iso, meal, slot), n == null ? undefined : { n: Math.max(0, Math.round(n)), by, at: now() });
}

/** Swap a special for another recipe of the same kind, or (null) put the original back. */
export function setSpecialSwap(venueId: string, iso: string, meal: PrepMeal, slot: string, recipeName: string | null, by = DEFAULT_DIRECTOR): void {
  patchMap('swaps', specialKey(venueId, iso, meal, slot), recipeName ? { name: recipeName, by, at: now() } : undefined);
}

export function preppedMark(state: ProductionState, venueId: string, iso: string, meal: PrepMeal, slot: string): Stamp | null {
  return state.prepped[specialKey(venueId, iso, meal, slot)] ?? null;
}

export function setPrepped(venueId: string, iso: string, meal: PrepMeal, slot: string, on: boolean, by: string): void {
  patchMap('prepped', specialKey(venueId, iso, meal, slot), on ? { by, at: now() } : undefined);
}

// ─── Progress notes ──────────────────────────────────────────────────────

/** A note is kept by the dish name (not the slot), so a swapped dish starts with no notes. */
const noteKey = (venueId: string, iso: string, meal: string, name: string) => `${venueId}|${iso}|${meal}|${name.replace(/\./g, '')}`;

function seedNotes(venueId: string, iso: string, meal: PrepMeal, name: string, at: number): PrepNote[] {
  if (venueId !== 'sequoia') return [];
  if (iso === isoDate(0) && meal === 'Dinner' && name === 'Peach Glazed Chicken Breast') {
    return [
      {
        id: 'seed-peach',
        by: 'M. Lopez',
        at: Math.min(todayAt(14, 45), at - 150 * MINUTE),
        voice: true,
        text: 'Chicken is brined and on the second shelf of the walk-in. Peach glaze is made, two quarts, top of the reach-in by the line.',
      },
    ];
  }
  if (iso === isoDate(1) && meal === 'Dinner' && name === 'Santa Maria Tri-Tip') {
    return [
      {
        id: 'seed-tritip',
        by: 'D. Nguyen',
        at: at - 38 * MINUTE,
        voice: true,
        text: 'Tri-tip is rubbed and wrapped on the top shelf of the walk-in. Pull it at one so it tempers. Salsa still needs the cilantro.',
      },
    ];
  }
  return [];
}

/** Progress notes on a special, newest first. */
export function prepNotes(state: ProductionState, venueId: string, iso: string, meal: PrepMeal, name: string, at = now()): PrepNote[] {
  const list = state.notes[noteKey(venueId, iso, meal, name)] ?? seedNotes(venueId, iso, meal, name, at);
  return [...list].sort((a, b) => b.at - a.at);
}

export function addPrepNote(venueId: string, iso: string, meal: PrepMeal, name: string, note: { text: string; voice: boolean }, by: string): void {
  const current = prepNotes(productionStore.get(), venueId, iso, meal, name);
  const added: PrepNote = { id: 'n' + now().toString(36), by, at: now(), voice: note.voice, text: note.text.trim() };
  patchMap('notes', noteKey(venueId, iso, meal, name), [added, ...current]);
}

export function removePrepNote(venueId: string, iso: string, meal: PrepMeal, name: string, noteId: string): void {
  const current = prepNotes(productionStore.get(), venueId, iso, meal, name);
  patchMap(
    'notes',
    noteKey(venueId, iso, meal, name),
    current.filter((n) => n.id !== noteId),
  );
}

// ─── Prep checklist ──────────────────────────────────────────────────────

/**
 * The starter checklist every venue opens with until Back Office edits its
 * own: [subcategory, [[item, meals as B L D, stocked or backed up rather than just done]]].
 */
const STARTER_CHECKLIST: Array<[string, Array<[string, string, boolean]>]> = [
  [
    'Deli line',
    [
      ['Sliced turkey, two pans', 'LD', true],
      ['Sliced ham', 'LD', true],
      ['Roast beef', 'LD', true],
      ['Tuna salad', 'LD', true],
      ['Chicken salad', 'LD', true],
      ['Egg salad', 'L', true],
      ['Sliced cheese: cheddar, Swiss and provolone', 'LD', true],
      ['Lettuce, tomato and onion tray', 'LD', true],
      ['Pickles, olives and condiments', 'LD', true],
      ['Rye, sourdough and wheat bread', 'LD', true],
    ],
  ],
  [
    'Reach-ins',
    [
      ['Cut fruit cups', 'BLD', true],
      ['Yogurt parfaits', 'B', true],
      ['Milk and juice', 'BLD', true],
      ['Butter, jams and creamers', 'BLD', true],
      ['Thickened liquids, labeled by consistency', 'BLD', true],
      ['Side salads, undressed', 'LD', true],
      ['Desserts portioned and labeled', 'LD', true],
    ],
  ],
  [
    'Cleaning AM',
    [
      ['Check and log walk-in and reach-in temperatures', 'BL', false],
      ['Set up sanitizer buckets and test the strips', 'BL', false],
      ['Sanitize prep tables and cutting boards', 'BL', false],
      ['Wipe down the slicer after the deli set', 'L', false],
    ],
  ],
  [
    'Cleaning PM',
    [
      ['Break down and clean the slicer', 'D', false],
      ['Label, date and rotate leftovers, and toss anything expired', 'D', false],
      ['Clean reach-in gaskets and shelves', 'D', false],
      ['Drain and clean the steam table wells', 'D', false],
      ['Sweep and mop the prep area', 'D', false],
      ['Log closing temperatures', 'D', false],
    ],
  ],
];

const MEAL_LETTER: Record<string, PrepMeal> = { B: 'Breakfast', L: 'Lunch', D: 'Dinner' };

export function starterChecklist(): ChecklistGroup[] {
  return STARTER_CHECKLIST.map(([name, items], gi) => ({
    id: `pg${gi}`,
    name,
    items: items.map(([text, meals, stock], ii) => ({
      id: `pg${gi}i${ii}`,
      text,
      meals: meals.split('').map((c) => MEAL_LETTER[c]),
      stock,
    })),
  }));
}

export function checklistFor(state: ProductionState, venueId: string): ChecklistGroup[] {
  return state.checklists[venueId] ?? starterChecklist();
}

export function isChecklistEdited(state: ProductionState, venueId: string): boolean {
  return venueId in state.checklists;
}

/** Only the groups and items shown at this meal, in Back Office order. */
export function checklistForMeal(state: ProductionState, venueId: string, meal: PrepMeal): ChecklistGroup[] {
  return checklistFor(state, venueId)
    .map((g) => ({ ...g, items: g.items.filter((it) => it.meals.includes(meal)) }))
    .filter((g) => g.items.length > 0);
}

export function setChecklist(venueId: string, groups: ChecklistGroup[] | null): void {
  patchMap('checklists', venueId, groups ?? undefined);
}

/**
 * The morning crew has done breakfast and most of lunch; at dinner some of
 * the line is stocked and the closing work is still ahead. Only today, and
 * never later than now.
 */
function seedCheck(venueId: string, iso: string, meal: PrepMeal, item: ChecklistItem, at: number): CheckMark | null {
  if (iso !== isoDate(0)) return null;
  const pos = /^pg(\d+)i(\d+)$/.exec(item.id);
  if (!pos) return null;
  const h = seedHash(venueId + item.id + meal) % 10;
  const done = meal === 'Breakfast' || (meal === 'Lunch' && h > 1) || (meal === 'Dinner' && item.stock && h > 4);
  if (!done) return null;
  const [startH, startM] = meal === 'Breakfast' ? [6, 20] : meal === 'Lunch' ? [10, 5] : [15, 30];
  const when = todayAt(startH, startM) + (+pos[1] * 9 + +pos[2] * 3) * MINUTE;
  if (when > at) return null;
  return {
    how: item.stock ? (h % 4 === 0 ? 'backup' : 'stocked') : 'done',
    by: meal === 'Dinner' ? 'M. Lopez' : 'J. Rivera',
    at: when,
  };
}

export function checkMark(state: ProductionState, venueId: string, iso: string, meal: PrepMeal, item: ChecklistItem, at = now()): CheckMark | null {
  const stored = state.checks[checkKey(venueId, iso, meal, item.id)];
  if (stored) return 'off' in stored ? null : stored;
  return seedCheck(venueId, iso, meal, item, at);
}

/** Check an item off (done, stocked, made a backup) or, with null, uncheck it. */
export function setCheck(venueId: string, iso: string, meal: PrepMeal, itemId: string, how: CheckHow | null, by: string): void {
  patchMap('checks', checkKey(venueId, iso, meal, itemId), how ? { how, by, at: now() } : { off: true });
}

// ─── Back Office production counts ───────────────────────────────────────

/** How far ahead the director can plan: this week and next. */
export const PLAN_DAYS = 14;

function dayOffsetOf(iso: string): number | null {
  for (let o = 0; o < PLAN_DAYS; o++) if (isoDate(o) === iso) return o;
  return null;
}

function formatWeekday(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

const MEAL_ORDER: Record<PrepMeal, number> = { Breakfast: 0, Lunch: 1, Dinner: 2 };

/** The menu cycle as Menu Cycle & À la Carte has it: the chef's edits, else the seed. */
function cycleGrid(): { grid: GridEntry[]; nameOf: (recipeId: string) => string | undefined } {
  const edits = menuEditsStore.get();
  return {
    grid: edits.grid ?? SEED_GRID,
    nameOf: (id) => recipeInfo(id, edits)?.name,
  };
}

/**
 * The cycle items a venue serves on a date, with a recommendation from past
 * runs: the venue's scheduled menu on that date (Venue Settings), its cycle
 * day, and what Menu Cycle places on that day. Two entrées in a meal split
 * the room, so each is recommended at 85%.
 */
function cycleRows(venue: ProductionVenue, date: Date): { cycleDay: number; rows: ProductionRow[] } {
  const scheduled = venueSettingsStore.get().venues.find((v) => v.name === venue.fullName);
  if (!scheduled) return { cycleDay: 0, rows: [] };
  const { menuId, start } = servingAt(scheduled, date.getTime());
  const { grid, nameOf } = cycleGrid();
  const placed = grid.filter((g) => g.menuId === menuId && g.day > 0);
  const len = placed.reduce((m, g) => Math.max(m, g.day), 0);
  const cycleDay = len > 1 ? (cycleDayOn(start, len, date.getTime()) ?? 0) : 0;
  if (!cycleDay) return { cycleDay: 0, rows: [] };
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
 * What a venue makes on a day (0 today, 1 tomorrow ... up to PLAN_DAYS - 1):
 * that day's cycle items with recommendations from past runs, then the five
 * best-selling always-available dishes of each meal from average sales on
 * that weekday.
 */
export function productionDay(venueId: string, dayOffset: number): ProductionDay {
  const venue = getProductionVenue(venueId);
  const date = today();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  const factor = WEEKDAY_FACTOR[date.getDay()];
  const anyDay = (seed.menus[venue.menu].production[0]?.rows ?? []).flatMap((r): ProductionRow[] => {
    if (r.kind !== 'anyDay') return [];
    const avg = (r.weekly / 7) * factor;
    return [
      {
        id: r.id,
        kind: 'anyDay',
        meal: r.meal,
        name: r.name,
        category: 'Any Day',
        entree: false,
        recommended: Math.ceil(avg),
        unit: r.unit,
        basis: `avg ${formatWeekday(date)} ${r.meal.toLowerCase()}, last 4 weeks: ${Math.round(avg * 10) / 10}`,
      },
    ];
  });
  const cycle = venue.menu === 'cycle' ? cycleRows(venue, date) : { cycleDay: 0, rows: [] };
  const rows = [...cycle.rows, ...anyDay].sort(
    (a, b) => MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal] || (a.kind === 'anyDay' ? 1 : 0) - (b.kind === 'anyDay' ? 1 : 0),
  );
  return { offset: dayOffset, iso: isoDate(dayOffset), date, cycleDay: cycle.cycleDay, rows };
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
  if (venue.menu !== 'cycle') return [];
  const [y, m, d] = iso.split('-').map(Number);
  return cycleRows(venue, new Date(y, m - 1, d))
    .rows.filter((r) => r.meal === meal && r.recipeId)
    .map((r) => ({ recipeId: r.recipeId!, name: r.name, category: r.category }));
}

/** The morning crew already confirmed breakfast and most of lunch today; a few dinner counts are left. */
function seedCount(venueId: string, iso: string, row: ProductionRow): ProductionCount | null {
  if (iso !== isoDate(0)) return null;
  const h = seedHash(venueId + row.id);
  const done = row.meal === 'Breakfast' || (row.meal === 'Lunch' && h % 7 !== 0) || (row.meal === 'Dinner' && h % 5 > 1);
  if (!done) return null;
  return {
    ok: true,
    make: row.recommended,
    assoc: row.entree ? 1 + (seedHash(row.id) % 4) : null,
    by: 'J. Rivera',
    at: Math.min(todayAt(6, 0), now()),
  };
}

export function productionCount(state: ProductionState, venueId: string, iso: string, row: ProductionRow): ProductionCount {
  return state.counts[countKey(venueId, iso, row.id)] ?? seedCount(venueId, iso, row) ?? { ok: false, make: row.recommended, assoc: null };
}

/** Change counts: make, associates, or confirm (ok + by). */
export function updateProductionCounts(venueId: string, iso: string, rows: ProductionRow[], patch: Partial<ProductionCount>): void {
  productionStore.set((s) => {
    const counts = { ...s.counts };
    for (const row of rows) {
      const key = countKey(venueId, iso, row.id);
      const current = productionCount(s, venueId, iso, row);
      counts[key] = { ...current, ...patch, ...(patch.ok ? { at: now() } : {}) };
    }
    return { ...s, counts };
  });
}

/** Counts not yet confirmed across every venue (the dashboard's "to confirm"). */
export function productionOpen(
  state: ProductionState,
  dayOffsets: number[] = [0],
): { open: number; total: number; byMeal: Partial<Record<PrepMeal, number>> } {
  let open = 0;
  let total = 0;
  const byMeal: Partial<Record<PrepMeal, number>> = {};
  for (const v of PRODUCTION_VENUES) {
    for (const off of dayOffsets) {
      const day = productionDay(v.id, off);
      for (const row of day.rows) {
        total++;
        if (!productionCount(state, v.id, day.iso, row).ok) {
          open++;
          byMeal[row.meal] = (byMeal[row.meal] ?? 0) + 1;
        }
      }
    }
  }
  return { open, total, byMeal };
}

// ─── Extra prep tasks ────────────────────────────────────────────────────

function seedTasks(): PrepTask[] {
  return [
    { id: 'pt1', date: isoDate(0), text: 'Veggie and fruit trays for 25', note: 'Resident council, 3 PM', done: false },
    { id: 'pt2', date: isoDate(1), text: 'Cookies for 40', note: 'Life Enrichment social, 2 PM', done: false },
    { id: 'pt3', date: isoDate(2), text: 'Sheet cake for 30', note: 'Monthly birthday party, 3:30 PM', done: false },
  ];
}

export function prepTasks(state: ProductionState): PrepTask[] {
  return state.tasks ?? seedTasks();
}

export function setPrepTasks(tasks: PrepTask[]): void {
  productionStore.set((s) => ({ ...s, tasks }));
}

// ─── Made and ordered today ──────────────────────────────────────────────

export interface SpecialTally {
  itemId: string;
  name: string;
  meal: PrepMeal;
  /** The day's production count. */
  made: number;
  dineIn: number;
  pickupDelivery: number;
  associates: number;
  ordered: number;
  /** Negative when more were ordered than made. */
  left: number;
}

/**
 * Today's specials on the menu (none at a venue with the same menu every day), with how many were made (the day's
 * production count) and ordered so far: every line sent today on an open or
 * closed check, plus associate meals not cancelled.
 */
export function specialsMadeAndOrdered(
  state: ProductionState,
  venueId: string,
  orders: Order[],
  assocMeals: AssocMeal[],
  at = now(),
): SpecialTally[] {
  const start = new Date(at);
  start.setHours(0, 0, 0, 0);
  const iso = isoDate(0);
  if (getProductionVenue(venueId).menu === 'fixed') return [];
  const day = productionDay(venueId, 0);
  return catalog
    .filter((it) => it.special && PREP_MEALS.includes(it.meal))
    .sort((a, b) => PREP_MEALS.indexOf(a.meal) - PREP_MEALS.indexOf(b.meal))
    .map((it) => {
      let dineIn = 0;
      let pickupDelivery = 0;
      for (const o of orders) {
        if (Math.max(Number(o.closedAt) || 0, o.openedAt || 0) < start.getTime()) continue;
        for (const d of o.diners) {
          for (const line of d.items) {
            if (line.itemId !== it.id || !line.sent || line.cancelled) continue;
            if (o.queueType) pickupDelivery++;
            else dineIn++;
          }
        }
      }
      const name = it.name.toLowerCase();
      const associates = assocMeals.filter((a) => a.date === iso && !/cancel/i.test(a.status || '') && a.item.toLowerCase() === name).length;
      const row = day.rows.find((r) => r.kind === 'special' && r.meal === it.meal && r.name === it.name);
      const made = row ? productionCount(state, venueId, iso, row).make : 0;
      const ordered = dineIn + pickupDelivery + associates;
      return { itemId: it.id, name: it.name, meal: it.meal, made, dineIn, pickupDelivery, associates, ordered, left: made - ordered };
    });
}
