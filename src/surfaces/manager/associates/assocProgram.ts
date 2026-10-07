/**
 * The associate meal program as the manager sees it: the same windows, menu,
 * special limits and cutoff as the Associate App.
 *
 * The chef sets the menu a week at a time in Back Office, Associate Meals:
 * that week's special and how many associates can have it each day, first
 * come first served. A week is a draft until the chef schedules it. The four
 * standing choices are always on. Orders close 45 minutes before their
 * pickup window; a manager can still add or change after the cutoff, but
 * only with a reason, which goes in the order's log.
 */
import { rooms } from '../../../data';
import type { AssocMeal } from '../../../domain/types';
import { isoDate } from '../../../domain/pickup';
import { DAY, MINUTE, startOfToday } from '../../../lib/clock';
import { getSetting } from '../../../store/serviceConfig';

/** Where associates pick up, and how long before a window orders close. */
export const ASSOC_VENUE = 'Evergreen Bistro';
export const CUTOFF_MIN = 45;

/** Associates in the meal program (the Associate App's roster). */
export const PROGRAM_NAMES = ['Jordan Reyes', 'Maria Lopez', 'Devon Carter', 'Priya Nair', 'Tom Ellis', 'Grace Kim', 'Luis Ortega'];

export type AssocMealKind = 'Lunch' | 'Dinner' | 'NOC';

export interface AssocChoiceGroup {
  g: string;
  opts: string[];
}

export interface AssocMenuItem {
  id: string;
  name: string;
  sub: string;
  /** How many a day for a special; absent for the standing choices. */
  cap?: number;
  special?: boolean;
  mods: AssocChoiceGroup[];
}

const DRESSINGS = ['Chipotle Ranch', 'Ranch', 'Balsamic Vinaigrette', 'Italian'];

/** The standing choices, always on. */
export const STANDING_MENU: AssocMenuItem[] = [
  {
    id: 'am_salad',
    name: 'Entrée Salad',
    sub: 'Southwest greens, black beans, corn, tomato',
    mods: [
      { g: 'Dressing', opts: DRESSINGS },
      { g: 'Protein', opts: ['Grilled Chicken', 'No protein'] },
    ],
  },
  { id: 'am_sandwich', name: 'Sandwich of the Month', sub: 'Turkey club on toasted sourdough', mods: [{ g: 'Side', opts: ['Chips', 'Fruit', 'Side Salad'] }] },
  { id: 'am_soup', name: 'Soup of the Week', sub: 'Cheeseburger soup this week', mods: [{ g: 'Size', opts: ['Cup', 'Bowl'] }] },
  { id: 'am_combo', name: 'Soup & Salad Combo', sub: 'Cup of soup and a side salad', mods: [{ g: 'Dressing', opts: DRESSINGS }] },
];

// ─── Dates and weeks ─────────────────────────────────────────────────────

/** "YYYY-MM-DD" plus k days. */
export function addDays(date: string, k: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + k);
  return d.toISOString().slice(0, 10);
}

/** The Monday of a date's week. */
export function mondayOf(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  return addDays(date, -((d.getUTCDay() + 6) % 7));
}

interface WeekPlan {
  sched: boolean;
  special: string;
  sub: string;
  cap: number;
}

interface SavedWeek extends Partial<WeekPlan> {
  /** Older saves said "pub" for scheduled. */
  pub?: boolean;
}

/** __kAmWeek: the chef's plan for a week, with the demo's defaults. */
export function weekPlan(monday: string, todayIso: string = isoDate(0), saved: Record<string, SavedWeek | undefined> = getSetting('am.weeks') ?? {}): WeekPlan {
  const cur = mondayOf(todayIso);
  const def: WeekPlan =
    monday === cur
      ? { sched: true, special: 'Peach Glazed Chicken Breast', sub: 'Mashed potatoes, garlic green beans', cap: 12 }
      : monday === addDays(cur, 7)
        ? { sched: false, special: 'BBQ Pulled Pork Sandwich', sub: 'Coleslaw, kettle chips', cap: 10 }
        : { sched: false, special: '', sub: '', cap: 10 };
  const o = saved[monday] ?? {};
  const { pub, ...rest } = o;
  const w = { ...def, ...rest };
  if (o.sched == null && pub != null) w.sched = !!pub;
  return w;
}

/** __kAmMenu: the menu for a date, or null when it cannot be ordered (past, too far out, or a draft week). */
export function assocMenu(date: string, todayIso: string = isoDate(0)): AssocMenuItem[] | null {
  if (date < todayIso) return null;
  if (date > addDays(mondayOf(todayIso), 13)) return null;
  const w = weekPlan(mondayOf(date), todayIso);
  if (!w.sched) return null;
  const special: AssocMenuItem[] = w.special
    ? [{ id: 'am_special', name: w.special, sub: "This week's special" + (w.sub ? ` · ${w.sub}` : ''), cap: Math.max(0, Number(w.cap) || 0), special: true, mods: [] }]
    : [];
  return [...special, ...STANDING_MENU];
}

export function menuItem(date: string, name: string): AssocMenuItem | null {
  return (assocMenu(date) ?? STANDING_MENU).find((x) => x.name === name) ?? null;
}

/** Ordered choices as one line: "Ranch, Grilled Chicken". */
export function choicesText(it: AssocMenuItem | null, picks: Record<string, string> | undefined): string {
  return it ? it.mods.map((g) => picks?.[g.g]).filter(Boolean).join(', ') : '';
}

/** Every choice group has a pick. */
export function choicesComplete(it: AssocMenuItem | null, picks: Record<string, string> | undefined): boolean {
  return !it || it.mods.every((g) => !!picks?.[g.g]);
}

// ─── Windows ─────────────────────────────────────────────────────────────

/** Overnight (NOC) ranges run from 10 PM to 6 AM, kept as minutes from the service day's midnight. */
const NOC_RANGE: [number, number] = [1320, 1800];
const NOC_DEFAULT: [number, number] = [1380, 1560];
const DAY_RANGE: [number, number] = [360, 1320];
const ASSOC_DEFAULT: Array<[number, number]> = [
  [660, 810],
  [990, 1170],
];
const LUNCH_END = 960;

/** 690 → "11:30 AM"; 1560 → "2:00 AM". */
export function minutesLabel(v: number): string {
  const h = Math.floor(v / 60) % 24;
  return `${h % 12 || 12}:${String(v % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** __kWinMin: "2:00 AM" → 1560 (after midnight counts as the same service day). */
export function windowMinutes(w: string): number | null {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(w || '');
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3] === 'PM') h += 12;
  const v = h * 60 + Number(m[2]);
  return v < 360 ? v + 1440 : v;
}

export function isNoc(w: string): boolean {
  const v = windowMinutes(w);
  return v != null && v >= NOC_RANGE[0];
}

/** "5:00 PM" → "5:00 to 5:15 PM". */
export function rangeLabel(w: string): string {
  const v = windowMinutes(w);
  if (v == null) return w;
  const a = minutesLabel(v);
  const b = minutesLabel(v + 15);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} to ${b}` : `${a} to ${b}`;
}

/** The dining room associates pick up from. */
export function assocRoom(): string {
  const word = ASSOC_VENUE.toLowerCase().split(/\W+/)[0];
  const keys = Object.keys(rooms);
  return keys.find((k) => (rooms[k].name || '').toLowerCase().includes(word)) ?? keys[0];
}

function slots(ranges: Array<[number, number]>): number[] {
  return ranges.flatMap(([a, b]) => {
    const out: number[] = [];
    for (let s = a; s < b; s += 15) out.push(s);
    return out;
  });
}

function grid(path: string, range: [number, number], fallback: number[]): number[] {
  const g = getSetting<unknown>(path);
  return Array.isArray(g)
    ? g.filter((s): s is number => typeof s === 'number' && s % 15 === 0 && s >= range[0] && s < range[1]).sort((a, b) => a - b)
    : fallback;
}

export interface AssocWindow {
  meal: AssocMealKind;
  /** Start of the 15 minute range, "5:00 PM". */
  w: string;
}

/**
 * __kAmWins: the pickup ranges Back Office (Pick Up Windows) offers for
 * associates, plus any range already booked today so its orders still show.
 */
export function assocWindows(booked: AssocMeal[], todayIso: string = isoDate(0)): AssocWindow[] {
  const room = assocRoom();
  const day = grid(`win.grid.${room}.assoc`, DAY_RANGE, slots(ASSOC_DEFAULT));
  const noc = grid(`win.grid.${room}.noc`, NOC_RANGE, slots([NOC_DEFAULT]));
  const used = booked.filter((o) => o.date === todayIso && o.window).map((o) => o.window);
  const merge = (base: number[], pick: (v: number) => boolean) =>
    [...new Set([...base.map(minutesLabel), ...used.filter((w) => {
      const v = windowMinutes(w);
      return v != null && pick(v);
    })])].sort((a, b) => (windowMinutes(a) ?? 0) - (windowMinutes(b) ?? 0));
  return [
    ...merge(day.filter((v) => v < LUNCH_END), (v) => v < LUNCH_END).map((w) => ({ meal: 'Lunch' as const, w })),
    ...merge(day.filter((v) => v >= LUNCH_END), (v) => v >= LUNCH_END && v < NOC_RANGE[0]).map((w) => ({ meal: 'Dinner' as const, w })),
    ...merge(noc, (v) => v >= NOC_RANGE[0]).map((w) => ({ meal: 'NOC' as const, w })),
  ];
}

export function mealOfWindow(w: string): AssocMealKind {
  if (isNoc(w)) return 'NOC';
  return (windowMinutes(w) ?? 0) < LUNCH_END ? 'Lunch' : 'Dinner';
}

/** When a window starts on a date (ms). */
export function windowAt(date: string, w: string): number {
  const v = windowMinutes(w);
  if (v == null) return 0;
  const days = Math.round((Date.parse(date) - Date.parse(isoDate(0))) / DAY);
  return startOfToday() + days * DAY + v * MINUTE;
}

/** When ordering for a window closes. NOC meals are made before the dinner line closes. */
export function windowCloseAt(date: string, w: string): number {
  const at = windowAt(date, w);
  const nocBy = Number(getSetting('win.nocBy') ?? 1200);
  return (isNoc(w) ? Math.min(at, windowAt(date, minutesLabel(nocBy))) : at) - CUTOFF_MIN * MINUTE;
}

export function windowOpen(date: string, w: string, at: number): boolean {
  return at < windowCloseAt(date, w);
}

// ─── Orders ──────────────────────────────────────────────────────────────

export interface AssocLogEntry {
  by: string;
  at: number;
  text: string;
  /** The associate was texted about it. */
  texted?: boolean;
}

function isLogEntry(x: unknown): x is AssocLogEntry {
  return !!x && typeof x === 'object' && typeof (x as AssocLogEntry).text === 'string' && typeof (x as AssocLogEntry).at === 'number';
}

export function orderLog(o: AssocMeal): AssocLogEntry[] {
  return (o.log ?? []).filter(isLogEntry);
}

/** The choices saved on an order (text values only). */
export function orderChoices(o: AssocMeal | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(o?.mods ?? {}).filter((e): e is [string, string] => typeof e[1] === 'string'));
}

/** When expo set the meal out; the shared AssocMeal type does not carry it yet. */
export function readyAtOf(o: AssocMeal): number | undefined {
  const v: unknown = Reflect.get(o, 'readyAt');
  return typeof v === 'number' ? v : undefined;
}

/** Not cancelled. */
export function isLive(o: AssocMeal): boolean {
  return !(o.status || '').startsWith('Cancelled');
}

/** How many live orders of an item a date already has (optionally not counting one). */
export function countOf(all: AssocMeal[], date: string, item: string, skipId?: string): number {
  return all.filter((o) => o.date === date && o.item === item && o.id !== skipId && isLive(o)).length;
}

/** Menu order first, then by name. */
export function compareOrders(menuList: AssocMenuItem[]) {
  const rank = (name: string) => {
    const i = menuList.findIndex((m) => m.name === name);
    return i < 0 ? 99 : i;
  };
  return (a: AssocMeal, b: AssocMeal) => rank(a.item) - rank(b.item) || a.associate.localeCompare(b.associate);
}

/** Texts to associates can be switched off in Back Office, Text Messages. */
export function assocTextsOn(): boolean {
  return getSetting<{ on?: boolean } | undefined>('texts.assocChange')?.on !== false;
}
