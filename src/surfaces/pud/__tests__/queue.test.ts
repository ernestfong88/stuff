import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KitchenState, Order } from '../../../domain/types';
import { MINUTE } from '../../../lib/clock';
import { nocGroups, setOutMeal } from '../queue/noc';
import {
  completedSummary,
  completedToday,
  completedView,
  dueText,
  groupSlots,
  isLate,
  nextAction,
  nowLineIndex,
  openRows,
  runTextNote,
  slotHeading,
  slotSummary,
  stageView,
  statusCounts,
  type QueueRow,
} from '../queue/queue';
import { fillText, lacksMobile, smsParts, textFor, textMessage, type TextContext } from '../service/texts';

/** 6:00 PM on the demo day. */
const T0 = new Date(2026, 9, 7, 18, 0, 0, 0).getTime();
const at = (h: number, m: number) => new Date(2026, 9, 7, h, m).getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

const ctx: TextContext = { texts: {}, mobile: {} };

function order(id: string, o: Partial<Order> & { state?: KitchenState; sent?: boolean; rid?: string } = {}): Order {
  const { state = 'cooking', sent = true, rid = 'r2', ...rest } = o;
  return {
    id,
    room: 'sequoia',
    server: 'AA',
    meal: 'Dinner',
    openedAt: T0 - 30 * MINUTE,
    queueType: 'pickup',
    readyAt: '6:15 PM',
    diners: [
      { id: id + 'd', kind: 'resident', refId: rid, isGuest: false, seat: 1, items: [{ id: id + 'i', itemId: 'd_spag', mods: {}, note: '', sent, kitchenState: sent ? state : null, firedAt: T0 - 6 * MINUTE }] },
    ],
    ...rest,
  };
}

const row = (o: Order): QueueRow => openRows([o])[0];

describe('the open list', () => {
  it('sorts by promise and groups 15 minute ranges, with the NOW line before the first one still to come', () => {
    const rows = openRows([order('b', { readyAt: '6:15 PM' }), order('a', { readyAt: '5:45 PM' }), order('c', { readyAt: '6:15 PM', queueType: 'delivery' })]);
    expect(rows.map((r) => r.order.id)).toEqual(['a', 'b', 'c']);
    const slots = groupSlots(rows);
    expect(slots.map((s) => s.rows.length)).toEqual([1, 2]);
    expect(slotHeading(slots[1])).toBe('6:15 to 6:30 PM');
    expect(slotSummary(slots[1].rows)).toBe('1 pick up · 1 delivery');
    expect(nowLineIndex(slots, T0)).toBe(1);
    expect(nowLineIndex(slots.slice(1), T0)).toBe(-1);
  });

  it('labels a range booked for tomorrow', () => {
    const slots = groupSlots(openRows([order('t', { forDate: '2026-10-08' })]));
    expect(slotHeading(slots[0])).toBe('Tomorrow · 6:15 to 6:30 PM');
  });

  it('is late a full minute past the promise, but never while waiting at the counter', () => {
    const r = row(order('a', { readyAt: '6:00 PM' }));
    expect(isLate(r, T0 + 30_000)).toBe(false);
    expect(isLate(r, T0 + MINUTE)).toBe(true);
    const waiting = row(order('w', { readyAt: '5:30 PM', notified: true, notifiedAt: T0 - 5 * MINUTE }));
    expect(waiting.stage).toBe('waiting');
    expect(isLate(waiting, T0)).toBe(false);
    expect(dueText(waiting, T0)).toEqual({ text: '30m past', tone: 'past' });
    expect(dueText(r, T0 + 6 * MINUTE)).toEqual({ text: '6m late', tone: 'late' });
    expect(dueText(row(order('s', { readyAt: '6:15 PM' })), T0)).toEqual({ text: 'in 15m', tone: 'later' });
    expect(dueText(row(order('n', { readyAt: '6:00 PM' })), T0)).toEqual({ text: 'due now', tone: 'soon' });
  });

  it('counts the status summary', () => {
    const rows = openRows([
      order('late', { readyAt: '5:30 PM' }),
      order('ready', { state: 'ready' }),
      order('wait', { notified: true }),
      order('out', { notified: true, queueType: 'delivery' }),
      order('sched', { state: 'scheduled' }),
      order('draft', { sent: false }),
    ]);
    expect(statusCounts(rows, T0)).toEqual({ late: 1, ready: 1, waiting: 1, out: 1, cooking: 1, later: 2 });
  });
});

describe('stage wording and the next step', () => {
  it('describes each stage', () => {
    expect(stageView(row(order('d', { sent: false })), T0, ctx, 20)).toEqual({ label: 'Not sent yet', tone: 'muted', detail: 'Finish the order to send it' });
    expect(stageView(row(order('s', { state: 'scheduled' })), T0, ctx, 20).detail).toBe('Kitchen fires at 5:55 PM');
    expect(stageView(row(order('c')), T0, ctx, 20).detail).toBe('Cooking 6m');
    expect(stageView(row(order('r', { state: 'ready', readyStampAt: T0 - 2 * MINUTE })), T0, ctx, 20).detail).toBe('Up for 2m');
    expect(stageView(row(order('w', { notified: true, notifiedAt: T0 - 9 * MINUTE })), T0, ctx, 20).detail).toBe('Texted 9m ago');
    expect(stageView(row(order('j', { notified: true, notifiedAt: T0 - 20_000 })), T0, ctx, 20).detail).toBe('Texted just now');
    // Joan (r6) has no phone.
    expect(stageView(row(order('n', { rid: 'r6', notified: true, notifiedAt: T0 - 9 * MINUTE })), T0, ctx, 20).detail).toBe('Ready 9m ago · not texted, no mobile');
    expect(stageView(row(order('o', { queueType: 'delivery', notified: true, notifiedAt: T0 - 3 * MINUTE })), T0, ctx, 20)).toMatchObject({
      label: 'On the way',
      detail: 'Left 3m ago',
    });
  });

  it('offers one button for what the order needs next', () => {
    expect(nextAction(row(order('d', { sent: false })), ctx, true)).toEqual({ kind: 'finish', label: 'Finish order' });
    expect(nextAction(row(order('p', { state: 'ready' })), ctx, true)).toEqual({ kind: 'packed', label: 'Packed · text Eleanor' });
    expect(nextAction(row(order('q', { state: 'ready', rid: 'r6' })), ctx, true)?.label).toBe('Packed · no mobile');
    expect(nextAction(row(order('q', { state: 'ready' })), { texts: { pickupReady: { on: false } }, mobile: {} }, true)?.label).toBe('Packed · no text');
    expect(nextAction(row(order('r', { state: 'ready', queueType: 'delivery' })), ctx, true)?.kind).toBe('onMyWay');
    expect(nextAction(row(order('w', { notified: true })), ctx, true)?.kind).toBe('pickedUp');
    expect(nextAction(row(order('w', { notified: true })), ctx, false)).toBeNull();
    expect(nextAction(row(order('o', { notified: true, queueType: 'delivery' })), ctx, true)?.kind).toBe('delivered');
    expect(nextAction(row(order('c')), ctx, true)).toBeNull();
  });

  it('says who gets an on-the-way text when deliveries go together', () => {
    const d = (id: string, rid: string) => row(order(id, { rid, state: 'ready', queueType: 'delivery' }));
    expect(runTextNote([d('a', 'r2'), d('b', 'r3')], ctx)).toBe('Each resident gets an on-the-way text.');
    expect(runTextNote([d('a', 'r2'), d('b', 'r6')], ctx)).toBe('Each gets an on-the-way text except Joan (no mobile).');
    expect(runTextNote([d('a', 'r6'), d('b', 'r22')], ctx)).toBe('No one here has a mobile, so nothing is texted.');
    expect(runTextNote([d('a', 'r2')], { texts: { deliveryOut: { on: false } }, mobile: {} })).toBe('On-the-way texts are off, so nothing is texted.');
  });
});

describe('completed today', () => {
  it('lists today’s handed-off orders, latest first, with how on time they were', () => {
    const early = order('e', { readyAt: '5:00 PM', readyStampAt: at(16, 58), deliveredAt: at(17, 10), closedAt: at(17, 10) });
    const late = order('l', { queueType: 'delivery', readyAt: '5:00 PM', readyStampAt: at(16, 59), deliveredAt: at(17, 8), closedAt: at(17, 8) });
    const yesterday = order('y', { deliveredAt: at(17, 0) - 86_400_000 });
    const list = completedToday([early, late, yesterday], at(0, 0));
    expect(list.map((o) => o.id)).toEqual(['e', 'l']);
    expect(completedSummary(list)).toEqual({ count: 2, onTimePercent: 50, pickedUp: 1, delivered: 1 });
    expect(completedView(early)).toEqual({
      headline: 'Ready on time',
      late: false,
      detail: 'Booked 5:00 to 5:15 PM · ready 4:58 PM · collected 10m after · picked up 5:10 PM',
    });
    expect(completedView(late)).toMatchObject({ headline: 'Delivered 8m late', late: true });
    expect(completedView({ ...early, setOut: true }).detail).toBe('Booked 5:00 to 5:15 PM · ready 4:58 PM · set out 5:10 PM');
    expect(completedSummary([]).onTimePercent).toBeNull();
  });
});

describe('texts', () => {
  it('fills placeholders and leaves unknown ones showing', () => {
    expect(fillText('Hi {first}, {nope}', { first: 'Ruth' })).toBe('Hi Ruth, {nope}');
    expect(textMessage(order('a'), 'pickupReady', ctx)).toBe('Hi Eleanor, your dinner from Sequoia / Evergreen is ready for you to come get.');
    expect(textMessage(order('a', { queueType: 'delivery' }), 'deliveryOut', { texts: { deliveryOut: { body: '{first}: on the way to {apt}' } }, mobile: {} })).toBe(
      'Eleanor: on the way to 208',
    );
  });

  it('texts only a resident with a mobile, unless Back Office says otherwise', () => {
    expect(textFor(order('a'), 'pickupReady', ctx)).toMatchObject({ sent: true, why: '' });
    expect(textFor(order('a', { rid: 'r4' }), 'pickupReady', ctx)).toEqual({ sent: false, why: 'no mobile' });
    expect(textFor(order('a'), 'pickupReady', { texts: {}, mobile: { r2: false } })).toEqual({ sent: false, why: 'no mobile' });
    expect(lacksMobile(order('a', { rid: 'r22' }), {})).toBe(true);
    expect(smsParts('x'.repeat(160))).toBe(1);
    expect(smsParts('x'.repeat(161))).toBe(2);
  });
});

describe('NOC meals', () => {
  it('groups tonight’s live NOC meals by range and stamps the set-out time', () => {
    const m = (id: string, window: string, status = 'Planned') => ({ id, date: '2026-10-07', meal: 'NOC', window, associate: id, item: 'Soup', status, note: '', log: [] });
    const groups = nocGroups([m('a', '2:00 AM'), m('b', '11:00 PM'), m('c', '11:00 PM'), m('d', '11:00 PM', 'Cancelled — shift removed'), m('e', '7:00 PM')], '2026-10-07');
    expect(groups.map((g) => [g.window, g.meals.map((x) => x.id)])).toEqual([
      ['11:00 PM', ['b', 'c']],
      ['2:00 AM', ['a']],
    ]);
    const out = setOutMeal(groups[0].meals[0], true, T0);
    expect(out.readyAt).toBe(T0);
    expect(setOutMeal(out, false, T0).readyAt).toBeNull();
    expect(out.log).toEqual([{ by: 'PU', at: T0, text: 'Set out for NOC pickup' }]);
  });
});
