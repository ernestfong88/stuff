/**
 * The associate menu. Each week has one special that a set number of
 * associates can have each day, first come, first served. Like a dining
 * menu, a week is a Draft until the chef schedules it, Scheduled until its
 * Monday, then Active. The four standing choices are always on. Associates
 * plan only on scheduled or active weeks, up to the end of next week, with
 * associate-only choices and no notes.
 *
 * Back Office keeps its edits in the service settings: `am.weeks[monday]`
 * ({sched, special, sub, cap}) and `am.fixed[choiceId].sub`.
 */
import type { AssocMeal } from '../types';
import { isLive } from './windows';

export interface ModChoice {
  /** Group name: Dressing, Side, Size ... */
  group: string;
  options: string[];
}

export interface AssocMenuItem {
  id: string;
  name: string;
  sub: string;
  /** Daily limit for the special; undefined for the standing choices. */
  cap?: number;
  special?: boolean;
  mods: ModChoice[];
}

export interface MenuWeek {
  /** Scheduled by the chef (Draft until then). */
  sched: boolean;
  special: string;
  sub: string;
  cap: number;
}

export type WeekState = 'draft' | 'scheduled' | 'active';
/** Why a day can't be planned: before today, past the end of next week, or its week is still a draft. */
export type ClosedReason = 'past' | 'late' | 'draft';

const DRESSINGS = ['Chipotle Ranch', 'Ranch', 'Balsamic Vinaigrette', 'Italian'];

export const STANDING_CHOICES: AssocMenuItem[] = [
  {
    id: 'am_salad',
    name: 'Entrée Salad',
    sub: 'Southwest greens, black beans, corn, tomato',
    mods: [
      { group: 'Dressing', options: DRESSINGS },
      { group: 'Protein', options: ['Grilled Chicken', 'No protein'] },
    ],
  },
  {
    id: 'am_sandwich',
    name: 'Sandwich of the Month',
    sub: 'Turkey club on toasted sourdough',
    mods: [{ group: 'Side', options: ['Chips', 'Fruit', 'Side Salad'] }],
  },
  {
    id: 'am_soup',
    name: 'Soup of the Week',
    sub: 'Cheeseburger soup this week',
    mods: [{ group: 'Size', options: ['Cup', 'Bowl'] }],
  },
  {
    id: 'am_combo',
    name: 'Soup & Salad Combo',
    sub: 'Cup of soup and a side salad',
    mods: [{ group: 'Dressing', options: DRESSINGS }],
  },
];

/** "2026-10-07" plus k days. */
export function addDays(date: string, k: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + k);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week a date falls in. */
export function mondayOf(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  return addDays(date, -((d.getUTCDay() + 6) % 7));
}

/** A week's menu: Back Office edits over the defaults (this week live, next week drafted). */
export function menuWeek(monday: string, todayIso: string, edits: Record<string, Partial<MenuWeek>> | undefined): MenuWeek {
  const current = mondayOf(todayIso);
  const base: MenuWeek =
    monday === current
      ? { sched: true, special: 'Peach Glazed Chicken Breast', sub: 'Mashed potatoes, garlic green beans', cap: 12 }
      : monday === addDays(current, 7)
        ? { sched: false, special: 'BBQ Pulled Pork Sandwich', sub: 'Coleslaw, kettle chips', cap: 10 }
        : { sched: false, special: '', sub: '', cap: 10 };
  return { ...base, ...edits?.[monday] };
}

export function weekState(week: MenuWeek, monday: string, todayIso: string): WeekState {
  if (!week.sched) return 'draft';
  return todayIso >= monday ? 'active' : 'scheduled';
}

export function closedReason(date: string, todayIso: string, edits: Record<string, Partial<MenuWeek>> | undefined): ClosedReason | null {
  if (date < todayIso) return 'past';
  if (date > addDays(mondayOf(todayIso), 13)) return 'late';
  return menuWeek(mondayOf(date), todayIso, edits).sched ? null : 'draft';
}

export const CLOSED_TEXT: Record<ClosedReason, string> = {
  late: 'Meals open a week ahead. You can plan through the end of next week.',
  past: 'This day has passed.',
  draft: "The chef hasn't set this week's menu yet. Check back soon.",
};

/** What associates can pick on a date: the week's special, then the standing choices. Null when closed. */
export function menuFor(
  date: string,
  todayIso: string,
  edits: Record<string, Partial<MenuWeek>> | undefined,
  standingSubs: Record<string, { sub?: string }> | undefined,
): AssocMenuItem[] | null {
  if (closedReason(date, todayIso, edits)) return null;
  const week = menuWeek(mondayOf(date), todayIso, edits);
  const special: AssocMenuItem[] = week.special
    ? [
        {
          id: 'am_special',
          name: week.special,
          sub: "This week's special" + (week.sub ? ` · ${week.sub}` : ''),
          cap: Math.max(0, Number(week.cap) || 0),
          special: true,
          mods: [],
        },
      ]
    : [];
  return [...special, ...standingChoices(standingSubs)];
}

/** The standing choices with the descriptions Back Office set this week. */
export function standingChoices(standingSubs: Record<string, { sub?: string }> | undefined): AssocMenuItem[] {
  return STANDING_CHOICES.map((c) => ({ ...c, sub: standingSubs?.[c.id]?.sub || c.sub }));
}

/** How many of a limited item are left on a date (null when unlimited). */
export function itemsLeft(meals: AssocMeal[], date: string, item: AssocMenuItem, skipId?: string): number | null {
  if (item.cap == null) return null;
  const taken = meals.filter((o) => o.date === date && o.item === item.name && o.id !== skipId && isLive(o)).length;
  return Math.max(0, item.cap - taken);
}

/** "Ranch, Grilled Chicken" in the item's group order. */
export function modsText(item: AssocMenuItem, picked: Record<string, string>): string {
  return item.mods
    .map((g) => picked[g.group])
    .filter(Boolean)
    .join(', ');
}

/** The first group still to pick, or null when every choice is made. */
export function missingChoice(item: AssocMenuItem, picked: Record<string, string>): ModChoice | null {
  return item.mods.find((g) => !picked[g.group]) ?? null;
}
