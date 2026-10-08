/**
 * The PU & Delivery list: which orders show, in what order, what stage each
 * is at, what it needs next and how it is described. Pure functions over
 * the dining store's orders, so the wording can be tested.
 */
import { MINUTE } from '../../../lib/clock';
import {
  clockLabel,
  clockMinutes,
  dayBefore,
  dayOffset,
  orderAheadLabel,
  parseClockTime,
  pickupDue,
  pickupLateMinutes,
  pickupApt,
  pickupStage,
  pickupWho,
  spanLabel,
  type PickupStage,
} from '../../../domain/pickup';
import type { Order } from '../../../domain/types';
import { queueTextKey, textFor, type TextContext } from '../../../domain/pickupService/texts';
import { rangeOf } from '../../../domain/pickupService/windows';

export type QueueFilter = 'all' | 'pickup' | 'delivery';

export interface QueueRow {
  order: Order;
  stage: PickupStage;
  /** Promised time (start of the booked range), ms. */
  due: number;
}

const isQueue = (o: Order) => o.queueType === 'pickup' || o.queueType === 'delivery';

export const matchesFilter = (o: Order, f: QueueFilter) => f === 'all' || o.queueType === f;

/** Nothing ordered on it yet: a new order left without picking any items. */
export const isEmptyOrder = (o: Order) => !o.diners.some((d) => d.items.length > 0);

/** Open pick up and delivery orders, soonest promise first. */
export function openRows(orders: Order[], kitchenMode?: string): QueueRow[] {
  return orders
    .filter(isQueue)
    .map((order) => ({ order, stage: pickupStage(order, kitchenMode), due: pickupDue(order) }))
    .sort((a, b) => a.due - b.due || a.order.openedAt - b.order.openedAt);
}

/** When an order was handed over (or closed). */
export const handedOffAt = (o: Order) => o.deliveredAt || o.closedAt || 0;

/** Pick ups and deliveries handed off since `dayStart`, latest first. */
export function completedToday(history: Order[], dayStart: number): Order[] {
  return history.filter((o) => isQueue(o) && handedOffAt(o) >= dayStart).sort((a, b) => handedOffAt(b) - handedOffAt(a));
}

/**
 * A full minute past its promise and still not handed on. Waiting at the
 * counter is the resident's time, not the kitchen's, so it never counts.
 */
export const isLate = (r: QueueRow, at: number) => at - r.due >= MINUTE && r.stage !== 'waiting';

export interface QueueSlot {
  due: number;
  rows: QueueRow[];
}

/** Orders grouped by their promised range. Rows must already be sorted by due. */
export function groupSlots(rows: QueueRow[]): QueueSlot[] {
  const slots: QueueSlot[] = [];
  for (const r of rows) {
    const last = slots[slots.length - 1];
    if (last && last.due === r.due) last.rows.push(r);
    else slots.push({ due: r.due, rows: [r] });
  }
  return slots;
}

/** "5:00 to 5:15 PM", with "Tomorrow" (or "Fri 10/10") for an order booked ahead. */
export function slotHeading(slot: QueueSlot): string {
  const o = slot.rows[0].order;
  const label = parseClockTime(o.readyAt) ? rangeOf(o.readyAt) : clockLabel(slot.due);
  const ahead = orderAheadLabel(o);
  return ahead ? `${ahead} · ${label}` : label;
}

/** An order booked for a later day, as its card says when: "Tomorrow, Lunch 12:15–12:30 PM"; "" for today. */
export function aheadWhen(o: Order): string {
  const ahead = orderAheadLabel(o);
  if (!ahead) return '';
  return `${ahead}, ${o.meal}${parseClockTime(o.readyAt) ? ' ' + rangeOf(o.readyAt).replace(' to ', '–') : ''}`;
}

/** "1 pick up · 2 deliveries" */
export function slotSummary(rows: QueueRow[]): string {
  const pu = rows.filter((r) => r.order.queueType === 'pickup').length;
  const dl = rows.length - pu;
  return [pu && `${pu} pick up`, dl && `${dl} ${dl === 1 ? 'delivery' : 'deliveries'}`].filter(Boolean).join(' · ');
}

// ─── What needs doing now ────────────────────────────────────────────────

export type NextStepId = 'handOff' | 'takeOut' | 'onTheWay' | 'kitchen' | 'notSent' | 'later';

export interface NextStepGroup {
  id: NextStepId;
  title: string;
  /** One short line on what to do with these. */
  hint: string;
  rows: QueueRow[];
}

const NEXT_STEPS: readonly Omit<NextStepGroup, 'rows'>[] = [
  { id: 'handOff', title: 'Hand off now', hint: 'Ready for the resident at the counter' },
  { id: 'takeOut', title: 'Take out for delivery', hint: 'Ready on the pass' },
  { id: 'onTheWay', title: 'On the way', hint: 'Mark delivered once it’s at the door' },
  { id: 'kitchen', title: 'In the kitchen', hint: 'Nothing to do yet' },
  { id: 'notSent', title: 'Not sent yet', hint: 'Finish these so the kitchen gets them' },
  { id: 'later', title: 'Later', hint: 'Booked for later. The kitchen starts them closer to the time' },
];

/** Which "what to do now" section an order belongs in. */
export function nextStepOf(r: QueueRow): NextStepId {
  switch (r.stage) {
    case 'ready':
      return r.order.queueType === 'delivery' ? 'takeOut' : 'handOff';
    case 'waiting':
      return 'handOff';
    case 'out':
      return 'onTheWay';
    case 'cooking':
      return 'kitchen';
    case 'draft':
      return 'notSent';
    case 'scheduled':
      return 'later';
    default:
      return r.order.queueType === 'delivery' ? 'onTheWay' : 'handOff';
  }
}

/**
 * The open list split by what needs doing now, most urgent first: hand-offs,
 * deliveries to take out, deliveries on the way, the kitchen, unsent orders,
 * then later bookings. Empty sections are left out. Late orders lead their
 * section; the rest keep promise order.
 */
export function nextStepGroups(rows: QueueRow[], at: number): NextStepGroup[] {
  const byId = new Map<NextStepId, QueueRow[]>();
  for (const r of rows) {
    const id = nextStepOf(r);
    byId.set(id, [...(byId.get(id) ?? []), r]);
  }
  const lateFirst = (a: QueueRow, b: QueueRow) =>
    Number(isLate(b, at)) - Number(isLate(a, at)) || a.due - b.due || a.order.openedAt - b.order.openedAt;
  return NEXT_STEPS.filter((g) => byId.has(g.id)).map((g) => ({ ...g, rows: [...byId.get(g.id)!].sort(lateFirst) }));
}

export type DueTone = 'late' | 'past' | 'soon' | 'later';

/** "6m late", "2m past", "due now", "in 24m". */
export function dueText(r: QueueRow, at: number): { text: string; tone: DueTone } {
  // Booked for a later day: say the day, not "in 23h".
  if (dayOffset(r.order) > 0) return { text: aheadWhen(r.order), tone: 'later' };
  const d = r.due - at;
  if (isLate(r, at)) return { text: `${spanLabel(d)} late`, tone: 'late' };
  if (d < -MINUTE) return { text: `${spanLabel(d)} past`, tone: 'past' };
  if (d < MINUTE) return { text: 'due now', tone: 'soon' };
  return { text: `in ${spanLabel(d)}`, tone: d <= 10 * MINUTE ? 'soon' : 'later' };
}

export type StageTone = 'muted' | 'coast' | 'clay' | 'flora' | 'amber';

export interface StageView {
  label: string;
  tone: StageTone;
  detail: string;
}

/** When the kitchen started on the order. */
function cookingSince(o: Order): number {
  const fired = Math.max(0, ...o.diners.flatMap((d) => d.items).map((l) => l.firedAt || 0));
  return fired || o.sentAt || o.openedAt;
}

/** "9m ago", or "just now" inside the first minute. */
const ago = (ms: number) => (ms < MINUTE ? 'just now' : `${spanLabel(ms)} ago`);

/** The stage label, its colour and the line under it. */
export function stageView(r: QueueRow, at: number, ctx: TextContext, leadMinutes: number): StageView {
  const o = r.order;
  switch (r.stage) {
    case 'draft':
      return { label: 'Not sent yet', tone: 'muted', detail: 'Finish the order to send it' };
    case 'scheduled': {
      const fires = o.fireAtTs || r.due - leadMinutes * MINUTE;
      return { label: 'Scheduled', tone: 'coast', detail: `Kitchen fires ${dayBefore(fires)}at ${clockLabel(fires)}` };
    }
    case 'cooking':
      return { label: 'In the kitchen', tone: 'clay', detail: `Cooking ${spanLabel(at - cookingSince(o))}` };
    case 'ready':
      return { label: 'Ready', tone: 'flora', detail: o.readyStampAt ? `Up for ${spanLabel(at - o.readyStampAt)}` : 'On the pass' };
    case 'waiting': {
      const t = textFor(o, 'pickupReady', ctx);
      return {
        label: 'Waiting at the counter',
        tone: 'amber',
        detail: `${t.sent ? 'Texted' : 'Ready'} ${ago(at - (o.notifiedAt || at))}${t.sent ? '' : ` · not texted, ${t.why}`}${o.remindedAt ? ' · reminded' : ''}`,
      };
    }
    default: {
      const t = textFor(o, 'deliveryOut', ctx);
      return {
        label: 'On the way',
        tone: 'coast',
        detail: `Left ${ago(at - (o.notifiedAt || at))}${t.sent ? '' : ` · not texted, ${t.why}`}`,
      };
    }
  }
}

export type QueueActionKind = 'finish' | 'packed' | 'onMyWay' | 'pickedUp' | 'delivered';

export interface QueueAction {
  kind: QueueActionKind;
  label: string;
}

/** First name of whoever the order is for. */
export const firstOf = (o: Order) => pickupWho(o).split(' ')[0];

/**
 * The one button the order needs next. `tracksPickups` false means a pick up
 * is complete once it is packed and set out, so there is no Picked up step.
 */
export function nextAction(r: QueueRow, ctx: TextContext, tracksPickups: boolean): QueueAction | null {
  const o = r.order;
  if (r.stage === 'draft') return { kind: 'finish', label: 'Finish order' };
  if (r.stage === 'ready' && o.queueType === 'pickup') {
    const t = textFor(o, 'pickupReady', ctx);
    return { kind: 'packed', label: t.sent ? `Packed · text ${firstOf(o)}` : `Packed · ${t.why}` };
  }
  if (r.stage === 'ready') return { kind: 'onMyWay', label: 'On my way' };
  if (r.stage === 'waiting' && tracksPickups) return { kind: 'pickedUp', label: 'Picked up' };
  if (r.stage === 'out') return { kind: 'delivered', label: 'Delivered' };
  return null;
}

/** The line in the toast after a hand-off button: "Ruth's order is set out." */
export function handOffMessage(kind: QueueActionKind, o: Order, finished = false): string {
  const who = `${firstOf(o)}'s ${o.queueType === 'delivery' ? 'delivery' : 'order'}`;
  if (kind === 'packed') return finished ? `${who} is set out and done.` : `${who} is set out.`;
  if (kind === 'onMyWay') return `${who} is on the way.`;
  if (kind === 'pickedUp') return `${who} is picked up.`;
  const apt = pickupApt(o);
  return apt ? `${who} reached Apt ${apt}.` : `${who} was handed over.`;
}

/**
 * What Undo puts back on an order still on the list. Picked up and
 * Delivered close the order, so Undo reopens it first (see usePudActions).
 * A text that went out can't be called back; Undo only moves the order.
 */
export function undoPatch(kind: QueueActionKind): Partial<Order> {
  const handedOn: Partial<Order> = { notified: false, notifiedAt: undefined };
  if (kind === 'packed') return { ...handedOn, setOut: undefined, deliveredAt: undefined };
  if (kind === 'onMyWay') return { ...handedOn, pickedUpAt: undefined, textedOnWayAt: undefined };
  return { deliveredAt: undefined, setOut: undefined };
}

/** The hover text on a stage that was texted: "Texted: Hi Ruth, ..." */
export function textedTitle(r: QueueRow, ctx: TextContext, message: (o: Order) => string): string | undefined {
  if (r.stage !== 'waiting' && r.stage !== 'out') return undefined;
  return textFor(r.order, queueTextKey(r.order), ctx).sent ? `Texted: ${message(r.order)}` : undefined;
}

/** Deliveries ready to leave: worth taking in one trip when there are two or more. */
export const readyDeliveries = (rows: QueueRow[]) => rows.filter((r) => r.order.queueType === 'delivery' && r.stage === 'ready');

/** The sentence under "N deliveries are ready" about who gets an on-the-way text. */
export function runTextNote(runs: QueueRow[], ctx: TextContext): string {
  const untexted = runs.filter((r) => !textFor(r.order, 'deliveryOut', ctx).sent).map((r) => firstOf(r.order));
  if (!untexted.length) return 'Each resident gets an on-the-way text.';
  if (ctx.texts.deliveryOut?.on === false) return 'On-the-way texts are off, so nothing is texted.';
  if (untexted.length === runs.length) return 'No one here has a mobile, so nothing is texted.';
  return `Each gets an on-the-way text except ${untexted.join(' and ')} (no mobile).`;
}

// ─── Completed today ─────────────────────────────────────────────────────

export interface CompletedSummary {
  count: number;
  /** Share handed over on time, or null with nothing handed over yet. */
  onTimePercent: number | null;
  pickedUp: number;
  delivered: number;
}

export function completedSummary(list: Order[]): CompletedSummary {
  const onTime = list.filter((o) => pickupLateMinutes(o) <= 0).length;
  return {
    count: list.length,
    onTimePercent: list.length ? Math.round((onTime / list.length) * 100) : null,
    pickedUp: list.filter((o) => o.queueType === 'pickup').length,
    delivered: list.filter((o) => o.queueType === 'delivery').length,
  };
}

export interface CompletedView {
  /** "Ready on time", "Delivered 8m late" */
  headline: string;
  late: boolean;
  /** "Booked 3:45 to 4:00 PM · ready 3:41 PM · delivered 3:53 PM" */
  detail: string;
}

export function completedView(o: Order): CompletedView {
  const at = handedOffAt(o);
  const due = parseClockTime(o.readyAt);
  const lateBy = pickupLateMinutes(o);
  const pickup = o.queueType === 'pickup';
  const after = due ? clockMinutes(due, at) : 0;
  const parts = [`Booked ${rangeOf(o.readyAt)}`];
  if (o.readyStampAt) parts.push(`ready ${clockLabel(o.readyStampAt)}`);
  if (pickup && !o.setOut && after > 5) parts.push(`collected ${after}m after`);
  parts.push(pickup ? `${o.setOut ? 'set out' : 'picked up'} ${clockLabel(at)}` : `delivered ${clockLabel(at)}`);
  return {
    headline: `${pickup ? 'Ready' : 'Delivered'} ${lateBy > 0 ? `${lateBy}m late` : 'on time'}`,
    late: lateBy > 0,
    detail: parts.join(' · '),
  };
}
