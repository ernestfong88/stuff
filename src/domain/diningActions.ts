/**
 * Every change to the dining state, as a pure function
 * (state, ...args) => next state. The store (src/store/dining.tsx) wraps
 * these with ids, logging, cross-tab sync and persistence.
 *
 * Times come from the demo clock (now()); ids are passed in by the caller
 * so a reducer always gives the same result for the same input.
 */
import { getItem } from '../data';
import { now } from '../lib/clock';
import { DEFAULT_CONFIG, printerMode, type DiningConfig } from './config';
import { courseDue, runsLine, type RunUndo } from './courses';
import type { DiningState } from './diningState';
import { defaultSides, isDrink, isSide, itemCourse } from './menu';
import { addCheck, stampReady } from './orders';
import { pickupFireAt } from './pickup';
import { drinkStartState, firedState, foodRoute, isDrinkLine, queueFiredState } from './routing';
import type {
  Diner,
  FireMode,
  KitchenState,
  MealName,
  ModSelection,
  Order,
  OrderComp,
  OrderLine,
  QueueType,
} from './types';

export interface ActionContext {
  cfg: DiningConfig;
  /** Minutes a pick up / delivery fires before its promised time (pickupLeadMinutes). */
  pickupLead: number;
}

export const DEFAULT_CONTEXT: ActionContext = { cfg: DEFAULT_CONFIG, pickupLead: 20 };

// ─── Plumbing ────────────────────────────────────────────────────────────

const withOrders = (s: DiningState, orders: Order[]): DiningState => (orders === s.orders ? s : { ...s, orders });

/** Apply fn to one open order. */
function updateOrder(s: DiningState, orderId: string, fn: (o: Order) => Order): DiningState {
  return withOrders(
    s,
    s.orders.map((o) => (o.id === orderId ? fn(o) : o)),
  );
}

/** Apply fn to every line of an order. */
const mapLines = (o: Order, fn: (line: OrderLine, diner: Diner) => OrderLine): Order => ({
  ...o,
  diners: o.diners.map((d) => ({ ...d, items: d.items.map((i) => fn(i, d)) })),
});

/** Apply fn to one diner of one order. */
function updateDiner(s: DiningState, orderId: string, dinerId: string, fn: (d: Diner) => Diner): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, diners: o.diners.map((d) => (d.id === dinerId ? fn(d) : d)) }));
}

/** Apply fn to one line of one diner. */
function updateLine(
  s: DiningState,
  orderId: string,
  dinerId: string,
  lineId: string,
  fn: (i: OrderLine) => OrderLine,
): DiningState {
  return updateDiner(s, orderId, dinerId, (d) => ({ ...d, items: d.items.map((i) => (i.id === lineId ? fn(i) : i)) }));
}

const notRunOrHeld = (i: OrderLine) => i.kitchenState !== 'cleared' && i.kitchenState !== 'scheduled';

// ─── Opening checks ──────────────────────────────────────────────────────

export interface NewCheck {
  tableId: string;
  room: string;
  meal?: MealName;
  server?: string;
}

/** The table's open check (for that server, when given), if any. */
export function findTableCheck(s: DiningState, tableId: string, server?: string): Order | undefined {
  return s.orders.find((o) => o.tableId === tableId && (!server || o.server === server));
}

/** Open a new check at a table; a second party at the same table gets a lettered check. */
export function newCheck(s: DiningState, id: string, c: NewCheck): DiningState {
  return withOrders(
    s,
    addCheck(s.orders, {
      id,
      tableId: c.tableId,
      room: c.room,
      server: c.server || 'AA',
      meal: c.meal || 'Dinner',
      openedAt: now(),
      diners: [],
    }),
  );
}

/** Start an empty pick up or delivery order. */
export function openQueueOrder(s: DiningState, id: string, type: QueueType, room?: string, meal?: MealName): DiningState {
  return withOrders(s, [
    ...s.orders,
    { id, queueType: type, room: room || 'sequoia', server: 'AA', meal: meal || 'Dinner', openedAt: now(), diners: [] },
  ]);
}

/** Add a fully formed order (the resident kiosk builds its own). */
export function addOrder(s: DiningState, o: Order): DiningState {
  return withOrders(s, [...s.orders, o]);
}

export function setOrderMeal(s: DiningState, orderId: string, meal: MealName): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, meal }));
}

export function setDelivery(s: DiningState, orderId: string, deliveryFeeId: string): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, deliveryFeeId }));
}

/** Merge arbitrary fields into an order. */
export function patchOrder(s: DiningState, orderId: string, patch: Partial<Order>): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, ...patch }));
}

/** Bottles brought in (whole, never negative). */
export function setCorkage(s: DiningState, orderId: string, bottles: number): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, corkage: Math.max(0, bottles | 0) }));
}

/** The table asked for its server (a timestamp), or the ask is cleared. */
export function setAskedFor(s: DiningState, orderId: string, at?: number | null): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, askedFor: at || undefined }));
}

// ─── Diners ──────────────────────────────────────────────────────────────

export function addDiner(
  s: DiningState,
  orderId: string,
  dinerId: string,
  kind: Diner['kind'],
  refId: string,
  isGuest?: boolean,
  extra?: Partial<Diner>,
): DiningState {
  return updateOrder(s, orderId, (o) => ({
    ...o,
    diners: [...o.diners, { id: dinerId, kind, refId, isGuest: !!isGuest, seat: o.diners.length + 1, items: [], ...extra }],
  }));
}

export function removeDiner(s: DiningState, orderId: string, dinerId: string): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, diners: o.diners.filter((d) => d.id !== dinerId) }));
}

export function editSeat(s: DiningState, orderId: string, dinerId: string, seat: number): DiningState {
  return updateDiner(s, orderId, dinerId, (d) => ({ ...d, seat }));
}

export function setFeedback(s: DiningState, orderId: string, dinerId: string, feedback: unknown): DiningState {
  return updateDiner(s, orderId, dinerId, (d) => ({ ...d, feedback }));
}

// ─── Lines ───────────────────────────────────────────────────────────────

export interface NewLine {
  /** Id for the line itself. */
  id: string;
  itemId: string;
  mods: ModSelection;
  note?: string;
  /** Parent line, for something added onto another line. */
  parentId?: string;
  /** Ids for the default side lines, in order (one per default side). */
  sideIds: string[];
}

/**
 * Ring in an item. Its default sides come along as their own lines
 * (autoSide, parentId = the item), and an entrée remembers which sides it
 * came with (dfs) so the ticket can say when one was swapped.
 */
export function addItem(s: DiningState, orderId: string, dinerId: string, line: NewLine): DiningState {
  const it = getItem(line.itemId);
  const sides: OrderLine[] = (it ? defaultSides(it.id) : []).map((itemId, k) => ({
    id: line.sideIds[k],
    itemId,
    mods: {},
    note: '',
    sent: false,
    kitchenState: null,
    autoSide: true,
    parentId: line.id,
  }));
  const main: OrderLine = {
    id: line.id,
    itemId: line.itemId,
    mods: line.mods,
    parentId: line.parentId || undefined,
    note: line.note || '',
    sent: false,
    kitchenState: null,
    dfs: it?.entree ? sides.map((x) => x.itemId) : undefined,
  };
  return updateDiner(s, orderId, dinerId, (d) => ({ ...d, items: [...d.items, main, ...sides] }));
}

export function removeItem(s: DiningState, orderId: string, dinerId: string, lineId: string): DiningState {
  return updateDiner(s, orderId, dinerId, (d) => ({ ...d, items: d.items.filter((i) => i.id !== lineId) }));
}

export function updateItem(
  s: DiningState,
  orderId: string,
  dinerId: string,
  lineId: string,
  mods: ModSelection,
  note: string,
): DiningState {
  return updateLine(s, orderId, dinerId, lineId, (i) => ({ ...i, mods, note }));
}

/** Hold an unsent line back from the next send, or release it. */
export function toggleHold(s: DiningState, orderId: string, dinerId: string, lineId: string): DiningState {
  return updateLine(s, orderId, dinerId, lineId, (i) => ({ ...i, hold: !i.hold, holdAt: i.hold ? null : now() }));
}

/** Move a line to another course before it is sent. */
export function setLineCourse(s: DiningState, orderId: string, dinerId: string, lineId: string, course: number): DiningState {
  return updateLine(s, orderId, dinerId, lineId, (i) => ({ ...i, courseOverride: course }));
}

export function setToGo(s: DiningState, orderId: string, dinerId: string, lineId: string): DiningState {
  return updateLine(s, orderId, dinerId, lineId, (i) => ({ ...i, toGo: !i.toGo }));
}

/**
 * Cancel a line. One the kitchen is working on stays on the ticket, marked
 * cancelled; one it never saw (unsent, held for its course, or already run)
 * is simply removed.
 */
export function cancelLine(s: DiningState, orderId: string, dinerId: string, lineId: string): DiningState {
  return updateOrder(s, orderId, (o) => {
    const line = o.diners.find((d) => d.id === dinerId)?.items.find((i) => i.id === lineId);
    const inKitchen = !!line && line.sent && notRunOrHeld(line);
    return stampReady({
      ...o,
      diners: o.diners.map((d) =>
        d.id !== dinerId
          ? d
          : {
              ...d,
              items: inKitchen
                ? d.items.map((i) => (i.id === lineId ? { ...i, cancelled: true, cancelledAt: now() } : i))
                : d.items.filter((i) => i.id !== lineId),
            },
      ),
    });
  });
}

/** Comp the line and send a rush copy marked REMAKE straight to the kitchen (or bar). */
export function remakeLine(
  s: DiningState,
  orderId: string,
  dinerId: string,
  lineId: string,
  newLineId: string,
  ctx: ActionContext = DEFAULT_CONTEXT,
): DiningState {
  return updateOrder(s, orderId, (o) => ({
    ...o,
    diners: o.diners.map((d) => {
      if (d.id !== dinerId) return d;
      const line = d.items.find((i) => i.id === lineId);
      if (!line) return d;
      return {
        ...d,
        items: [
          ...d.items.map((i) => (i.id === lineId ? { ...i, comped: true } : i)),
          {
            ...line,
            id: newLineId,
            comped: false,
            rush: true,
            note: (line.note ? line.note + ' · ' : '') + 'REMAKE',
            sent: true,
            kitchenState: line.drink ? drinkStartState(line.itemId, o.room, ctx.cfg) : 'cooking',
            firedAt: now(),
          },
        ],
      };
    }),
  }));
}

/** A dismissed server reminder on a line ("ask about dressing" ...). */
export function dismissReminder(s: DiningState, orderId: string, lineId: string, reminder: string): DiningState {
  return updateOrder(s, orderId, (o) =>
    mapLines(o, (i) => (i.id === lineId ? { ...i, rmOff: [...(i.rmOff ?? []), reminder] } : i)),
  );
}

// ─── Sending and pacing ──────────────────────────────────────────────────

/**
 * Send everything rung in (except held lines).
 *
 * Dine-in: drinks go straight to the server or bar and never take a course.
 * Each plate fires now unless an earlier course is still out (unsent, in
 * the kitchen, or at the pass), in which case it is scheduled and the
 * pacing timer fires it later. What never reaches a kitchen screen is
 * marked run at once.
 *
 * Pick up / delivery: everything is course 1. Before its fire time
 * (promised time minus the lead) it is scheduled for that time; otherwise
 * it fires now.
 */
export function sendOrder(s: DiningState, orderId: string, ctx: ActionContext = DEFAULT_CONTEXT): DiningState {
  const t = now();
  const { cfg } = ctx;
  return updateOrder(s, orderId, (o) => {
    const fireAt = pickupFireAt(o, ctx.pickupLead);
    const later = !!fireAt && fireAt > t;
    const all = o.diners.flatMap((d) => d.items);
    // With printers the whole ticket prints at once: no course waits on another.
    const printers = printerMode(cfg);
    const earlierCourseOut = (course: number) =>
      !printers &&
      all.some((x) => {
        if (isDrinkLine(x, o) || (x.course || x.courseOverride || itemCourse(x.itemId)) >= course || x.comped || x.hold)
          return false;
        return x.sent ? x.kitchenState !== 'cleared' : true;
      });
    return {
      ...o,
      sentAt: t,
      fireAtTs: later ? fireAt! : undefined,
      diners: o.diners.map((d) => ({
        ...d,
        items: d.items.map((i): OrderLine => {
          if (i.sent || i.hold) return i;
          if (!o.queueType && isDrink(i.itemId)) {
            return { ...i, sent: true, drink: true, course: undefined, kitchenState: drinkStartState(i.itemId, o.room, cfg), firedAt: t };
          }
          const course = i.courseOverride || itemCourse(i.itemId);
          if (o.queueType) {
            return { ...i, sent: true, course: 1, kitchenState: later ? 'scheduled' : queueFiredState(i.itemId, o.room, cfg), firedAt: t };
          }
          const neverSeen = foodRoute(i.itemId, o.room, cfg) === 'none';
          if (later) return { ...i, sent: true, course, kitchenState: neverSeen ? 'cleared' : 'scheduled', firedAt: t };
          const kitchenState: KitchenState = neverSeen
            ? 'cleared'
            : earlierCourseOut(course)
              ? 'scheduled'
              : firedState(i.itemId, o.room, cfg);
          return { ...i, sent: true, course, kitchenState, firedAt: t };
        }),
      })),
    };
  });
}

/**
 * Send only the lines in these menu categories, firing them now (and any
 * already scheduled ones in them).
 */
export function sendCourse(s: DiningState, orderId: string, categories: string[]): DiningState {
  const t = now();
  return updateOrder(s, orderId, (o) => ({
    ...mapLines(o, (i) => {
      const inCats = categories.includes(getItem(i.itemId)?.category ?? '');
      if (i.sent && i.kitchenState === 'scheduled' && inCats) return { ...i, kitchenState: 'cooking', firedAt: t };
      if (i.sent || i.hold) return i;
      return inCats ? { ...i, sent: true, course: itemCourse(i.itemId), kitchenState: 'cooking', firedAt: t } : i;
    }),
    sentAt: o.sentAt || t,
  }));
}

/** Fire a held course now (a pick up / delivery fires everything held). */
export function fireCourseNow(s: DiningState, orderId: string, course: number, ctx: ActionContext = DEFAULT_CONTEXT): DiningState {
  const t = now();
  return updateOrder(s, orderId, (o) => ({
    ...mapLines(o, (i) =>
      i.sent && i.kitchenState === 'scheduled' && (o.queueType || (i.course || 2) === course)
        ? {
            ...i,
            kitchenState: o.queueType ? queueFiredState(i.itemId, o.room, ctx.cfg) : firedState(i.itemId, o.room, ctx.cfg),
            firedAt: t,
          }
        : i,
    ),
    fireAtTs: o.queueType ? undefined : o.fireAtTs,
  }));
}

export function setOrderPacing(s: DiningState, orderId: string, fireMode: FireMode, fireTimerMin?: number): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, fireMode, fireTimerMin }));
}

/**
 * One pass of the course pacing timer (every 5 seconds, in one tab).
 *
 * A pick up / delivery with a fire time fires everything held once that
 * time comes. A dine-in check fires its lowest held course when
 * courseDue() says so, judged against the earlier courses' plates (sides
 * and drinks don't count). Returns the same array when nothing fired.
 */
export function pacingTick(orders: Order[], cfg: DiningConfig = DEFAULT_CONFIG): Order[] {
  const t = now();
  let changed = false;
  const next = orders.map((o) => {
    const sent = o.diners.flatMap((d) => d.items.filter((i) => i.sent));
    const held = sent.filter((i) => i.kitchenState === 'scheduled');
    if (!held.length) return o;
    if (o.fireAtTs) {
      if (t < o.fireAtTs) return o;
      changed = true;
      return {
        ...mapLines(o, (i) =>
          i.sent && i.kitchenState === 'scheduled'
            ? { ...i, kitchenState: o.queueType ? queueFiredState(i.itemId, o.room, cfg) : firedState(i.itemId, o.room, cfg), firedAt: t }
            : i,
        ),
        fireAtTs: undefined,
      };
    }
    const course = Math.min(...held.map((i) => i.course || 2));
    const prev = sent.filter((i) => (i.course || 2) < course && !isSide(i.itemId) && !i.drink);
    const allRun = prev.every((i) => i.kitchenState === 'cleared' || i.cancelled);
    const sinceFired = t - Math.max(...prev.map((i) => i.firedAt || 0), o.openedAt);
    if (!courseDue(o, course, prev, allRun, sinceFired, cfg)) return o;
    changed = true;
    return mapLines(o, (i) =>
      i.sent && i.kitchenState === 'scheduled' && (i.course || 2) === course
        ? { ...i, kitchenState: firedState(i.itemId, o.room, cfg), firedAt: t }
        : i,
    );
  });
  return changed ? next : orders;
}

// ─── Kitchen, expo and the table ─────────────────────────────────────────

export function setItemKitchenState(s: DiningState, orderId: string, lineId: string, state: KitchenState): DiningState {
  return updateOrder(s, orderId, (o) => stampReady(mapLines(o, (i) => (i.id === lineId ? { ...i, kitchenState: state } : i))));
}

/**
 * Course c is up at the pass (optionally only these lines). Pick up and
 * delivery have one course, so every line counts.
 */
export function markCourseReady(s: DiningState, orderId: string, course: number, lineIds?: string[]): DiningState {
  return updateOrder(s, orderId, (o) =>
    stampReady(
      mapLines(o, (i) =>
        i.sent &&
        !i.drink &&
        (!lineIds || lineIds.includes(i.id)) &&
        (o.queueType || (i.course || 2) === course) &&
        notRunOrHeld(i)
          ? { ...i, kitchenState: 'ready' }
          : i,
      ),
    ),
  );
}

/** Every plate in the kitchen is up at the pass. */
export function markOrderReady(s: DiningState, orderId: string): DiningState {
  return updateOrder(s, orderId, (o) =>
    stampReady(mapLines(o, (i) => (i.sent && !i.drink && notRunOrHeld(i) ? { ...i, kitchenState: 'ready' } : i))),
  );
}

/** Expo ran course c: its plates at the pass, and its sides, go to the table. */
export function clearCourse(s: DiningState, orderId: string, course: number): DiningState {
  const t = now();
  return updateOrder(s, orderId, (o) => ({
    ...mapLines(o, (i) =>
      i.sent &&
      (i.kitchenState === 'ready' || (isSide(i.itemId) && notRunOrHeld(i))) &&
      (o.queueType || (i.course || 2) === course)
        ? { ...i, kitchenState: 'cleared', clearedAt: t }
        : i,
    ),
    readyStampAt: null,
  }));
}

/** Expo ran everything that has been fired. */
export function clearOrder(s: DiningState, orderId: string): DiningState {
  const t = now();
  return updateOrder(s, orderId, (o) =>
    mapLines(o, (i) =>
      i.sent && !i.drink && i.kitchenState !== 'scheduled' ? { ...i, kitchenState: 'cleared', clearedAt: t } : i,
    ),
  );
}

/**
 * The server ran course c (Mark served), numbered the way the table card
 * does (runsLine).
 */
export function runCourse(s: DiningState, orderId: string, course: number): DiningState {
  const t = now();
  return updateOrder(s, orderId, (o) => ({
    ...mapLines(o, (i) => (runsLine(i, course) ? { ...i, kitchenState: 'cleared', clearedAt: t } : i)),
    readyStampAt: null,
  }));
}

/**
 * Undo a mis-tapped Mark served: what it ran goes back to the pass, and
 * anything held at the tap that pacing has fired since goes back on hold.
 */
export function undoRunCourse(s: DiningState, orderId: string, undo: RunUndo): DiningState {
  return updateOrder(s, orderId, (o) => ({
    ...mapLines(o, (i) => {
      if (undo.ran.includes(i.id) && i.kitchenState === 'cleared') return { ...i, kitchenState: 'ready', clearedAt: undefined };
      if (i.id in undo.held && notRunOrHeld(i) && (i.firedAt || 0) >= undo.at)
        return { ...i, kitchenState: 'scheduled', firedAt: undo.held[i.id] };
      return i;
    }),
    readyStampAt: undo.stamp,
  }));
}

/**
 * Plates at the pass go back to cooking. As in the original, an existing
 * readyStampAt is kept (the stamp is only dropped when absent).
 */
export function recallToCooking(s: DiningState, orderId: string): DiningState {
  return updateOrder(s, orderId, (o) => ({
    ...mapLines(o, (i) => (i.kitchenState === 'ready' ? { ...i, kitchenState: 'cooking' } : i)),
    readyStampAt: o.readyStampAt ?? null,
  }));
}

/** Everything run to the table comes back to the pass. */
export function recallCleared(s: DiningState, orderId: string): DiningState {
  return updateOrder(s, orderId, (o) =>
    mapLines(o, (i) => (i.kitchenState === 'cleared' ? { ...i, kitchenState: 'ready' } : i)),
  );
}

/**
 * Drinks reached the table: the given ones, or every drink the server is
 * pouring or that is up at the bar.
 */
export function serveDrinks(s: DiningState, orderId: string, lineIds?: string[]): DiningState {
  const t = now();
  return updateOrder(s, orderId, (o) =>
    mapLines(o, (i) =>
      i.drink &&
      i.kitchenState !== 'cleared' &&
      (lineIds ? lineIds.includes(i.id) : i.kitchenState === 'pour' || i.kitchenState === 'up')
        ? { ...i, kitchenState: 'cleared', clearedAt: t }
        : i,
    ),
  );
}

/** The bar finished the check's drinks. */
export function markBarUp(s: DiningState, orderId: string): DiningState {
  const t = now();
  return updateOrder(s, orderId, (o) =>
    mapLines(o, (i) => (i.drink && i.kitchenState === 'bar' ? { ...i, kitchenState: 'up', upAt: t } : i)),
  );
}

/** The server checked in on the table after course c. */
export function checkIn(s: DiningState, orderId: string, course: number): DiningState {
  return updateOrder(s, orderId, (o) => ({
    ...o,
    checkIns: [...(o.checkIns ?? []), { course, at: now(), by: o.server }],
  }));
}

export function noDessert(s: DiningState, orderId: string): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, noDessert: true }));
}

// ─── Pick up and delivery ────────────────────────────────────────────────

/** Promised time, "4:15 PM". */
export function setOrderSchedule(s: DiningState, orderId: string, readyAt: string): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, readyAt }));
}

/** The resident was texted (keeps the first time). */
export function notifyOrder(s: DiningState, orderId: string): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, notified: true, notifiedAt: o.notifiedAt || now() }));
}

export function sendPickupReminder(s: DiningState, orderId: string): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, remindedAt: now() }));
}

export function setOrderComp(s: DiningState, orderId: string, comp: OrderComp | null): DiningState {
  return updateOrder(s, orderId, (o) => ({ ...o, comp }));
}

/** Left the kitchen with the runner (the "on the way" text goes with it). */
export function markPickedUp(s: DiningState, orderId: string): DiningState {
  const t = now();
  return updateOrder(s, orderId, (o) => ({ ...o, pickedUpAt: t, textedOnWayAt: t }));
}

/** Handed over: the order closes into history, charged to the apartment unless set otherwise. */
export function markDelivered(s: DiningState, orderId: string): DiningState {
  const o = s.orders.find((x) => x.id === orderId);
  if (!o) return s;
  const t = now();
  const closed: Order = {
    ...o,
    deliveredAt: t,
    closedAt: t,
    closedBy: o.server,
    diners: o.diners.map((d) => ({
      ...d,
      items: d.items.map((i) => (i.sent ? { ...i, kitchenState: 'cleared' } : i)),
      chargeDrop: d.chargeDrop || 'apt',
    })),
  };
  return { ...s, orders: s.orders.filter((x) => x.id !== orderId), history: [closed, ...s.history] };
}

// ─── Closing ─────────────────────────────────────────────────────────────

/**
 * Close the check. A check with anything on it goes to history with each
 * diner's payment (chargeDrop by diner id); an empty one is dropped.
 */
export function closeOrder(s: DiningState, orderId: string, drops?: Record<string, string | null | undefined>): DiningState {
  const o = s.orders.find((x) => x.id === orderId);
  const orders = s.orders.filter((x) => x.id !== orderId);
  if (!o || !o.diners.some((d) => d.items.length)) return withOrders(s, orders);
  const closed: Order = {
    ...o,
    closedAt: now(),
    closedBy: o.server,
    diners: o.diners.map((d) => ({ ...d, chargeDrop: drops?.[d.id] || null })),
  };
  return { ...s, orders, history: [closed, ...s.history] };
}

/**
 * Close one diner's part of the check (separate checks). Their part goes to
 * history as "orderId:dinerId"; the check closes when nobody is left.
 */
export function closeDiner(s: DiningState, orderId: string, dinerId: string, drop?: string): DiningState {
  const o = s.orders.find((x) => x.id === orderId);
  const d = o?.diners.find((x) => x.id === dinerId);
  if (!o || !d) return s;
  const history = d.items.length
    ? [{ ...o, id: o.id + ':' + dinerId, closedAt: now(), closedBy: o.server, diners: [{ ...d, chargeDrop: drop || 'plan' }] }, ...s.history]
    : s.history;
  const rest = o.diners.filter((x) => x.id !== dinerId);
  const orders = rest.length ? s.orders.map((x) => (x.id === orderId ? { ...x, diners: rest } : x)) : s.orders.filter((x) => x.id !== orderId);
  return { ...s, orders, history };
}

/** Bring a closed check back from history (no-op if it is already open). */
export function reopenOrder(s: DiningState, orderId: string): DiningState {
  const closed = s.history.find((x) => x.id === orderId);
  if (!closed) return s;
  const reopened: Order = { ...closed };
  delete reopened.closedAt;
  delete reopened.closedBy;
  return {
    ...s,
    history: s.history.filter((x) => x.id !== orderId),
    orders: s.orders.some((x) => x.id === orderId) ? s.orders : [...s.orders, reopened],
  };
}
