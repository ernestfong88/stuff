/**
 * Coursing: which course is next, when it is due to fire, and the timeline
 * of a check's courses (fired, up at the pass, run to the table).
 *
 * Wording follows the room: a course is "fired" to the kitchen, comes "up"
 * at the pass and is "run" to the table. Never "pick up", which already
 * means a takeout order.
 */
import { now } from '../lib/clock';
import { DEFAULT_CONFIG, type CourseMode, type DiningConfig } from './config';
import { isDrink, isSide, itemCourse, itemLabel } from './menu';
import { lineCourse, plateLines } from './orders';
import { foodRoute, isDrinkLine } from './routing';
import type { Diner, Order, OrderLine } from './types';

/** Minutes after the prior course is run before any held course fires anyway. */
export const COURSE_BACKUP_MIN = 15;

/** Dessert's course: it waits for a manual fire or the backup in every mode. */
export const DESSERT_COURSE = 3;

/** All at once: every course but dessert fires the moment it is sent. */
export const firesAtSend = (o: Pick<Order, 'room' | 'meal'>, course: number, cfg: DiningConfig = DEFAULT_CONFIG): boolean =>
  courseMode(o, cfg) === 'off' && course < DESSERT_COURSE;

/** __kHash: small stable string hash, used to spread made-up seed times. */
export function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/** __kCr: a line's course, falling back to the item's own course. */
export function courseNumber(line: Pick<OrderLine, 'course' | 'itemId'>): number {
  return line.course || itemCourse(line.itemId);
}

/** __kCourseMode: the venue's coursing for this check's meal (default "expo"). */
export function courseMode(o: Pick<Order, 'room' | 'meal'> | null | undefined, cfg: DiningConfig = DEFAULT_CONFIG): CourseMode {
  if (!o) return 'expo';
  return cfg.course[o.room]?.[o.meal] ?? 'expo';
}

/**
 * __kCourseDue: whether held course `course` should fire now.
 * @param prev       sent lines of earlier courses (sides and drinks excluded)
 * @param allRun     every one of them is on the table (or cancelled)
 * @param sinceFired ms since the latest of them fired (or the check opened)
 */
export function courseDue(
  o: Order,
  course: number,
  prev: OrderLine[],
  allRun: boolean,
  sinceFired: number,
  cfg: DiningConfig = DEFAULT_CONFIG,
): boolean {
  const mode = courseMode(o, cfg);
  const runAt = prev.length ? Math.max(...prev.map((i) => i.clearedAt || i.firedAt || 0)) : o.openedAt || 0;
  const backup = allRun && now() - runAt >= COURSE_BACKUP_MIN * 60_000;
  // Dessert always waits for a manual fire or the backup, even with All at once.
  if (course >= DESSERT_COURSE) return backup;
  switch (mode) {
    case 'off':
      return true;
    case 'manual':
      return backup;
    case 'timer5':
      return sinceFired >= 5 * 60_000 || backup;
    case 'timer8':
      return sinceFired >= 8 * 60_000 || backup;
    default:
      return allRun;
  }
}

/** Food lines still in play: sent, not comped/cancelled, not a drink or side, not on the table. */
function liveFood(o: Order): OrderLine[] {
  return o.diners.flatMap((d) =>
    d.items.filter(
      (i) =>
        i.sent &&
        !i.comped &&
        !i.cancelled &&
        !isDrinkLine(i, o) &&
        !isSide(i.itemId) &&
        i.kitchenState !== 'cleared',
    ),
  );
}

export interface CourseWork {
  /** The lowest course still out, when all of it is at the pass and can be run. */
  run: number | null;
  /** The lowest held course, which a Fire button would fire. */
  fire: number | null;
  /** Course numbers to hand fireCourseNow for `fire` (a missing course counts as 2 there). */
  fireAs?: number[];
}

/**
 * __kCourseWork. The status line numbers a course with the item's course
 * when a line carries none, but fireCourseNow counts a missing course as 2.
 * The card shows the first numbering and hands fireCourseNow the second, or
 * a seeded table's Fire button would do nothing.
 */
export function courseWork(o: Order): CourseWork {
  const live = liveFood(o);
  if (!live.length) return { run: null, fire: null };
  const lowest = Math.min(...live.map(courseNumber));
  const current = live.filter((i) => courseNumber(i) === lowest);
  const held = live.filter((i) => i.kitchenState === 'scheduled');
  const heldLowest = held.length ? Math.min(...held.map(courseNumber)) : null;
  return {
    run: current.every((i) => i.kitchenState === 'ready') ? lowest : null,
    fire: heldLowest,
    fireAs:
      heldLowest == null
        ? []
        : Array.from(new Set(held.filter((i) => courseNumber(i) === heldLowest).map((i) => i.course || 2))),
  };
}

/** __kLastRun: the highest course on the table and when it got there. */
export function lastRun(o: Order): { c: number; at: number } | null {
  const served = (o.diners ?? []).flatMap((d) =>
    d.items.filter(
      (i) =>
        i.sent &&
        !i.comped &&
        !i.cancelled &&
        !isDrinkLine(i, o) &&
        !isSide(i.itemId) &&
        i.kitchenState === 'cleared',
    ),
  );
  if (!served.length) return null;
  const c = Math.max(...served.map(courseNumber));
  return {
    c,
    at: Math.max(...served.filter((i) => courseNumber(i) === c).map((i) => i.clearedAt || i.firedAt || o.openedAt)),
  };
}

/**
 * __kCheckedIn: the server checked in after that run. One check-in per
 * course run: a later run of the same course (a refire) asks again.
 */
export function checkedIn(o: Order, run: { c: number; at: number } | null): boolean {
  return !!run && (o.checkIns ?? []).some((x) => x.course === run.c && x.at >= run.at);
}

/**
 * __kReadyAt: when a line came up at the pass. Lines the server makes are
 * up when fired. Seeded lines without a recorded time get a believable one
 * (a few minutes after firing, or shortly before being run).
 */
export function lineReadyAt(o: Order, line: OrderLine, cfg: DiningConfig = DEFAULT_CONFIG): number | null {
  if (line.readyAtMs) return line.readyAtMs;
  if (
    line.firedAt &&
    line.kitchenState !== 'cooking' &&
    line.kitchenState !== 'scheduled' &&
    foodRoute(line.itemId, o.room, cfg) !== 'kds'
  )
    return line.firedAt;
  const logged = !!(o.log && o.log.length && (line.firedAt || 0) >= o.log[0].at);
  if (line.kitchenState === 'ready') {
    if (o.readyStampAt) return o.readyStampAt;
    if (logged) return null;
    return Math.min(now() - 30_000, (line.firedAt || o.openedAt) + (5 + (hash(line.id) % 4)) * 60_000);
  }
  if (line.kitchenState === 'cleared' && line.clearedAt && !logged) {
    return Math.max(
      (line.firedAt || line.clearedAt) + 60_000,
      line.clearedAt - (40 + (hash(o.id + '|' + lineCourse(line)) % 110)) * 1000,
    );
  }
  return null;
}

export interface CourseSummary {
  c: number;
  /** Kitchen names of the plates in the course. */
  names: string[];
  /** Some of the course is still held. */
  held: boolean;
  /** Some of it is made on the cook line. */
  kds: boolean;
  fired: number | null;
  ready: number | null;
  run: number | null;
}

/** __kCourses: per course, when it fired, came up and was run (null until all of it has). */
export function courseSummaries(o: Order, cfg: DiningConfig = DEFAULT_CONFIG): CourseSummary[] {
  interface Acc {
    c: number;
    fired: number | null;
    ready: number;
    run: number;
    okReady: boolean;
    okRun: boolean;
    held: boolean;
    kds: boolean;
    names: string[];
  }
  const byCourse: Record<number, Acc> = {};
  for (const d of o.diners ?? []) {
    for (const line of d.items) {
      if (!line.sent || line.drink || line.cancelled || line.comped || isSide(line.itemId) || isDrink(line.itemId)) continue;
      const c = lineCourse(line);
      const x = (byCourse[c] ??= { c, fired: null, ready: 0, run: 0, okReady: true, okRun: true, held: false, kds: false, names: [] });
      x.names.push(itemLabel(line.itemId, cfg));
      if (foodRoute(line.itemId, o.room, cfg) === 'kds') x.kds = true;
      if (line.kitchenState === 'scheduled') {
        x.held = true;
        continue;
      }
      if (line.firedAt) x.fired = x.fired == null ? line.firedAt : Math.min(x.fired, line.firedAt);
      const r = lineReadyAt(o, line, cfg);
      if (r) x.ready = Math.max(x.ready, r);
      else x.okReady = false;
      if (line.kitchenState === 'cleared' && line.clearedAt) x.run = Math.max(x.run, line.clearedAt);
      else x.okRun = false;
    }
  }
  return Object.values(byCourse)
    .sort((a, b) => a.c - b.c)
    .map((x) => ({
      c: x.c,
      names: x.names,
      held: x.held,
      kds: x.kds,
      fired: x.held ? null : x.fired,
      ready: !x.held && x.okReady ? x.ready || null : null,
      run: !x.held && x.okRun ? x.run || null : null,
    }));
}

/** __kCloseIsNext: closing is next once the entrée course (or the last course, with no entrée) is run. */
export function closeIsNext(o: Order, cfg: DiningConfig = DEFAULT_CONFIG): boolean {
  const cs = courseSummaries(o, cfg);
  if (!cs.length) return false;
  const target = cs.find((x) => x.c === 2) ?? cs[cs.length - 1];
  return !!target.run;
}

/**
 * __kFirstSend: sentAt moves on every send, so the first send is the
 * earliest of it, the plates' fire times and any logged send.
 */
export function firstSend(o: Order): number | null {
  const times = [
    o.sentAt,
    ...plateLines(o, true)
      .filter((i) => !i.drink)
      .map((i) => i.firedAt),
    ...(o.log ?? []).filter((e) => e.k === 'send').map((e) => e.at),
  ].filter((t): t is number => !!t);
  return times.length ? Math.min(...times) : null;
}

const normalized = new WeakMap<Order, Order>();

/**
 * __kNorm: fill in times seeded checks never had, for timelines and metrics.
 * Older seeded history has items but no times at all, so its trail is
 * spread across the time between opening and closing. Seeded open checks
 * were opened a minute or less before their first send, so they are given
 * a seat time a few minutes earlier. Cached per order object.
 */
export function normalizeOrder(o: Order): Order {
  const cached = normalized.get(o);
  if (cached) return cached;
  let c = o;
  const lines = (o.diners ?? []).flatMap((d) => d.items);
  if (o.closedAt && lines.length && !lines.some((i) => i.firedAt)) {
    const span = o.closedAt - o.openedAt;
    const send = o.openedAt + Math.min(420_000, span * 0.12);
    const courses = [...new Set(lines.filter((i) => !isSide(i.itemId) && !isDrink(i.itemId)).map(lineCourse))].sort(
      (a, b) => a - b,
    );
    const at: Record<number, { f: number; r: number; u: number }> = {};
    let t = send;
    for (const cc of courses) {
      const take = span * (0.55 / Math.max(1, courses.length));
      const r = t + take * 0.8;
      const u = r + Math.min(150_000, take * 0.1);
      at[cc] = { f: t, r, u };
      t = u + Math.min(240_000, span * 0.05);
    }
    const fallback = at[courses[0]] ?? { f: send, r: send, u: send };
    c = {
      ...o,
      sentAt: send,
      diners: o.diners.map((d) => ({
        ...d,
        items: d.items.map((i) => {
          const x = at[lineCourse(i)] ?? fallback;
          return { ...i, sent: true, firedAt: x.f, readyAtMs: x.r, clearedAt: x.u, kitchenState: 'cleared' as const };
        }),
      })),
    };
  }
  if (!(c.log && c.log.length && c.log[0].k === 'open')) {
    const f = firstSend(c);
    if (f && f - c.openedAt < 150_000) {
      const opened = f - (200 + (hash(String(c.id) + '#seated') % 170)) * 1000;
      c = {
        ...c,
        openedAt: opened,
        drinksAt: c.drinksAt && !c.hostSeated ? c.drinksAt - (c.openedAt - opened) : c.drinksAt,
      };
    }
  }
  normalized.set(o, c);
  return c;
}

/** __kRunsLine: the lines runCourse clears for course c, numbered the way the card does. */
export function runsLine(line: OrderLine, c: number): boolean {
  return (
    line.sent &&
    (line.kitchenState === 'ready' ||
      (isSide(line.itemId) && line.kitchenState !== 'cleared' && line.kitchenState !== 'scheduled')) &&
    (line.course || itemCourse(line.itemId)) === c
  );
}

/**
 * __kSrvItems: who gets what in course c, by seat, before it is run.
 * `cookLine` picks the cook's plates; otherwise the ones the server makes.
 */
export function serverItems(
  o: Order,
  c: number | null,
  cookLine = false,
  cfg: DiningConfig = DEFAULT_CONFIG,
): Array<{ diner: Diner; lines: OrderLine[] }> {
  const by: Array<{ diner: Diner; lines: OrderLine[] }> = [];
  if (c == null) return by;
  for (const d of o.diners ?? []) {
    for (const line of d.items) {
      if (
        line.sent &&
        !line.cancelled &&
        !line.comped &&
        !line.parentId &&
        !isDrinkLine(line, o) &&
        line.kitchenState === 'ready' &&
        courseNumber(line) === c &&
        (foodRoute(line.itemId, o.room, cfg) === 'expo') !== cookLine
      ) {
        let g = by.find((x) => x.diner.id === d.id);
        if (!g) by.push((g = { diner: d, lines: [] }));
        g.lines.push(line);
      }
    }
  }
  return by.sort((a, b) => (a.diner.seat || 0) - (b.diner.seat || 0));
}

/**
 * __kSrvOnly: nothing in course c comes from the cook line or the bar, so
 * Expo has nothing to run and the server marks it served from My Tables.
 */
export function serverOnlyCourse(o: Order, c: number, cfg: DiningConfig = DEFAULT_CONFIG): boolean {
  const lines = (o.diners ?? []).flatMap((d) =>
    d.items.filter(
      (i) =>
        i.sent &&
        !i.cancelled &&
        !i.comped &&
        !isDrinkLine(i, o) &&
        !isSide(i.itemId) &&
        i.kitchenState !== 'cleared' &&
        courseNumber(i) === c,
    ),
  );
  return lines.length > 0 && lines.every((i) => foodRoute(i.itemId, o.room, cfg) === 'expo');
}

/** What undoRunCourse needs to put a mis-tapped "Mark served" back. */
export interface RunUndo {
  c: number;
  at: number;
  /** Lines the run cleared. */
  ran: string[];
  /** Lines held at the tap, with their fire time then. */
  held: Record<string, number | undefined>;
  stamp: number | null | undefined;
}

/** How long a "Mark served" can be undone. */
export const RUN_UNDO_MS = 8000;

/**
 * __kMarkServed (data part): snapshot taken before running course c. Pacing
 * can fire the next held course within seconds of a run, so undo also puts
 * back whatever was held at the tap and has fired since.
 */
export function runUndoSnapshot(o: Order, c: number): RunUndo {
  const ran: string[] = [];
  const held: Record<string, number | undefined> = {};
  for (const d of o.diners ?? [])
    for (const i of d.items) {
      if (runsLine(i, c)) ran.push(i.id);
      if (i.sent && i.kitchenState === 'scheduled') held[i.id] = i.firedAt;
    }
  return { c, at: now(), ran, held, stamp: o.readyStampAt };
}

/** __kSrvUndoFor: the snapshot while it can still be used on this order. */
export function activeRunUndo(o: Order, u: RunUndo | null | undefined): RunUndo | null {
  if (!u || now() - u.at >= RUN_UNDO_MS) return null;
  return o.diners.some((d) => d.items.some((i) => u.ran.includes(i.id) && i.kitchenState === 'cleared')) ? u : null;
}
