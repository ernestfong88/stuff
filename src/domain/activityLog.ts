/**
 * Check timelines (shift metrics and the click trail).
 *
 * Every store action on a check is written onto the check itself
 * (order.log), so the trail follows it to the kitchen screens over the tab
 * sync, into history on close and back out on a reopen.
 *
 * Also here: taking over another server's check. Anyone can look at another
 * server's check. The first change asks first, for managers too; then the
 * check, its metrics and its trail belong to whoever took it. Kitchen and
 * bar steps are not changes to the check.
 */
import { getResident, getAssociate } from '../data';
import { now } from '../lib/clock';
import type { DiningState } from './diningState';
import { dinerName, findLine } from './orders';
import { serverName } from './servers';
import type { Order, OrderLine, OrderLogEvent } from './types';

/** Store actions that are logged, and the event kind each writes. */
export const LOGGED_ACTIONS = {
  openOrder: 'open',
  newCheck: 'open',
  addDiner: 'seat',
  removeDiner: 'unseat',
  editSeat: 'seatmove',
  addItem: 'add',
  removeItem: 'remove',
  updateItem: 'mod',
  setFeedback: 'feedback',
  sendOrder: 'send',
  sendCourse: 'send',
  remakeLine: 'remake',
  setOrderPacing: 'pacing',
  fireCourseNow: 'fire',
  setLineCourse: 'course',
  cancelLine: 'cancel',
  setToGo: 'togo',
  setItemKitchenState: 'kstate',
  closeOrder: 'close',
  closeDiner: 'closeseat',
  toggleHold: 'hold',
  setOrderSchedule: 'schedule',
  notifyOrder: 'notify',
  sendPickupReminder: 'remind',
  setOrderComp: 'comp',
  markPickedUp: 'pickup',
  markDelivered: 'delivered',
  reopenOrder: 'reopen',
  markOrderReady: 'ready',
  markCourseReady: 'ready',
  clearOrder: 'run',
  clearCourse: 'run',
  recallToCooking: 'recall',
  recallCleared: 'recall',
  setOrderMeal: 'meal',
  setDelivery: 'fee',
  setCorkage: 'fee',
  serveDrinks: 'drinks',
  markBarUp: 'barup',
  runCourse: 'run',
  undoRunCourse: 'recall',
  checkIn: 'checkin',
  noDessert: 'nodessert',
} as const;

export type LoggedAction = keyof typeof LOGGED_ACTIONS;

/** Where the person using this device works (decides who a log entry is "by"). */
export type StaffMode =
  | 'server'
  | 'manager'
  | 'host'
  | 'bar'
  | 'cook'
  | 'expo'
  | 'prep'
  | 'pud'
  | 'assocphone'
  | 'kiosk'
  | 'display'
  | 'backoffice';

/** __kWho: the name a log entry is written by. */
export function logAuthor(mode: StaffMode, o: Pick<Order, 'server'> | null | undefined): string {
  switch (mode) {
    case 'cook':
      return 'Kitchen';
    case 'expo':
      return 'Expo';
    case 'bar':
      return 'Bar';
    case 'manager':
      return 'Manager';
    case 'host':
      return 'Host';
    default:
      return serverName(o?.server || 'AA');
  }
}

/**
 * How an action stamps readyAtMs on lines as it is logged, so the timeline
 * knows when each plate came up. Recall clears the stamp again.
 */
export type ReadyStamp =
  | { kind: 'line'; lineId: string }
  | { kind: 'course'; course: number }
  | { kind: 'order' }
  | { kind: 'recall' };

const cookingAtPass = (i: OrderLine) =>
  i.sent && !i.drink && i.kitchenState !== 'cleared' && i.kitchenState !== 'scheduled' && i.kitchenState !== 'ready';

function stampLines(o: Order, stamp: ReadyStamp, at: number): Order['diners'] {
  const match = (i: OrderLine): boolean => {
    switch (stamp.kind) {
      case 'line':
        return i.id === stamp.lineId;
      case 'course':
        return cookingAtPass(i) && (i.course || 2) === stamp.course;
      case 'order':
        return cookingAtPass(i);
      case 'recall':
        return i.kitchenState === 'ready';
    }
  };
  return o.diners.map((d) => ({
    ...d,
    items: d.items.map((i) => (match(i) ? { ...i, readyAtMs: stamp.kind === 'recall' ? undefined : at } : i)),
  }));
}

/** __kAppend: add an event to the check's trail (open or closed), applying any ready stamp. */
export function appendLogEvent(
  state: DiningState,
  orderId: string,
  event: OrderLogEvent,
  stamp?: ReadyStamp,
): DiningState {
  const update = (o: Order): Order =>
    o.id !== orderId
      ? o
      : { ...o, diners: stamp ? stampLines(o, stamp, event.at) : o.diners, log: [...(o.log ?? []), event] };
  const inOrders = state.orders.some((o) => o.id === orderId);
  const inHistory = state.history.some((o) => o.id === orderId);
  if (!inOrders && !inHistory) return state;
  return {
    ...state,
    orders: inOrders ? state.orders.map(update) : state.orders,
    history: inHistory ? state.history.map(update) : state.history,
  };
}

/** Build a log event stamped now. */
export function logEvent(action: LoggedAction, by: string, what: string, course?: number): OrderLogEvent {
  return { at: now(), k: LOGGED_ACTIONS[action], by, what, c: course };
}

// ─── Wording ─────────────────────────────────────────────────────────────

/** "Ruth Bell", or "a seat" when the diner is gone. */
export function dinerLabel(o: Order, dinerId: string): string {
  const d = (o.diners ?? []).find((x) => x.id === dinerId);
  return d ? dinerName(d) : 'a seat';
}

/** addDiner: "Seated Ruth Bell", "Seated Amy Delgado", "Seated a guest of Ruth Bell". */
export function seatedText(
  kind: 'resident' | 'associate',
  refId: string,
  isGuest: boolean,
  extra?: { guestName?: string },
): string {
  const person = kind && refId ? (kind === 'resident' ? getResident(refId) : getAssociate(refId)) : undefined;
  if (isGuest) return 'Seated ' + (extra?.guestName || 'a guest of ' + (person ? person.name : 'a resident'));
  return 'Seated ' + (person ? person.name : 'a guest');
}

/** setOrderPacing */
export function pacingText(mode: string, timerMin?: number): string {
  return (
    'Pacing: ' +
    (mode === 'timer' ? `timed ${timerMin || 5} min` : mode === 'manual' ? 'hold for server' : 'fire when served')
  );
}

/** setItemKitchenState: "Pork Chop up at the pass", "Ran Pork Chop" ... */
export function kitchenStateText(o: Order, lineId: string, state: string | null, label: (itemId: string) => string): string {
  const f = findLine(o, lineId);
  const name = f ? label(f.line.itemId) : 'A plate';
  if (state === 'ready') return name + ' up at the pass';
  if (state === 'cleared') return 'Ran ' + name;
  if (state === 'cooking') return name + ' back to cooking';
  return `${name}: ${state}`;
}

// ─── Taking over a check ─────────────────────────────────────────────────

/** Kitchen, bar and PU & Delivery steps never ask to take the check over. */
const TAKEOVER_EXEMPT: ReadonlySet<LoggedAction> = new Set<LoggedAction>([
  'setItemKitchenState',
  'markOrderReady',
  'markCourseReady',
  'recallToCooking',
  'recallCleared',
  'markBarUp',
  'notifyOrder',
  'sendPickupReminder',
  'markPickedUp',
  'markDelivered',
]);

/** __kNeedsTakeover: this change would be made to someone else's open dine-in check. */
export function needsTakeover(action: LoggedAction, o: Order, me: string | null, mode: StaffMode): boolean {
  return (
    !!me &&
    !o.closedAt &&
    !o.queueType &&
    !!o.server &&
    o.server !== me &&
    (mode === 'server' || mode === 'manager') &&
    !TAKEOVER_EXEMPT.has(action)
  );
}

/**
 * __kTakeOver: the check becomes `me`'s. The original server's name is kept
 * only as takenFrom, which nothing shows, and their entries in the trail
 * are re-attributed.
 */
export function takeOverOrder(orders: Order[], orderId: string, me: string): Order[] {
  return orders.map((o) => {
    if (o.id !== orderId) return o;
    const was = serverName(o.server);
    const by = serverName(me);
    return {
      ...o,
      server: me,
      takenFrom: o.server,
      takenAt: now(),
      log: (o.log ?? []).map((e) => (e.by === was ? { ...e, by } : e)),
    };
  });
}
