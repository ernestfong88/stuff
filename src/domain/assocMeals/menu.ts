/**
 * The associate menu, the same in every community:
 *
 *   - one chef special per meal period, from that day's dining menu cycle
 *     (lunch and dinner; overnight NOC meals get the dinner special, since
 *     the dinner line makes them). The chef picks which entrée special and
 *     how many associates can have it, first come, first served;
 *   - the associate special of the week: one Recipe Book recipe the chef
 *     sets per week (weeks run Sunday to Saturday, like the menu cycle), on every day of that week;
 *   - the standing choices, always on, each a Recipe Book recipe the chef
 *     can swap (this month's sandwich ...). The soup isn't picked by hand:
 *     it is always the dining room's soup of the day, from the menu cycle.
 *
 * A week is a Draft until the chef schedules it, Scheduled until its
 * Sunday, then Active. Associates plan only on scheduled or active weeks, up
 * to the end of next week, with associate-only choices and no notes.
 *
 * This module is pure; src/store/assocMenu.ts assembles a day's menu from
 * the settings, the menu cycle and the Recipe Book.
 */
import type { AssocMeal } from '../types';
import { isLive } from './windows';

export type AssocMealKind = 'Lunch' | 'Dinner' | 'NOC';

/** The meal period whose special a meal gets: NOC meals come off the dinner line. */
export const specialPeriodOf = (meal: AssocMealKind): 'Lunch' | 'Dinner' => (meal === 'Lunch' ? 'Lunch' : 'Dinner');

export interface ModChoice {
  /** Group name: Dressing, Side, Size ... */
  group: string;
  options: string[];
}

export interface AssocMenuItem {
  id: string;
  /** What the associate and the kitchen see: the recipe's name (or the combo's). */
  name: string;
  sub: string;
  /** Recipe Book recipes the meal is made from. */
  recipeIds: string[];
  allergens: string[];
  /** Daily limit for the special; undefined for the standing choices. */
  cap?: number;
  /** The meals that share the cap (dinner and NOC share the dinner special). */
  capMeals?: AssocMealKind[];
  special?: boolean;
  /** The associate special of the week. */
  weekly?: boolean;
  /** The dining room's soup of the day (alone, not the combo). */
  soupOfDay?: boolean;
  mods: ModChoice[];
}

/** A week is open to plan once the chef schedules it. */
export interface MenuWeek {
  sched: boolean;
}

/** The chef's call for one meal period of one day. */
export interface DaySpecialPick {
  /** Recipe offered; null means no special this meal. Absent: the cycle's first entrée special. */
  recipeId?: string | null;
  /** Associates who can have it; absent: DEFAULT_SPECIAL_CAP. */
  cap?: number;
}

export type DayPicks = Partial<Record<'Lunch' | 'Dinner', DaySpecialPick>>;

export const DEFAULT_SPECIAL_CAP = 12;

export type WeekState = 'draft' | 'scheduled' | 'active';
/** Why a day can't be planned: before today, past the end of next week, or its week is still a draft. */
export type ClosedReason = 'past' | 'late' | 'draft';

// ─── The standing choices ────────────────────────────────────────────────

const DRESSINGS = ['Chipotle Ranch', 'Ranch', 'Balsamic Vinaigrette', 'Italian'];

export interface StandingSlot {
  id: string;
  /** "Sandwich of the Month": what the slot is, shown with the recipe. */
  label: string;
  /** Recipe Book category and subcategory the chef picks from. */
  cat: string;
  sub: string;
  defaultRecipe: string;
  mods: ModChoice[];
  /** The combo: a cup of the soup of the day plus this slot's side salad. */
  withSoup?: boolean;
  /** Not picked by hand: always the dining room's soup of the day. */
  daySoup?: boolean;
}

export const STANDING_SLOTS: StandingSlot[] = [
  {
    id: 'am_salad',
    label: 'Entrée salad',
    cat: 'Entrees',
    sub: 'Entrée Salad',
    defaultRecipe: 'l_swsalad',
    mods: [
      { group: 'Dressing', options: DRESSINGS },
      { group: 'Protein', options: ['Grilled Chicken', 'No protein'] },
    ],
  },
  {
    id: 'am_sandwich',
    label: 'Sandwich of the month',
    cat: 'Entrees',
    sub: 'Sandwiches',
    defaultRecipe: 'vf_turkeyclub',
    mods: [{ group: 'Side', options: ['Chips', 'Fruit', 'Side Salad'] }],
  },
  {
    id: 'am_soup',
    label: 'Soup of the day',
    cat: 'Starters',
    sub: 'Soup',
    defaultRecipe: 'l_cbsoup',
    mods: [{ group: 'Size', options: ['Cup', 'Bowl'] }],
    daySoup: true,
  },
  {
    id: 'am_combo',
    label: 'Soup & salad combo',
    cat: 'Sides',
    sub: 'Side Salad',
    defaultRecipe: 'l_sidesalad',
    mods: [{ group: 'Dressing', options: DRESSINGS }],
    withSoup: true,
  },
];

export const COMBO_NAME = 'Soup & Salad Combo';

/**
 * The soup of the day: the first Starters item on the day's menu cycle for
 * the meal whose recipe is a soup. Null when the cycle has no soup that day.
 */
export function soupOfTheDay(
  cycleItems: Array<{ recipeId?: string; category: string }>,
  subOf: (recipeId: string) => string | undefined,
): string | null {
  return cycleItems.find((x) => x.category === 'Starters' && x.recipeId && subOf(x.recipeId) === 'Soup')?.recipeId ?? null;
}

/** The associate special of the week a date falls in (weeks keyed by their Sunday), or null. */
export function weekSpecialFor(date: string, weekly: Record<string, string | null | undefined> | undefined): string | null {
  return weekly?.[weekStartOf(date)] || null;
}

// ─── Dates and weeks ─────────────────────────────────────────────────────

/** "2026-10-07" plus k days. */
export function addDays(date: string, k: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + k);
  return d.toISOString().slice(0, 10);
}

/** The Sunday of the week a date falls in: associate weeks run Sunday to Saturday, like the menu cycle's. */
export function weekStartOf(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  return addDays(date, -d.getUTCDay());
}

/** A week's schedule: Back Office's call over the default (this week scheduled, later weeks drafts). */
export function menuWeek(start: string, todayIso: string, edits: Record<string, Partial<MenuWeek>> | undefined): MenuWeek {
  const sched = edits?.[start]?.sched;
  return { sched: sched ?? start === weekStartOf(todayIso) };
}

export function weekState(week: MenuWeek, start: string, todayIso: string): WeekState {
  if (!week.sched) return 'draft';
  return todayIso >= start ? 'active' : 'scheduled';
}

export function closedReason(date: string, todayIso: string, edits: Record<string, Partial<MenuWeek>> | undefined): ClosedReason | null {
  if (date < todayIso) return 'past';
  if (date > addDays(weekStartOf(todayIso), 13)) return 'late';
  return menuWeek(weekStartOf(date), todayIso, edits).sched ? null : 'draft';
}

export const CLOSED_TEXT: Record<ClosedReason, string> = {
  late: 'Meals open a week ahead. You can plan through the end of next week.',
  past: 'This day has passed.',
  draft: "The chef hasn't set this week's menu yet. Check back soon.",
};

// ─── Orders against the menu ─────────────────────────────────────────────

/** How many of a limited item are left on a date (null when unlimited). */
export function itemsLeft(meals: AssocMeal[], date: string, item: AssocMenuItem, skipId?: string): number | null {
  if (item.cap == null) return null;
  const taken = meals.filter(
    (o) =>
      o.date === date && o.item === item.name && o.id !== skipId && isLive(o) && (!item.capMeals || item.capMeals.includes(o.meal as AssocMealKind)),
  ).length;
  return Math.max(0, item.cap - taken);
}

/** "Ranch, Grilled Chicken" in the item's group order. */
export function modsText(item: AssocMenuItem | null | undefined, picked: Record<string, string> | undefined): string {
  if (!item) return '';
  return item.mods
    .map((g) => picked?.[g.group])
    .filter(Boolean)
    .join(', ');
}

/** The first group still to pick, or null when every choice is made. */
export function missingChoice(item: AssocMenuItem, picked: Record<string, string>): ModChoice | null {
  return item.mods.find((g) => !picked[g.group]) ?? null;
}
