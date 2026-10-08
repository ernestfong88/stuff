/**
 * The associate meal program as the manager sees it: the same windows, menu,
 * special limits and cutoff as the Associate App.
 *
 * The menu itself (the chef's special per meal period and the standing
 * choices, from src/store/assocMenu) is the same one the app shows. Orders
 * close 45 minutes before their
 * pickup window; a manager can still add or change after the cutoff, but
 * only with a reason, which goes in the order's log.
 */
import { rooms } from '../../../data';
import type { AssocMeal } from '../../../domain/types';
import { isoDate } from '../../../domain/pickup';
import { DAY, MINUTE, startOfToday } from '../../../lib/clock';
import { formatMinuteOfDay } from '../../../lib/format';
import type { AssocMealKind } from '../../../domain/assocMeals/menu';
import { assocMenuSettings } from '../../../store/assocMenu';
import { getSetting } from '../../../store/serviceConfig';

/** How long before a window orders close. */
export const CUTOFF_MIN = 45;

/** Associates in the meal program (the Associate App's roster). */
export const PROGRAM_NAMES = ['Jordan Reyes', 'Maria Lopez', 'Devon Carter', 'Priya Nair', 'Tom Ellis', 'Grace Kim', 'Luis Ortega'];

export type { AssocMealKind };

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
export const minutesLabel = formatMinuteOfDay;

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

/** The dining room associates pick up from (Back Office, Associate Meals). */
export function assocRoom(): string {
  return assocMenuSettings().venue;
}

export function assocVenueName(): string {
  return rooms[assocRoom()]?.name ?? '';
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
  // Associate Meals settings' cutoff (am.cut), the same one the server tablet and the Associate App use.
  const cut = Number(getSetting('am.cut') ?? CUTOFF_MIN);
  return (isNoc(w) ? Math.min(at, windowAt(date, minutesLabel(nocBy))) : at) - (Number.isFinite(cut) ? cut : CUTOFF_MIN) * MINUTE;
}

/** Still open up to and including the cutoff minute, as on the server tablet and the kiosk (5:45 can still book 6:30). */
export function windowOpen(date: string, w: string, at: number): boolean {
  return at <= windowCloseAt(date, w);
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

/** Texts to associates can be switched off in Back Office, Text Messages. */
export function assocTextsOn(): boolean {
  return getSetting<{ on?: boolean } | undefined>('texts.assocChange')?.on !== false;
}

export interface OrderFormState {
  /** Changing an existing order, so the name and meal are already set. */
  editing: boolean;
  name: string;
  item: string;
  /** The associate already has this meal today. */
  taken: boolean;
  /** The first choice group still to pick, e.g. "Side". */
  missingGroup?: string | null;
  overCutoff: boolean;
  reason: string;
}

/**
 * What still stops the order form from saving, in the order the manager
 * fills it in, or null when nothing is left to fill in. A name that already
 * has the meal gets its own warning, so it says nothing here.
 */
export function orderFormTodo(f: OrderFormState): string | null {
  if (!f.editing && !f.name.trim()) return 'Type the associate’s name.';
  if (!f.editing && f.taken) return null;
  if (!f.item) return 'Pick a meal.';
  if (f.missingGroup) return `Pick a ${f.missingGroup.toLowerCase()}.`;
  if (f.overCutoff && !f.reason.trim()) return 'Add a reason for the override.';
  return null;
}

/** The form can save once nothing is left to fill in and the name is free. */
export function orderFormReady(f: OrderFormState): boolean {
  return !orderFormTodo(f) && (f.editing || !f.taken);
}

// ─── The manager's pick up board ─────────────────────────────────────────

/** Where an order is, as the manager reads it. */
export type AssocOrderStatus = 'planned' | 'kitchen' | 'ready' | 'picked' | 'cancelled';

export const STATUS_LABEL: Record<AssocOrderStatus, string> = {
  planned: 'Planned',
  kitchen: 'In kitchen',
  ready: 'Ready',
  picked: 'Picked up',
  cancelled: 'Cancelled',
};

/** When expo fired the meal; the shared AssocMeal type does not carry it. */
function firedAtOf(o: AssocMeal): number | undefined {
  const v: unknown = Reflect.get(o, 'firedAt');
  return typeof v === 'number' ? v : undefined;
}

export function orderStatus(o: AssocMeal): AssocOrderStatus {
  if (!isLive(o)) return 'cancelled';
  if (o.status === 'Picked up') return 'picked';
  if (readyAtOf(o)) return 'ready';
  if (firedAtOf(o)) return 'kitchen';
  return 'planned';
}

/** Staff mark associate pick ups collected unless Back Office says a meal is done once set out (same switch as Expo). */
export function assocTracksPickup(): boolean {
  return getSetting<Record<string, boolean> | undefined>('pud.track')?.[assocRoom()] !== false;
}

/** The meal the manager is working now: the first pick up range that has not ended yet, else the last one. */
export function mealNow(windows: AssocWindow[], at: number, endOf: (w: string) => number): AssocMealKind {
  return (windows.find((x) => endOf(x.w) >= at) ?? windows[windows.length - 1])?.meal ?? 'Lunch';
}

export interface PickupGroup {
  /** Start of the pick up range, "5:30 PM". */
  w: string;
  orders: AssocMeal[];
}

/**
 * One meal's orders for the manager: those still to hand over, grouped by
 * pick up range in time order, and the rest (cancelled, picked up, or a
 * range that has ended with nothing waiting at the pass) in one list.
 */
export function pickupBoard(
  orders: AssocMeal[],
  meal: AssocMealKind,
  at: number,
  endOf: (w: string) => number,
  tracksPickup: boolean,
): { now: PickupGroup[]; earlier: AssocMeal[] } {
  const byTime = (a: AssocMeal, b: AssocMeal) =>
    (windowMinutes(a.window) ?? 0) - (windowMinutes(b.window) ?? 0) || a.associate.localeCompare(b.associate);
  const mine = orders.filter((o) => mealOfWindow(o.window) === meal).sort(byTime);
  const done = (o: AssocMeal) => {
    const st = orderStatus(o);
    if (st === 'cancelled' || st === 'picked') return true;
    // A meal set out and waiting stays up front while staff mark pick ups.
    return endOf(o.window) < at && !(st === 'ready' && tracksPickup);
  };
  const now: PickupGroup[] = [];
  for (const o of mine.filter((x) => !done(x))) {
    const last = now[now.length - 1];
    if (last?.w === o.window) last.orders.push(o);
    else now.push({ w: o.window, orders: [o] });
  }
  return { now, earlier: mine.filter(done) };
}
