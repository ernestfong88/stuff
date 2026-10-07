/**
 * Demo clock.
 *
 * The seed data is written relative to "now" (a check opened 12 minutes ago,
 * a pick up due in 16 minutes). The original mockup used the real wall clock,
 * so opening it at 4 AM showed a dinner service at 4 AM. Here the app runs on
 * a clock that is anchored to a believable service time on today's date and
 * then ticks forward in real time.
 *
 *   ?clock=real        use the device clock
 *   ?clock=18:15       anchor the service clock at 6:15 PM today
 *
 * The offset is kept in localStorage per calendar day so every open tab (the
 * server tablet, the kitchen screen, expo) agrees on the time.
 */
import { safeStorage } from './storage';

const KEY = 'kisco_clock_offset';
const DEFAULT_ANCHOR = '17:45';

function anchorFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('clock');
  } catch {
    return null;
  }
}

function computeOffset(): number {
  const param = anchorFromUrl();
  if (param === 'real') return 0;
  const real = Date.now();
  const today = new Date(real).toDateString();
  const anchor = param ?? DEFAULT_ANCHOR;
  if (!param) {
    const saved = safeStorage.getJSON<{ day: string; offset: number }>(KEY);
    if (saved && saved.day === today) return saved.offset;
  }
  const m = /^(\d{1,2}):(\d{2})$/.exec(anchor);
  if (!m) return 0;
  const target = new Date(real);
  target.setHours(+m[1], +m[2], 0, 0);
  const offset = target.getTime() - real;
  if (!param) safeStorage.setJSON(KEY, { day: today, offset });
  return offset;
}

let offset = typeof window === 'undefined' ? 0 : computeOffset();

/** Current time in ms on the demo clock. Use instead of Date.now(). */
export function now(): number {
  return Date.now() + offset;
}

/** Current time as a Date on the demo clock. Use instead of new Date(). */
export function today(): Date {
  return new Date(now());
}

/** Tests and the back office "reset demo" can pin the clock. */
export function setClockOffset(ms: number): void {
  offset = ms;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Whole minutes elapsed since ts (never negative). */
export function minutesSince(ts: number | null | undefined): number {
  if (!ts) return 0;
  return Math.max(0, Math.floor((now() - ts) / MINUTE));
}

/** Start of the demo day (local midnight) in ms. */
export function startOfToday(): number {
  const d = today();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
