/**
 * The cook line's tickets: one per check and course, holding the plates
 * the cook makes for this screen.
 *
 * - Only food the cook line makes (route "kds") that has fired and is not
 *   on the table yet. What the server makes skips the cook.
 * - Each entree carries its diner's sides, so the plate reads as one dish.
 *   A side the cook makes shows as its own line only when no entree it
 *   belongs to is on the same screen.
 * - With an expo station, a ticket leaves the line once every plate on it
 *   is up; without one the cook clears it too.
 * - Remakes on the fire jump the queue; otherwise oldest fired first.
 */
import { getItem } from '../../data';
import type { DiningConfig } from '../../domain/config';
import { defaultSides, isSide } from '../../domain/menu';
import { lineFoodRoute } from '../../domain/routing';
import type { Diner, Order, OrderLine } from '../../domain/types';

export interface CookLine extends OrderLine {
  dinerId: string;
  diner: Diner;
  /** The diner's sent sides that go with this plate. */
  sideLines: OrderLine[];
  /** Screens ("room:index") the plate shows on. */
  screens: string[];
}

export interface CookTicket {
  /** "<orderId>#<course>" */
  id: string;
  orderId: string;
  order: Order;
  /** Course number; 1 for pick up and delivery, which go out together. */
  course: number;
  lines: CookLine[];
  firedAt: number;
}

export interface CookTicketOptions {
  /** This device's screen key, or "all". */
  screen: string;
  /** An expo station runs this kitchen's tickets (a flag for every kitchen, or per kitchen). */
  expoActive: boolean | ((room: string) => boolean);
  cfg: DiningConfig;
  /** The screens a dish shows on in a kitchen. */
  screensOf: (itemId: string, room: string) => string[];
}

const DEFAULT_ROOM = 'sequoia';

/** Does an expo station take this kitchen's tickets once they are up? */
export const expoFor = (opts: Pick<CookTicketOptions, 'expoActive'>, room: string | undefined): boolean =>
  typeof opts.expoActive === 'function' ? opts.expoActive(room || DEFAULT_ROOM) : opts.expoActive;

export const onScreen = (line: CookLine, screen: string) => screen === 'all' || line.screens.includes(screen);

const onLine = (i: OrderLine) => i.sent && !i.comped && i.kitchenState !== 'scheduled' && i.kitchenState !== 'cleared';

function dinerLines(o: Order, d: Diner, opts: CookTicketOptions): CookLine[] {
  const room = o.room || DEFAULT_ROOM;
  // Sides follow their plate: those of a dish the server makes never reach the line.
  const cooked = (i: OrderLine) => onLine(i) && lineFoodRoute(i, d.items, o.room, opts.cfg) === 'kds';
  const sides = d.items.filter((i) => i.sent && !i.comped && isSide(i.itemId));
  const mains: CookLine[] = d.items
    .filter((i) => cooked(i) && !isSide(i.itemId))
    .map((i) => ({
      ...i,
      dinerId: d.id,
      diner: d,
      sideLines: sides.filter((x) => !x.parentId || x.parentId === i.id),
      screens: opts.screensOf(i.itemId, room),
    }));
  const ownSides: CookLine[] = d.items
    .filter((i) => cooked(i) && isSide(i.itemId))
    .flatMap((i) => {
      const screens = opts.screensOf(i.itemId, room);
      const carried = mains.some((m) => (!i.parentId || i.parentId === m.id) && m.screens.some((s) => screens.includes(s)));
      return carried ? [] : [{ ...i, dinerId: d.id, diner: d, sideLines: [], screens }];
    });
  return [...mains, ...ownSides];
}

const rushOnFire = (t: CookTicket) => t.lines.some((l) => l.rush && l.kitchenState === 'cooking');

export function buildCookTickets(orders: readonly Order[], opts: CookTicketOptions): CookTicket[] {
  return orders
    .flatMap((o) => {
      const lines = o.diners.flatMap((d) => dinerLines(o, d, opts));
      const courseOf = (l: CookLine) => (o.queueType ? 1 : l.course || 2);
      const courses = [...new Set(lines.map(courseOf))].sort((a, b) => a - b);
      return courses.map((course) => {
        const own = lines.filter((l) => courseOf(l) === course);
        return {
          id: o.id + '#' + course,
          orderId: o.id,
          order: o,
          course,
          lines: own,
          firedAt: Math.min(...own.map((l) => l.firedAt || o.openedAt)),
        };
      });
    })
    .filter((t) => {
      const mine = t.lines.filter((l) => onScreen(l, opts.screen));
      return mine.length > 0 && (!expoFor(opts, t.order.room) || mine.some((l) => l.kitchenState !== 'ready'));
    })
    .sort((a, b) => Number(rushOnFire(b)) - Number(rushOnFire(a)) || a.firedAt - b.firedAt);
}

/** The plates on this screen, in the order the ticket shows them (diner by diner). */
export function screenLines(t: CookTicket, screen: string): CookLine[] {
  return t.lines.filter((l) => onScreen(l, screen));
}

/** The ticket's plates on this screen, grouped by diner in seat order of the check. */
export function linesByDiner(t: CookTicket, screen: string): Array<{ diner: Diner; lines: CookLine[] }> {
  const groups: Array<{ diner: Diner; lines: CookLine[] }> = [];
  for (const l of screenLines(t, screen)) {
    const g = groups.find((x) => x.diner.id === l.dinerId);
    if (g) g.lines.push(l);
    else groups.push({ diner: l.diner, lines: [l] });
  }
  return groups;
}

export interface CookTicketStatus {
  /** Plates on this screen still to make or done (cancelled ones excluded). */
  live: CookLine[];
  cancelled: CookLine[];
  allReady: boolean;
  /** Only cancelled plates are left: the cook just has to see them. */
  onlyCancelled: boolean;
}

export function ticketStatus(t: CookTicket, screen: string): CookTicketStatus {
  const mine = screenLines(t, screen);
  const live = mine.filter((l) => !l.cancelled);
  const cancelled = mine.filter((l) => l.cancelled);
  return {
    live,
    cancelled,
    allReady: live.length > 0 && live.every((l) => l.kitchenState === 'ready'),
    onlyCancelled: live.length === 0 && cancelled.length > 0,
  };
}

/** Line ids a ticket bump marks ready: the plates on this screen and the sides that go with them here. */
export function bumpLineIds(t: CookTicket, screen: string, screensOf: CookTicketOptions['screensOf']): string[] {
  const room = t.order.room || DEFAULT_ROOM;
  return ticketStatus(t, screen).live.flatMap((l) => [
    l.id,
    ...l.sideLines.filter((s) => screen === 'all' || screensOf(s.itemId, room).includes(screen)).map((s) => s.id),
  ]);
}

export interface AllDayCount {
  name: string;
  /** On the line now: fired and not up yet. */
  count: number;
  /** Sent but not fired yet: a later course still held, or a pick up booked ahead. */
  waiting: number;
}

/**
 * The plates this screen will make that are sent but not fired yet: a
 * course waiting for the one before, or a pick up booked for later.
 * Entrées and anything else the screen makes on its own; sides go with
 * their plate.
 */
export function notFiredLines(orders: readonly Order[], opts: CookTicketOptions): OrderLine[] {
  const out: OrderLine[] = [];
  for (const o of orders) {
    const room = o.room || DEFAULT_ROOM;
    for (const d of o.diners)
      for (const i of d.items) {
        if (!i.sent || i.comped || i.cancelled || i.kitchenState !== 'scheduled' || isSide(i.itemId)) continue;
        if (lineFoodRoute(i, d.items, o.room, opts.cfg) !== 'kds') continue;
        const screens = opts.screensOf(i.itemId, room);
        if (opts.screen === 'all' || screens.includes(opts.screen)) out.push(i);
      }
  }
  return out;
}

/**
 * All day: how many of each plate this screen has to make, across every
 * ticket on the line, and how many more are sent but not fired yet. Plates
 * already up and cancelled ones don't count. Most first, then by name.
 */
export function allDayCounts(
  tickets: readonly CookTicket[],
  screen: string,
  name: (itemId: string) => string,
  notFired: readonly OrderLine[] = [],
): AllDayCount[] {
  const counts = new Map<string, AllDayCount>();
  const row = (n: string) => counts.get(n) ?? counts.set(n, { name: n, count: 0, waiting: 0 }).get(n)!;
  for (const t of tickets)
    for (const l of screenLines(t, screen)) {
      if (l.cancelled || l.kitchenState === 'ready') continue;
      row(name(l.itemId)).count++;
    }
  for (const l of notFired) row(name(l.itemId)).waiting++;
  return [...counts.values()].sort((a, b) => b.count + b.waiting - (a.count + a.waiting) || b.count - a.count || a.name.localeCompare(b.name));
}

/** Average minutes from first fire to bump over bumps in the last hour, or null. */
export function averageTicketMinutes(bumps: ReadonlyArray<{ order: Order; at: number }>, at: number): number | null {
  const recent = bumps.filter((b) => at - b.at < 3_600_000);
  if (!recent.length) return null;
  const total = recent.reduce((sum, b) => {
    const fired = Math.min(b.order.openedAt, ...b.order.diners.flatMap((d) => d.items.flatMap((i) => (i.firedAt ? [i.firedAt] : []))));
    return sum + Math.max(0, (b.at - fired) / 60_000);
  }, 0);
  return Math.round(total / recent.length);
}

// ─── What a plate line says ──────────────────────────────────────────────

export interface PlateDetails {
  /** Sides that are not the default: called out in orange. */
  callouts: string[];
  /** Default sides, shown when the venue wants them on the line. */
  defaults: string[];
  /** An entree that comes with sides has none. */
  noSides: boolean;
  /** Other choices, "Grilled · Chopped". */
  mods: string;
  note: string;
}

const pickText = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : v || '');

export function plateDetails(line: CookLine, opts: { defaultSidesOnLine: boolean; name: (itemId: string) => string }): PlateDetails {
  const item = getItem(line.itemId);
  const callouts: string[] = [];
  const defaults: string[] = [];
  const sideChoice = pickText(line.mods?.Side ?? line.mods?.Sides);
  const sideDefault = item?.mods.find((g) => g.group === 'Side')?.default;
  if (sideChoice && sideChoice !== sideDefault) callouts.push(sideChoice);
  else if (sideChoice && opts.defaultSidesOnLine) defaults.push(sideChoice);
  let noSides = false;
  if (item?.entree) {
    const dfs = line.dfs ?? defaultSides(item.id);
    for (const s of line.sideLines) {
      if (!dfs.includes(s.itemId)) callouts.push(opts.name(s.itemId));
      else if (opts.defaultSidesOnLine) defaults.push(opts.name(s.itemId));
    }
    noSides = line.sideLines.length === 0 && dfs.length > 0 && !sideChoice;
  }
  const mods = Object.entries(line.mods ?? {})
    .filter(([g, v]) => g !== 'Side' && g !== 'Sides' && v != null)
    .map(([, v]) => (Array.isArray(v) ? v.join(' · ') : v))
    .filter(Boolean)
    .join(' · ');
  // A remake's note carries "REMAKE"; the badge already says so.
  const note = line.rush ? (line.note || '').replace(/(^|\s·\s)REMAKE$/, '') : line.note || '';
  return { callouts, defaults, noSides, mods, note };
}
