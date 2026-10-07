/**
 * Expo's tickets: one per check, with every course on it and its state,
 * so expo sees what is coming as well as what is going out. Only the course
 * going out, or the one expo can fire, is at full strength.
 *
 * Late is the cook line's ten minutes on the fire, five minutes sitting
 * ready at the pass, or a held course left unfired too long (thresholds
 * from POS Settings). Pick up and delivery go out together, as
 * one course.
 */
import { isSide } from '../../domain/menu';
import type { Diner, Order, OrderLine } from '../../domain/types';

export interface ExpoLine extends OrderLine {
  dinerId: string;
  diner: Diner;
  /** Course number on this ticket (always 1 for pick up and delivery). */
  course: number;
}

export interface ExpoTicket {
  id: string;
  order: Order;
  /** Plates not yet on the table. */
  lines: ExpoLine[];
  /** Every plate, run ones included. */
  allLines: ExpoLine[];
  firedAt: number;
}

export type ExpoFilter = 'all' | 'tables' | 'pickup' | 'delivery' | 'progress' | 'unfired';

/**
 * In the order a ticket moves: not fired, in progress, then ready to go out.
 * The three "ready" lists only hold tickets whose course is up at the pass.
 */
export const EXPO_FILTERS: ReadonlyArray<{ id: ExpoFilter; label: string; ready?: boolean }> = [
  { id: 'all', label: 'All active' },
  { id: 'unfired', label: 'Not fired' },
  { id: 'progress', label: 'In progress' },
  { id: 'tables', label: 'Tables', ready: true },
  { id: 'pickup', label: 'Pick up', ready: true },
  { id: 'delivery', label: 'Delivery', ready: true },
];

export interface Thresholds {
  /** Minutes a plate may cook. */
  cookLate: number;
  /** Minutes a ready course may sit at the pass. */
  expoPass: number;
  /** Minutes a held course may wait to be fired. */
  fireLate: number;
}

const MIN = 60_000;

/** Promise order: ASAP first, then promised time, then tables by when they fired. */
function promiseRank(o: Order, firedAt: number): number {
  if (o.readyAt === 'ASAP') return 0;
  const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(o.readyAt ?? '');
  if (m) return ((+m[1] % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + +m[2];
  return 100_000 + firedAt / MIN;
}

export function buildExpoTickets(orders: readonly Order[]): ExpoTicket[] {
  return orders
    .flatMap((o) => {
      const allLines: ExpoLine[] = o.diners.flatMap((d) =>
        d.items
          .filter((i) => i.sent && !i.comped && !i.cancelled && !i.drink && !isSide(i.itemId))
          .map((i) => ({ ...i, dinerId: d.id, diner: d, course: o.queueType ? 1 : i.course || 2 })),
      );
      const lines = allLines.filter((i) => i.kitchenState !== 'cleared');
      if (!lines.length) return [];
      const firedAt = Math.min(...lines.map((l) => l.firedAt || o.openedAt));
      return [{ id: o.id, order: o, lines, allLines, firedAt }];
    })
    .sort((a, b) => promiseRank(a.order, a.firedAt) - promiseRank(b.order, b.firedAt) || a.firedAt - b.firedAt);
}

// ─── Courses ─────────────────────────────────────────────────────────────

/** The lowest course still to go out, or null. */
export function currentCourse(lines: readonly ExpoLine[]): number | null {
  const open = lines.filter((l) => l.kitchenState !== 'cleared');
  return open.length ? Math.min(...open.map((l) => l.course)) : null;
}

export function courseLines(lines: readonly ExpoLine[], c: number): ExpoLine[] {
  return lines.filter((l) => l.course === c && l.kitchenState !== 'cleared');
}

/** Every plate of the current course is up at the pass. */
export function courseIsReady(lines: readonly ExpoLine[]): boolean {
  const c = currentCourse(lines);
  if (c == null) return false;
  const cl = courseLines(lines, c);
  return cl.length > 0 && cl.every((l) => l.kitchenState === 'ready');
}

/** Nothing has fired yet: every plate is held for its course. */
export const isUnfired = (t: ExpoTicket) => t.lines.every((l) => l.kitchenState === 'scheduled');

/** The lowest held course of the check, or null. */
export function nextHeldCourse(o: Order): number | null {
  const held = o.diners.flatMap((d) => d.items).filter((i) => i.sent && i.kitchenState === 'scheduled');
  return held.length ? Math.min(...held.map((i) => i.course || 2)) : null;
}

/** The course expo can fire now: the next held one, when nothing is on the line or at the pass. */
export function fireableCourse(t: ExpoTicket): number | null {
  return t.lines.some((l) => l.kitchenState === 'cooking' || l.kitchenState === 'ready') ? null : nextHeldCourse(t.order);
}

export type CourseState = 'done' | 'ready' | 'fired' | 'holding';

export function courseState(lines: readonly ExpoLine[]): CourseState {
  if (lines.every((l) => l.kitchenState === 'cleared')) return 'done';
  if (lines.every((l) => l.kitchenState === 'ready' || l.kitchenState === 'cleared')) return 'ready';
  if (lines.some((l) => l.kitchenState === 'cooking')) return 'fired';
  return 'holding';
}

/** Every course on the ticket, in order, with its plates. */
export function ticketCourses(t: ExpoTicket): Array<{ course: number; lines: ExpoLine[]; state: CourseState }> {
  const nums = [...new Set(t.allLines.map((l) => l.course))].sort((a, b) => a - b);
  return nums.map((course) => {
    const lines = t.allLines.filter((l) => l.course === course);
    return { course, lines, state: courseState(lines) };
  });
}

// ─── Late, state and the one thing to do ─────────────────────────────────

export function isLate(t: ExpoTicket, at: number, th: Thresholds): boolean {
  const o = t.order;
  if (t.lines.some((l) => l.rush && l.kitchenState === 'cooking')) return true;
  if (t.lines.some((l) => l.kitchenState === 'cooking' && at - (l.firedAt || o.openedAt) >= th.cookLate * MIN)) return true;
  if (o.readyStampAt && at - o.readyStampAt >= th.expoPass * MIN) return true;
  const busy = t.lines.some((l) => l.kitchenState === 'cooking' || l.kitchenState === 'ready');
  if (busy || nextHeldCourse(o) == null) return false;
  if (o.fireAtTs) return at >= o.fireAtTs + th.fireLate * MIN;
  const cleared = t.allLines.flatMap((l) => (l.clearedAt ? [l.clearedAt] : []));
  const since = cleared.length ? Math.max(...cleared) : o.openedAt;
  return at - since >= th.fireLate * MIN;
}

export type TicketState = 'late' | 'ready' | 'holding' | 'fired';

export const TICKET_STATE_LABEL: Record<TicketState, string> = { late: 'Late', ready: 'Ready', holding: 'Holding', fired: 'Fired' };

export function ticketState(t: ExpoTicket, at: number, th: Thresholds): TicketState {
  if (isLate(t, at, th)) return 'late';
  if (courseIsReady(t.lines)) return 'ready';
  return fireableCourse(t) != null ? 'holding' : 'fired';
}

export type ExpoAction =
  | { kind: 'fire'; course: number }
  | { kind: 'run'; course: number }
  | { kind: 'bump'; course: number }
  | { kind: 'handOff'; notified: boolean }
  | { kind: 'ready'; lineIds: string[]; course: number }
  | { kind: 'waiting' };

/** The one action a ticket's footer offers. */
export function expoAction(t: ExpoTicket): ExpoAction {
  const fire = fireableCourse(t);
  if (fire != null) return { kind: 'fire', course: fire };
  const c = currentCourse(t.lines);
  if (c != null && courseIsReady(t.lines)) {
    if (t.order.queueType) return { kind: 'handOff', notified: !!t.order.notified };
    return t.lines.some((l) => l.course > c) ? { kind: 'run', course: c } : { kind: 'bump', course: c };
  }
  const cooking = t.lines.filter((l) => l.kitchenState === 'cooking');
  if (cooking.length && c != null) return { kind: 'ready', lineIds: cooking.map((l) => l.id), course: c };
  return { kind: 'waiting' };
}

/** Lines the bump bar walks: the plates cooking or up at the pass. */
export const activeLines = (t: ExpoTicket) => t.lines.filter((l) => l.kitchenState === 'cooking' || l.kitchenState === 'ready');

// ─── Filters ─────────────────────────────────────────────────────────────

export function filterTickets(tickets: readonly ExpoTicket[], at: number): Record<ExpoFilter, ExpoTicket[]> {
  const ready = (t: ExpoTicket) => courseIsReady(t.lines);
  const byReadyStamp = (a: ExpoTicket, b: ExpoTicket) => (a.order.readyStampAt || at) - (b.order.readyStampAt || at);
  return {
    all: tickets.filter((t) => !(t.order.fireAtTs && t.order.fireAtTs > at && isUnfired(t))),
    tables: tickets.filter((t) => ready(t) && !t.order.queueType).sort(byReadyStamp),
    pickup: tickets.filter((t) => ready(t) && t.order.queueType === 'pickup').sort(byReadyStamp),
    delivery: tickets.filter((t) => ready(t) && t.order.queueType === 'delivery').sort(byReadyStamp),
    progress: tickets.filter((t) => !ready(t) && !isUnfired(t)),
    unfired: tickets.filter(isUnfired),
  };
}

/** The course the runner copy prints: the one going out, else the one to fire, else the next. */
export function printCourse(t: ExpoTicket): number {
  const c = currentCourse(t.lines) ?? fireableCourse(t);
  if (c != null) return c;
  const courses = ticketCourses(t);
  const open = courses.filter((x) => x.state !== 'done').map((x) => x.course);
  return open.length ? Math.min(...open) : Math.max(...courses.map((x) => x.course));
}
