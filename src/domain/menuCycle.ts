/**
 * Menu cycles on the calendar: which cycle day a date is, the dates a
 * builder column shows, quarters, and a menu's lifecycle state.
 */
import { addDays, dayStart as dayStartMs, isoOf } from '../lib/dates';
import type { BoMenu, VenueSchedule } from '../store/menuEdits';

export { addDays };

export const DAY_MS = 86_400_000;

/** Local midnight of a time. */
export function dayStart(t: number | Date): Date {
  return new Date(dayStartMs(t));
}

/** "10/7" */
export function monthDay(d: Date): string {
  return d.getMonth() + 1 + '/' + d.getDate();
}

/** "2026-10-07" in local time, for date inputs. */
export const isoDay: (d: Date) => string = isoOf;

/** Parse "2026-10-07" as local midnight. */
export function parseIsoDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

/** The Sunday on or before a date. Menu weeks run Sunday to Saturday, so a cycle's day 1 is always a Sunday. */
export function weekStart(t: number | Date): Date {
  const d = dayStart(t);
  return addDays(d, -d.getDay());
}

/**
 * The demo data is written with today as cycle day 15. Weeks run Sunday to
 * Saturday, so today is really day 15 plus the weekday (day 18 on a
 * Wednesday); the seeded cycle is turned by that many days so today's
 * specials still land on today.
 */
export const SEED_TODAY = 15;
export const seedShift = (at: number) => new Date(at).getDay();
/** A seeded cycle day turned by `shift` days around a cycle of `len` (day 0, every day, stays put). */
export const shiftDay = (d: number, shift: number, len: number) => (d > 0 && len > 0 ? ((d - 1 + shift) % len) + 1 : d);

/**
 * The cycle day (1 to len) a date falls on for a cycle that started on
 * `start` (counted from the Sunday of that week). The cycle repeats, so day
 * len + 1 is day 1 again; dates before the start count backwards around the
 * cycle.
 */
export function cycleDayOn(start: number | null | undefined, len: number, at: number): number | null {
  if (!len || len < 1 || start == null) return null;
  const n = Math.round((dayStart(at).getTime() - weekStart(start).getTime()) / DAY_MS) + 1;
  const r = n % len;
  return r === 0 ? len : r < 0 ? r + len : r;
}

/** Days in a menu's cycle: its set length, or the last day something is placed on. */
export function cycleLength(menu: Pick<BoMenu, 'kind' | 'cycleLen'> | undefined, lastPlacedDay: number): number {
  if (!menu || menu.kind === 'alc') return 0;
  return lastPlacedDay > 0 ? Math.max(menu.cycleLen || 0, lastPlacedDay) : menu.cycleLen || 0;
}

/** What a venue serves at a time: the latest scheduled menu that has started, else its current one. */
export function servingAt(v: VenueSchedule, at: number): { menuId: string | null; start: number | null; upcoming: Array<{ menuId: string; startDt: number }> } {
  const ups = [...(v.upcoming ?? [])].sort((a, b) => a.startDt - b.startDt);
  const started = ups.filter((u) => dayStart(u.startDt).getTime() <= dayStart(at).getTime());
  const last = started[started.length - 1];
  return {
    menuId: last ? last.menuId : v.menuId,
    start: last ? last.startDt : v.menuStartDt,
    upcoming: ups.filter((u) => !started.includes(u)),
  };
}

/** Venues as they stand at a time, with started schedules applied. */
export function venuesAt(venues: VenueSchedule[], at: number): VenueSchedule[] {
  return venues.map((v) => {
    const s = servingAt(v, at);
    return s.menuId === v.menuId && s.upcoming.length === (v.upcoming ?? []).length
      ? v
      : { ...v, menuId: s.menuId, menuStartDt: s.start, upcoming: s.upcoming };
  });
}

export type MenuState = 'draft' | 'scheduled' | 'active' | 'archived';

/**
 * A menu's lifecycle. There is no publish step: a menu is a Draft until it
 * has a start date at a venue, Scheduled until that date, then Active. It is
 * Archived by hand, or once the menu scheduled after it takes over and no
 * venue serves or schedules it any more.
 */
export function menuState(m: BoMenu | undefined, venues: VenueSchedule[]): MenuState {
  if (!m) return 'draft';
  if (m.status === 'archived') return 'archived';
  if (venues.some((v) => v.menuId === m.id || v.alcMenuId === m.id)) return 'active';
  if (venues.some((v) => (v.upcoming ?? []).some((u) => u.menuId === m.id))) return 'scheduled';
  return m.status === 'active' ? 'archived' : 'draft';
}

/** Where a builder's dates come from: a venue's start, or the dates set on the menu. */
export interface CycleAnchor {
  /** The date of cycle day 1 (for the lap of the cycle that is running now when live). */
  start: Date;
  /** Running now: `today` is the cycle day of today. */
  live: boolean;
  today: number | null;
  /** Venue it comes from, when it does. */
  venueName?: string;
}

/**
 * Dates for a menu's builder. Dates moved in the builder win; otherwise the
 * first venue serving it (running ones first, then the earliest scheduled).
 * A running menu dates the lap of the cycle it is in now, so the builder
 * always shows this week.
 */
export function menuAnchor(menu: BoMenu | undefined, venues: VenueSchedule[], len: number, at: number): CycleAnchor | null {
  if (!menu || !(len > 0)) return null;
  const t0 = dayStart(at);
  const fromStart = (start: number, venueName?: string): CycleAnchor => {
    const st = dayStart(start);
    if (st.getTime() <= t0.getTime()) {
      const cd = cycleDayOn(start, len, at) ?? 1;
      return { start: addDays(t0, 1 - cd), live: true, today: cd, venueName };
    }
    return { start: weekStart(st), live: false, today: null, venueName };
  };
  if (menu.startDt) return fromStart(menu.startDt);
  const options: Array<{ a: CycleAnchor; at: number }> = [];
  for (const v of venues) {
    if (v.menuId === menu.id && v.menuStartDt != null) options.push({ a: fromStart(v.menuStartDt, v.name), at: v.menuStartDt });
    for (const u of v.upcoming ?? [])
      if (u.menuId === menu.id) options.push({ a: { start: weekStart(u.startDt), live: false, today: null, venueName: v.name }, at: u.startDt });
  }
  options.sort((x, y) => Number(y.a.live) - Number(x.a.live) || x.at - y.at);
  return options[0]?.a ?? null;
}

/** Date of a cycle day in the builder, or null without an anchor. */
export function dateOfDay(anchor: CycleAnchor | null, day: number): Date | null {
  return anchor && day > 0 ? addDays(anchor.start, day - 1) : null;
}

/** "Wed 10/7", or "Day 7" without dates, or "Any Day". */
export function dayTitle(anchor: CycleAnchor | null, day: number): string {
  if (day === 0) return 'Any Day';
  const d = dateOfDay(anchor, day);
  return d ? d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + monthDay(d) : 'Day ' + day;
}

// ─── Quarters ─────────────────────────────────────────────────────────────

export const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'] as const;

/** Index of a quarter: year * 4 + (quarter - 1). */
export function quarterIndexOf(at: number): number {
  const d = new Date(at);
  return d.getFullYear() * 4 + Math.floor(d.getMonth() / 3);
}

/** "Q4 2026" for a quarter index. */
export function quarterLabel(i: number): string {
  return 'Q' + ((i % 4) + 1) + ' ' + Math.floor(i / 4);
}

export function parseQuarter(q: string | null | undefined): { q: number; y: number; index: number } | null {
  const m = /^Q([1-4]) (\d{4})$/.exec(q ?? '');
  return m ? { q: +m[1], y: +m[2], index: +m[2] * 4 + (+m[1] - 1) } : null;
}

export function quarterSeason(q: string): string {
  const p = parseQuarter(q);
  return p ? SEASONS[p.q - 1] : '';
}

/** "Oct 1 to Dec 31, 2026" */
export function quarterRange(q: string): string {
  const p = parseQuarter(q);
  if (!p) return '';
  const a = new Date(p.y, (p.q - 1) * 3, 1);
  const b = new Date(p.y, p.q * 3, 0);
  const f = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(a)} to ${f(b)}, ${p.y}`;
}

/** Name for a new menu in a quarter: "VT Winter 2027" or "VT Winter 2027 À la Carte". */
export function quarterMenuName(q: string, kind: 'cycle' | 'alc', prefix = 'VT'): string {
  const p = parseQuarter(q);
  if (!p) return kind === 'alc' ? 'Untitled à la carte menu' : 'Untitled menu cycle';
  return `${prefix} ${SEASONS[p.q - 1]} ${p.y}${kind === 'alc' ? ' À la Carte' : ''}`;
}

/** A name no other menu has: the name, else "<name> (draft)", "<name> (draft 2)" ... */
export function uniqueMenuName(name: string, menus: Array<{ name: string }>): string {
  const taken = new Set(menus.map((m) => m.name.trim().toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 1; ; n++) {
    const next = `${name} (draft${n > 1 ? ' ' + n : ''})`;
    if (!taken.has(next.toLowerCase())) return next;
  }
}

/** Quarters to offer in pickers: last year to next year, then Year-round. */
export function quarterOptions(at: number): string[] {
  const y = new Date(at).getFullYear();
  const out: string[] = [];
  for (let yy = y - 1; yy <= y + 1; yy++) for (let q = 1; q <= 4; q++) out.push(`Q${q} ${yy}`);
  return [...out, 'Year-round'];
}
