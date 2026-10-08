/**
 * Lines on the check: how they are listed, what they cost on the meal
 * credit, and what the Send button says.
 */
import { getItem, lineItem } from '../../../data';
import { linePrice } from '../../../domain/billing';
import { DEFAULT_CONFIG, mealCreditRules, printerMode, type DiningConfig, type MealCreditRules } from '../../../domain/config';
import { firesAtSend } from '../../../domain/courses';
import { isDrink, isSide, itemCourse } from '../../../domain/menu';
import { lineCourse } from '../../../domain/orders';
import { drinkRoute } from '../../../domain/routing';
import type { Diner, Order, OrderLine } from '../../../domain/types';
import { ordinal } from '../../../lib/format';
import { now } from '../../../lib/clock';
import { clockLabel, dayBefore } from '../../../domain/pickup';
import { getConfig } from '../../../store/config';

/**
 * __kSideOrder: sides read as belonging to their entrée but stay their own
 * lines, so they still count at close. Sorted by course with each side
 * tucked under its parent.
 */
export function sortWithSides(items: OrderLine[]): OrderLine[] {
  const ids = new Set(items.map((i) => i.id));
  const top = items.filter((i) => !(i.parentId && ids.has(i.parentId))).sort((a, b) => lineCourse(a) - lineCourse(b));
  return top.flatMap((t) => [t, ...items.filter((c) => c.parentId === t.id)]);
}

/** __sideParent: a side rung in on its own goes under the diner's latest entrée. */
export function sideParentFor(itemId: string, diner: Diner): string | undefined {
  if (!isSide(itemId)) return undefined;
  const isEntree = (id: string) => {
    const m = getItem(id);
    return !!m?.entree || /Entr|Special/.test(m?.category ?? '');
  };
  const entrees = diner.items.filter((i) => !i.parentId && isEntree(i.itemId));
  return entrees.length ? entrees[entrees.length - 1].id : undefined;
}

// ─── Meal credit ─────────────────────────────────────────────────────────

export type CreditKind = 'app' | 'entree' | 'side' | 'dessert';

/**
 * __kCreditKind: which part of a meal credit a dish uses (HO Settings,
 * Meal Credits, says how many of each one credit covers). Proteins added
 * to a salad are upcharges and never sit on the credit.
 */
export function creditKind(itemId: string): CreditKind | null {
  const it = getItem(itemId);
  if (!it || it.upcharge) return null;
  if (it.creditKind) return it.creditKind === 'none' ? null : (it.creditKind as CreditKind);
  if (it.entree) return 'entree';
  const c = it.category;
  return c === 'Desserts' ? 'dessert' : /side/i.test(c) ? 'side' : c === 'Starters' || c === 'Salads' ? 'app' : null;
}

/**
 * __kXSide: a resident's sides past the credit's allowance (a third side,
 * by default) are charged à la carte, when HO Settings says so. Swapping a
 * default side keeps the count.
 */
export function isExtraSide(diner: Diner, line: OrderLine, rules: MealCreditRules = mealCreditRules(getConfig())): boolean {
  if (!rules.extraSidesAla || diner.isGuest || diner.kind !== 'resident' || line.comped || creditKind(line.itemId) !== 'side') return false;
  return diner.items.filter((x) => !x.comped && creditKind(x.itemId) === 'side').indexOf(line) >= rules.sides;
}

/** __kAlaOf */
export function alaCartePrice(line: Pick<OrderLine, 'itemId'>): number {
  const it = lineItem(line);
  return it?.alaPrice ?? it?.guestPrice ?? 0;
}

/** __kLinePrice: the price shown on the check. */
export function shownPrice(line: OrderLine, diner: Diner): number {
  return isExtraSide(diner, line) ? alaCartePrice(line) : linePrice(line, diner);
}

/** "3rd side" or "Add-on" under a price that is charged on top of the meal credit. */
export function priceTag(line: OrderLine, diner: Diner): string | null {
  if (isExtraSide(diner, line)) return `${ordinal(mealCreditRules(getConfig()).sides + 1)} side`;
  return getItem(line.itemId)?.upcharge && !diner.isGuest ? 'Add-on' : null;
}

// ─── Sending ─────────────────────────────────────────────────────────────

/** Unsent lines that are not held. */
export function sendableLines(o: Order): OrderLine[] {
  return o.diners.flatMap((d) => d.items.filter((i) => !i.sent && !i.hold && !i.comped));
}

const sendCourse = (i: OrderLine) => i.course || i.courseOverride || itemCourse(i.itemId);

/**
 * What the courses in a send do, the way sendOrder treats them: a course
 * fires now unless an earlier course is still out (on the check unsent, in
 * the kitchen or at the pass), and with All at once only dessert waits.
 * "C1 fires now, C2 waits", "C2 waits for C1".
 */
export function courseSendText(o: Order, food: OrderLine[], cfg: DiningConfig = DEFAULT_CONFIG): string {
  const plates = (i: OrderLine) => !isDrink(i.itemId) && !isSide(i.itemId) && !i.comped && !i.cancelled;
  const out = [...o.diners.flatMap((d) => d.items), ...food]
    .filter((i) => plates(i) && (i.sent ? i.kitchenState !== 'cleared' : !i.hold))
    .map(sendCourse);
  const courses = [...new Set(food.filter(plates).map(sendCourse))].sort((a, b) => a - b);
  if (!courses.length) return 'sides fire now';
  const fires = (c: number) => firesAtSend(o, c, cfg) || !out.some((x) => x < c);
  const now = courses.filter(fires);
  const wait = courses.filter((c) => !fires(c));
  const list = (cs: number[]) => 'C' + cs.join(', C');
  if (!now.length) return `${list(wait)} ${wait.length === 1 ? 'waits' : 'wait'} for C${Math.min(...out)}`;
  return `${list(now)} ${now.length === 1 ? 'fires' : 'fire'} now` + (wait.length ? `, ${list(wait)} ${wait.length === 1 ? 'waits' : 'wait'}` : '');
}

/** __kSendLabel: "Send · drinks now, C1 fires now (2 held)". */
export function sendLabel(o: Order, lines: OrderLine[], held: number, cfg: DiningConfig = DEFAULT_CONFIG): string {
  const drinks = lines.filter((i) => isDrink(i.itemId));
  const food = lines.filter((i) => !isDrink(i.itemId));
  const bar = drinks.filter((i) => drinkRoute(i.itemId, o.room, cfg) === 'bar').length;
  const pour = drinks.length - bar;
  const drinkText = [pour && `${pour} for you to get`, bar && `${bar} to the bar`].filter(Boolean).join(', ');
  const heldText = held ? ` (${held} held)` : '';
  if (!food.length) return `Send drinks · ${drinkText}${heldText}`;
  // Printers print the whole ticket at once; nothing waits for a course.
  const foodText = printerMode(cfg) ? 'ticket prints now' : courseSendText(o, food, cfg);
  return drinks.length ? `Send · drinks now, ${foodText}${heldText}` : `Send to kitchen · ${foodText}${heldText}`;
}

/** __kSentMsg: what the last send did, for the confirmation strip. */
export function sentMessage(o: Order, at: number = now(), cfg: DiningConfig = DEFAULT_CONFIG): string {
  // A pick up or delivery booked ahead waits for its fire time.
  if (o.queueType && o.fireAtTs && o.fireAtTs > at)
    return `Scheduled · the kitchen ${printerMode(cfg) ? 'gets the ticket' : 'fires it'} ${dayBefore(o.fireAtTs)}at ${clockLabel(o.fireAtTs)}`;
  const lines = o.diners.flatMap((d) => d.items.filter((i) => i.sent && !i.cancelled));
  const latest = Math.max(0, ...lines.map((i) => i.firedAt || 0));
  const last = lines.filter((i) => (i.firedAt || 0) >= latest - 3000);
  const drinks = last.filter((i) => i.drink);
  const bar = drinks.filter((i) => i.kitchenState === 'bar').length;
  const pour = drinks.length - bar;
  const text = [
    pour && (pour === 1 ? '1 drink is yours to get' : `${pour} drinks are yours to get`),
    bar && (bar === 1 ? '1 went to the bar' : `${bar} went to the bar`),
  ]
    .filter(Boolean)
    .join(', ');
  if (!drinks.length) return 'Sent to kitchen';
  return drinks.length === last.length ? `Drinks rung in · ${text}` : `Sent to kitchen · ${text}`;
}

// ─── Closing with work still out ─────────────────────────────────────────

export interface CloseCheck {
  /** Lines never sent (held ones too), with their diner. */
  unsent: Array<{ dinerId: string; line: OrderLine }>;
  /** How many items that is, a side rung in with its plate counting with the plate. */
  unsentItems: number;
  /** Plates the kitchen still has (held for a course, cooking or at the pass); 0 in printer mode, which tracks nothing. */
  inKitchen: number;
}

/**
 * What closing the check now would drop: items nobody sent, and plates the
 * kitchen is still working on (closing takes them off the kitchen screens).
 */
export function closeCheck(o: Order, cfg: DiningConfig = DEFAULT_CONFIG): CloseCheck {
  const unsent = o.diners.flatMap((d) => d.items.filter((i) => !i.sent && !i.cancelled).map((line) => ({ dinerId: d.id, line })));
  const ids = new Set(unsent.map((u) => u.line.id));
  const unsentItems = unsent.filter((u) => !(u.line.parentId && ids.has(u.line.parentId))).length;
  const inKitchen = printerMode(cfg)
    ? 0
    : o.diners
        .flatMap((d) => d.items)
        .filter(
          (i) =>
            i.sent &&
            !i.drink &&
            !i.cancelled &&
            !i.comped &&
            !isSide(i.itemId) &&
            (i.kitchenState === 'scheduled' || i.kitchenState === 'cooking' || i.kitchenState === 'ready'),
        ).length;
  return { unsent, unsentItems, inKitchen };
}
