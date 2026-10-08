/**
 * Cleaning log: each kitchen's daily and weekly cleaning tasks, who each is
 * assigned to, and who signed it off with their PIN.
 *
 * Back Office (Cleaning Log) keeps the task list per kitchen and reads the
 * log a week at a time; Production Prep shows today's daily tasks and this
 * week's weekly ones, and a cook signs each off with their PIN. Kitchens are
 * the production venues (Sequoia, Evergreen, The Bistro).
 *
 * ── Reading (pure; pass the state from useCleaning()) ────────────────────
 *   cleaningTasksFor(state, venueId) → CleaningTask[]   (+ isCleaningEdited)
 *   cleaningSign(state, venueId, task, iso, at?) → CleaningSignOff | null   (iso: any date in the task's period)
 *   kitchenCrew() → CrewMember[], crewMember(staffId)
 *
 * ── Writing (sync to every open tab) ─────────────────────────────────────
 *   setCleaningTasks(venueId, tasks | null)       (null restores the starter list)
 *   signCleaning(venueId, task, iso, staffId, name)
 *   unsignCleaning(venueId, task, iso)
 *   resetCleaning()
 *
 * Seed sign-offs (the last four weeks of the starter tasks) come from the
 * demo clock and never show a time later than now.
 */
import {
  addDays,
  dateOf,
  isoOf,
  periodOf,
  shortName,
  weekOf,
  weeklyDueDate,
  type CleaningSignOff,
  type CleaningTask,
  type CleaningWhen,
} from '../domain/cleaning';
import { now } from '../lib/clock';
import { createSharedStore, useShared } from '../lib/sharedStore';
import { ADP_ASSOCIATES } from '../surfaces/backoffice/seed/associates';
import { seedHash } from './production';

// ─── Who can be assigned ─────────────────────────────────────────────────

export interface CrewMember {
  id: string;
  name: string;
  /** "T. Reyes". */
  short: string;
  title: string;
}

/** Kitchen staff on Associates & PINs who sign in with a PIN, so they can sign their work off. */
export function kitchenCrew(): CrewMember[] {
  return ADP_ASSOCIATES.filter((a) => a.pin && /cook|chef|dish/i.test(a.title)).map((a) => ({
    id: a.id,
    name: a.name,
    short: shortName(a.name),
    title: a.title,
  }));
}

export function crewMember(staffId: string | null | undefined): CrewMember | undefined {
  return staffId ? kitchenCrew().find((c) => c.id === staffId) : undefined;
}

// ─── Starter tasks ───────────────────────────────────────────────────────

/** [text, daily when or weekly day (0 Sunday), assigned to (staff id)]. */
const STARTER: Array<[string, CleaningWhen | number, string | null]> = [
  ['Check and log walk-in and reach-in temperatures', 'open', 'OD'],
  ['Set up sanitizer buckets and test the strips', 'open', null],
  ['Sanitize prep tables and cutting boards', 'open', null],
  ['Wipe down the slicer after the deli set', 'mid', null],
  ['Break down and clean the slicer', 'close', 'TR'],
  ['Label, date and rotate leftovers, and toss anything expired', 'close', 'GK'],
  ['Clean reach-in gaskets and shelves', 'close', null],
  ['Drain and clean the steam table wells', 'close', null],
  ['Sweep and mop the prep area', 'close', 'JB'],
  ['Log closing temperatures', 'close', null],
  ['Delime the dish machine', 1, 'JB'],
  ['Clean the hood filters', 2, 'TR'],
  ['Deep-clean the walk-in shelves', 3, 'OD'],
  ['Clean and sanitize the ice machine', 4, null],
  ['Deep-clean the ovens', 5, 'GK'],
  ['Scrub the floor drains', 6, 'JB'],
];

export function starterCleaningTasks(): CleaningTask[] {
  return STARTER.map(([text, when, assignee], i) =>
    typeof when === 'number'
      ? { id: `cl${i}`, text, freq: 'weekly', when: 'close', day: when, assignee }
      : { id: `cl${i}`, text, freq: 'daily', when, day: 1, assignee },
  );
}

// ─── Store ───────────────────────────────────────────────────────────────

type StoredSign = CleaningSignOff | { off: true };

export interface CleaningState {
  /** Back Office edits; a kitchen without one uses the starter list. */
  tasks: Record<string, CleaningTask[]>;
  /** "venue|period|taskId" → the sign-off; `{off: true}` records an un-signed seed one. */
  signs: Record<string, StoredSign>;
}

export const cleaningStore = createSharedStore<CleaningState>(() => ({ tasks: {}, signs: {} }), {
  persistKey: 'kisco_cleaning_v1',
  channel: 'kisco-cleaning',
});

export function useCleaning(): CleaningState {
  return useShared(cleaningStore);
}

export function resetCleaning(): void {
  cleaningStore.reset();
}

export function cleaningTasksFor(state: CleaningState, venueId: string): CleaningTask[] {
  return state.tasks[venueId] ?? starterCleaningTasks();
}

export function isCleaningEdited(state: CleaningState, venueId: string): boolean {
  return venueId in state.tasks;
}

export function setCleaningTasks(venueId: string, tasks: CleaningTask[] | null): void {
  cleaningStore.set((s) => {
    const next = { ...s.tasks };
    if (tasks) next[venueId] = tasks;
    else delete next[venueId];
    return { ...s, tasks: next };
  });
}

const signKey = (venueId: string, period: string, taskId: string) => `${venueId}|${period}|${taskId}`;

/** The weekly task left undone this week, so the demo shows one overdue (today's is left to do too). */
const SEED_OVERDUE = 'cl12';
const START: Record<CleaningWhen, number> = { open: 6 * 60 + 5, mid: 13 * 60 + 20, close: 20 * 60 + 25 };

/**
 * The crew's sign-offs on the starter tasks over this week and the three
 * before: nearly every daily task, now and then one missed; weekly tasks on
 * their day, with one left overdue this week and today's still to do. Only
 * up to now.
 */
function seedSign(venueId: string, task: CleaningTask, period: string, at: number): CleaningSignOff | null {
  const m = /^cl(\d+)$/.exec(task.id);
  if (!m) return null;
  const todayIso = isoOf(new Date(at));
  const thisWeek = weekOf(todayIso);
  if (period < addDays(thisWeek, -21) || period > todayIso) return null;
  const h = seedHash(task.id + period + venueId);
  let day: string;
  let mins: number;
  if (task.freq === 'daily') {
    if (period < todayIso && h % 23 === 0) return null;
    day = period;
    mins = START[task.when] + +m[1] * 6 + (h % 5);
  } else {
    day = weeklyDueDate(task, period);
    if (period === thisWeek ? task.id === SEED_OVERDUE || day === todayIso : h % 7 === 0) return null;
    mins = 14 * 60 + 10 + (h % 40);
  }
  const d = dateOf(day);
  d.setMinutes(mins);
  if (d.getTime() > at) return null;
  const crew = kitchenCrew();
  // The assignee, unless someone covered for them now and then.
  const who = (task.assignee && h % 9 !== 0 && crew.find((c) => c.id === task.assignee)) || crew[(h >> 2) % crew.length];
  return who ? { staffId: who.id, by: who.short, at: d.getTime() } : null;
}

/** The sign-off on a task for the day (daily) or week (weekly) that `iso` falls in. */
export function cleaningSign(state: CleaningState, venueId: string, task: CleaningTask, iso: string, at = now()): CleaningSignOff | null {
  const period = periodOf(task, iso);
  const stored = state.signs[signKey(venueId, period, task.id)];
  if (stored) return 'off' in stored ? null : stored;
  return seedSign(venueId, task, period, at);
}

/** Sign a task off for the day or week of `iso`, as the person whose PIN was entered. */
export function signCleaning(venueId: string, task: CleaningTask, iso: string, staffId: string, name: string): void {
  const sign: CleaningSignOff = { staffId, by: shortName(name), at: now() };
  cleaningStore.set((s) => ({ ...s, signs: { ...s.signs, [signKey(venueId, periodOf(task, iso), task.id)]: sign } }));
}

export function unsignCleaning(venueId: string, task: CleaningTask, iso: string): void {
  cleaningStore.set((s) => ({ ...s, signs: { ...s.signs, [signKey(venueId, periodOf(task, iso), task.id)]: { off: true } } }));
}
