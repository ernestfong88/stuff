/**
 * The app's clock. It runs on the device's real time.
 *
 * The seed data is written relative to "now" (a check opened 12 minutes ago,
 * a pick up due in 16 minutes), so it looks right at any hour. To show a
 * particular service, pin the clock with the URL:
 *
 *   ?clock=18:15       run the clock from 6:15 PM today
 *   ?clock=real        the device clock (the default)
 *
 * A pinned clock is kept in localStorage per calendar day so every open tab
 * (the server tablet, the kitchen screen, expo) agrees on the time; opening
 * the app with ?clock=real goes back to real time.
 */
import { safeStorage } from './storage';

const KEY = 'kisco_clock_offset';

function anchorFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('clock');
  } catch {
    return null;
  }
}

function computeOffset(): number {
  const param = anchorFromUrl();
  const real = Date.now();
  const today = new Date(real).toDateString();
  if (param === 'real') {
    safeStorage.remove(KEY);
    return 0;
  }
  if (!param) {
    // Another tab pinned the clock today: keep in step with it.
    // (Offsets saved before the clock went real-time have no `pinned` and are ignored.)
    const saved = safeStorage.getJSON<{ day: string; offset: number; pinned?: boolean }>(KEY);
    return saved?.pinned && saved.day === today ? saved.offset : 0;
  }
  const m = /^(\d{1,2}):(\d{2})$/.exec(param);
  if (!m) return 0;
  const target = new Date(real);
  target.setHours(+m[1], +m[2], 0, 0);
  const offset = target.getTime() - real;
  safeStorage.setJSON(KEY, { day: today, offset, pinned: true });
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
