/**
 * Side work: the small jobs that keep a dining room running (fill the ice
 * bins, roll silverware, break down the coffee station).
 *
 * Each venue has a library of tasks (Back Office, Side Work Tasks). Every
 * day a manager hands them out to whoever is on shift (manager tablet or
 * Back Office, Assign Side Work), and servers tick theirs off on the tablet
 * with the time. Assignments and checks are kept per venue and date, so
 * tomorrow starts fresh.
 *
 * The demo has no scheduling feed, so today's shifts are a sample roster
 * and the screens say so. A server's sign in has no venue behind it, so
 * their list is every task assigned to them today, at any venue.
 */
import { rooms } from '../data';
import { now, today } from '../lib/clock';
import { createSharedStore, useShared } from '../lib/sharedStore';
import { featureOn, useFeatureOn } from './phases';

/** A shift (opening, mid, closing) or a meal (breakfast, lunch, dinner). */
export type SideWorkWhen = 'open' | 'mid' | 'close' | 'B' | 'L' | 'D';

export const SIDE_WORK_WHEN: ReadonlyArray<[SideWorkWhen, string]> = [
  ['open', 'Opening'],
  ['mid', 'Mid'],
  ['close', 'Closing'],
  ['B', 'Breakfast'],
  ['L', 'Lunch'],
  ['D', 'Dinner'],
];

export function whenLabel(when: SideWorkWhen): string {
  return SIDE_WORK_WHEN.find((w) => w[0] === when)?.[1] ?? when;
}

export interface SideWorkTask {
  id: string;
  name: string;
  /** Short instruction. */
  note: string;
  when: SideWorkWhen;
  /** About how long it takes; adds up to each person's load. */
  mins: number | null;
}

/** Minutes typed into a box: empty is "not set", otherwise 0 to 240. */
export function parseTaskMinutes(text: string): number | null {
  const v = text.trim();
  if (v === '') return null;
  return Math.max(0, Math.min(240, Math.round(Number(v)) || 0));
}

/** The starter library every venue opens with until Back Office edits its own. */
const STARTER_TASKS: SideWorkTask[] = [
  { id: 'sw0', name: 'Fill ice bins', note: 'Both bins at the server station, scoop back in its holder', when: 'open', mins: 5 },
  { id: 'sw1', name: 'Set up the coffee station', note: 'Brew regular and decaf, stock cups, lids and stir sticks', when: 'open', mins: 10 },
  { id: 'sw2', name: 'Restock sugar caddies', note: 'Sugar, Splenda, Equal and honey on every table', when: 'open', mins: 10 },
  { id: 'sw3', name: 'Wipe down menus', note: 'Sanitize each menu and pull any that are torn or sticky', when: 'open', mins: 10 },
  { id: 'sw4', name: 'Set out jams and butter', note: 'Jam caddy and butter chips on each breakfast table', when: 'B', mins: 5 },
  { id: 'sw5', name: 'Roll silverware', note: '40 sets: napkin, fork, knife and spoon', when: 'mid', mins: 20 },
  { id: 'sw6', name: 'Refill salt and pepper', note: 'Top off the shakers and wipe the outsides', when: 'mid', mins: 10 },
  { id: 'sw7', name: 'Restock to-go boxes and lids', note: 'Server station and the host stand', when: 'mid', mins: 5 },
  { id: 'sw8', name: 'Pre-set water glasses for dinner', note: 'A glass at every seat, upside down', when: 'D', mins: 10 },
  { id: 'sw9', name: 'Sweep your section', note: 'Under tables and chairs, then the server station', when: 'close', mins: 15 },
  { id: 'sw10', name: 'Wipe chairs and table bases', note: 'Check the seats for spills and crumbs', when: 'close', mins: 15 },
  { id: 'sw11', name: 'Break down the coffee station', note: 'Empty and rinse the pots, wipe the burners', when: 'close', mins: 10 },
  { id: 'sw12', name: 'Restock the server station', note: 'Napkins, straws, condiments and guest checks', when: 'close', mins: 10 },
];

// ─── Who is on shift ─────────────────────────────────────────────────────

export interface ShiftPerson {
  /** Staff initials. */
  id: string;
  name: string;
  first: string;
  title: string;
  /** Minutes after midnight. */
  start: number;
  end: number;
  /** Which shift they work. */
  tag: 'open' | 'mid' | 'close';
  /** Meals their shift covers. */
  meals: Array<'B' | 'L' | 'D'>;
}

/** Today's sample roster: [initials, name, title, venue, start, end]. */
const SAMPLE_SHIFTS: ReadonlyArray<[string, string, string, string, number, number]> = [
  ['SB', 'Sofia Bennett', 'Dining Server', 'sequoia', 360, 870],
  ['RJ', 'Ricardo Juarez', 'Dining Server', 'sequoia', 630, 1140],
  ['AA', 'Adriana Alvarado', 'Dining Server', 'sequoia', 840, 1260],
  ['MG', 'Marisol Garcia', 'Dining Server', 'sequoia', 900, 1290],
  ['MC', 'Maria Chen', 'Hospitality Associate', 'bistro', 660, 1170],
  ['HL', 'Hannah Lowe', 'Host', 'bistro', 960, 1230],
];

/** Venues with side work: every dining room. */
export function sideWorkVenues(): Array<{ id: string; name: string }> {
  return Object.entries(rooms).map(([id, r]) => ({ id, name: r.name }));
}

export function venueName(venue: string): string {
  return rooms[venue]?.name ?? venue;
}

/** Everyone on the sample roster at a venue today, with their shift and meals. */
export function staffOnShift(venue: string): ShiftPerson[] {
  return SAMPLE_SHIFTS.filter((s) => s[3] === venue).map(([id, name, title, , start, end]) => ({
    id,
    name,
    first: name.split(' ')[0],
    title,
    start,
    end,
    tag: start < 600 ? 'open' : end >= 1230 ? 'close' : 'mid',
    meals: [start < 630 && 'B', start < 780 && end > 690 && 'L', start < 1080 && end > 1020 && 'D'].filter(
      (m): m is 'B' | 'L' | 'D' => !!m,
    ),
  }));
}

/** A roster name by initials ("Sofia Bennett"), for people outside the PIN list. */
export function rosterName(staffId: string): string | undefined {
  return SAMPLE_SHIFTS.find((s) => s[0] === staffId)?.[1];
}

/** Is this person on today's roster anywhere? */
export function isOnRoster(staffId: string): boolean {
  return SAMPLE_SHIFTS.some((s) => s[0] === staffId);
}

/** A task belongs to whoever works its shift, or its meal. */
export function fitsShift(task: Pick<SideWorkTask, 'when'>, person: Pick<ShiftPerson, 'tag' | 'meals'>): boolean {
  return task.when === 'open' || task.when === 'mid' || task.when === 'close'
    ? person.tag === task.when
    : person.meals.includes(task.when);
}

/** "6 AM", "2:30 PM" for minutes after midnight. */
export function shiftTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

// ─── State ───────────────────────────────────────────────────────────────

export interface SideWorkCheck {
  at: number;
  /** Staff initials. */
  by: string;
}

export interface SideWorkDay {
  /** Task id → staff initials. */
  asg: Record<string, string>;
  /** Task id → when it was checked off and by whom. */
  done: Record<string, SideWorkCheck>;
}

export interface SideWorkState {
  /** Venue → its library, once Back Office has edited it. */
  libs: Record<string, SideWorkTask[]>;
  /** "venue|2026-10-07" → that day's assignments and checks. */
  days: Record<string, SideWorkDay>;
}

export const sideWorkStore = createSharedStore<SideWorkState>({ libs: {}, days: {} }, {
  persistKey: 'kisco.sideWork.v1',
  channel: 'kisco-side-work',
});

/** "2026-10-07" on the demo clock. */
export function sideWorkDate(d: Date = today()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const dayKey = (venue: string, iso: string) => venue + '|' + iso;

export function libraryFor(state: SideWorkState, venue: string): SideWorkTask[] {
  return state.libs[venue] ?? STARTER_TASKS;
}

export function isLibraryEdited(state: SideWorkState, venue: string): boolean {
  return !!state.libs[venue];
}

/**
 * Sequoia starts today with most tasks handed out and the opener's done,
 * so every screen has something on it. Other venues and days start empty.
 */
export function seedDay(venue: string, iso: string, at: number = now()): SideWorkDay {
  if (venue !== 'sequoia' || iso !== sideWorkDate(new Date(at))) return { asg: {}, done: {} };
  const asg: Record<string, string> = { sw0: 'SB', sw1: 'SB', sw4: 'SB', sw5: 'RJ', sw6: 'RJ', sw8: 'AA', sw9: 'AA', sw11: 'AA', sw10: 'MG' };
  const done: Record<string, SideWorkCheck> = {};
  const checks: Array<[string, string, number, number]> = [
    ['sw0', 'SB', 6, 12],
    ['sw1', 'SB', 6, 25],
    ['sw4', 'SB', 6, 48],
    ['sw5', 'RJ', 11, 5],
  ];
  for (const [task, by, h, m] of checks) {
    const t = new Date(at);
    t.setHours(h, m, 0, 0);
    if (t.getTime() < at) done[task] = { at: t.getTime(), by };
  }
  return { asg, done };
}

export function dayFor(state: SideWorkState, venue: string, iso: string = sideWorkDate()): SideWorkDay {
  return state.days[dayKey(venue, iso)] ?? seedDay(venue, iso);
}

const withDay = (state: SideWorkState, venue: string, iso: string, day: SideWorkDay): SideWorkState => ({
  ...state,
  days: { ...state.days, [dayKey(venue, iso)]: day },
});

/** Give a task to someone, or take it back (staffId null). */
export function withAssignment(state: SideWorkState, venue: string, iso: string, taskId: string, staffId: string | null): SideWorkState {
  const day = dayFor(state, venue, iso);
  const asg = { ...day.asg };
  if (staffId) asg[taskId] = staffId;
  else delete asg[taskId];
  return withDay(state, venue, iso, { ...day, asg });
}

/** Check a task off (with the time) or uncheck it. */
export function withCheck(state: SideWorkState, venue: string, iso: string, taskId: string, by: string, on: boolean, at: number = now()): SideWorkState {
  const day = dayFor(state, venue, iso);
  const done = { ...day.done };
  if (on) done[taskId] = { at, by };
  else delete done[taskId];
  return withDay(state, venue, iso, { ...day, done });
}

/** Take back every assignment; checked off tasks stay with whoever did them. */
export function withCleared(state: SideWorkState, venue: string, iso: string): SideWorkState {
  const day = dayFor(state, venue, iso);
  const asg: Record<string, string> = {};
  for (const [task, who] of Object.entries(day.asg)) if (day.done[task]) asg[task] = who;
  return withDay(state, venue, iso, { ...day, asg });
}

/**
 * Hands out every task nobody on shift has yet, longest first, each to
 * whoever has the fewest minutes so far among the people working the task's
 * shift or meal, or among everyone when no one is.
 */
export function autoAssign(library: SideWorkTask[], people: ShiftPerson[], asg: Record<string, string>): { asg: Record<string, string>; count: number } {
  if (!people.length) return { asg, count: 0 };
  const next = { ...asg };
  const load: Record<string, { n: number; m: number }> = {};
  for (const p of people) load[p.id] = { n: 0, m: 0 };
  for (const t of library) {
    const who = next[t.id];
    if (who && load[who]) {
      load[who].n++;
      load[who].m += t.mins ?? 0;
    }
  }
  const todo = library.filter((t) => !load[next[t.id]]).sort((a, b) => (b.mins ?? 0) - (a.mins ?? 0));
  for (const t of todo) {
    const fit = people.filter((p) => fitsShift(t, p));
    const pool = fit.length ? fit : people;
    const best = [...pool].sort((a, b) => load[a.id].m - load[b.id].m || load[a.id].n - load[b.id].n)[0];
    next[t.id] = best.id;
    load[best.id].n++;
    load[best.id].m += t.mins ?? 0;
  }
  return { asg: next, count: todo.length };
}

export interface MyTask extends SideWorkTask {
  venue: string;
  done: SideWorkCheck | null;
}

/** Everything assigned to a person today, at every venue. */
export function tasksFor(state: SideWorkState, staffId: string, iso: string = sideWorkDate()): MyTask[] {
  return sideWorkVenues().flatMap((v) => {
    const day = dayFor(state, v.id, iso);
    return libraryFor(state, v.id)
      .filter((t) => day.asg[t.id] === staffId)
      .map((t) => ({ ...t, venue: v.id, done: day.done[t.id] ?? null }));
  });
}

// ─── Actions ─────────────────────────────────────────────────────────────

export function assignSideWork(venue: string, taskId: string, staffId: string | null): void {
  sideWorkStore.set((s) => withAssignment(s, venue, sideWorkDate(), taskId, staffId));
}

export function checkSideWork(venue: string, taskId: string, by: string, on: boolean): void {
  sideWorkStore.set((s) => withCheck(s, venue, sideWorkDate(), taskId, by, on));
}

export function clearSideWork(venue: string): void {
  sideWorkStore.set((s) => withCleared(s, venue, sideWorkDate()));
}

/** Auto-assign evenly; returns how many tasks were handed out. */
export function autoAssignSideWork(venue: string): number {
  let count = 0;
  sideWorkStore.set((s) => {
    const iso = sideWorkDate();
    const day = dayFor(s, venue, iso);
    const r = autoAssign(libraryFor(s, venue), staffOnShift(venue), day.asg);
    count = r.count;
    return r.count ? withDay(s, venue, iso, { ...day, asg: r.asg }) : s;
  });
  return count;
}

export function saveSideWorkLibrary(venue: string, library: SideWorkTask[]): void {
  sideWorkStore.set((s) => ({ ...s, libs: { ...s.libs, [venue]: library } }));
}

/** Back to the starter list. */
export function resetSideWorkLibrary(venue: string): void {
  sideWorkStore.set((s) => {
    const libs = { ...s.libs };
    delete libs[venue];
    return { ...s, libs };
  });
}

export function useSideWork(): SideWorkState {
  return useShared(sideWorkStore);
}

/** The Back Office pages that set up side work, with their standard phase (nav.ts). */
export const SIDE_WORK_PAGES = { swLib: 1, swAssign: 1 } as const;

/** Side work is in use while its pages' phase is switched on; otherwise servers never see it. */
export const sideWorkOn = () => featureOn(SIDE_WORK_PAGES);
export const useSideWorkOn = () => useFeatureOn(SIDE_WORK_PAGES);
