import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedOrders } from '../../../data';
import type { Diner, Order, OrderLine } from '../../../domain/types';
import { triageByServer, triageRows, type TriageReason, type TriageRow } from '../floor/triage';
import { actionLabel, loadText, needText, pickupIssues, rowActionLabel, rowActions, triageGroups } from '../triage/triageList';

/** 6:00 PM on a fixed day. */
const T0 = new Date(2026, 9, 7, 18, 0, 0, 0).getTime();
const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

let n = 0;
const line = (itemId: string, extra: Partial<OrderLine> = {}): OrderLine => ({
  id: 'l' + ++n,
  itemId,
  mods: {},
  note: '',
  sent: false,
  kitchenState: null,
  ...extra,
});
const diner = (items: OrderLine[], extra: Partial<Diner> = {}): Diner => ({
  id: 'd' + ++n,
  kind: 'resident',
  refId: 'r1',
  isGuest: false,
  seat: 1,
  items,
  ...extra,
});
const order = (diners: Diner[], extra: Partial<Order> = {}): Order => ({
  id: 'o' + ++n,
  tableId: 't_sq3',
  room: 'sequoia',
  server: 'AA',
  meal: 'Dinner',
  openedAt: T0 - 20 * MIN,
  diners,
  ...extra,
});
const t = (k: string) => ({ passLate: 5, floorCook: 20, closeLate: 30, seatLate: 0, eatLate: 0 })[k] || Infinity;

const why = (kind: TriageReason['kind'], late: boolean, mins: number, course?: number): TriageReason => ({
  kind,
  course,
  late,
  mins,
  text: `${kind} ${mins}`,
  act: kind,
  score: (late ? 1000 : 0) + mins,
});
const row = (id: string, ...reasons: TriageReason[]): TriageRow => ({
  order: order([], { id }),
  stage: { key: 'eat', label: '', since: T0 },
  why: reasons,
});

describe('triage list', () => {
  it('says what to do as a verb with the table in it', () => {
    expect(actionLabel({ kind: 'run', course: 1 }, 'EG 7')).toBe('Run starters to EG 7');
    expect(actionLabel({ kind: 'run', course: 2 }, 'SQ 15')).toBe('Run entrees to SQ 15');
    expect(actionLabel({ kind: 'checkIn', course: 2 }, 'SQ 5')).toBe('Check in with SQ 5');
    expect(actionLabel({ kind: 'close' }, 'SQ 8')).toBe('Close the check at SQ 8');
    expect(actionLabel({ kind: 'order' }, 'B 2')).toBe('Take the order at B 2');
    expect(actionLabel({ kind: 'cook' }, 'SQ 1')).toBe('Ask the kitchen about SQ 1');
  });

  it('puts past-the-mark rows in Now, the rest in Soon, kitchen trouble apart and fine tables last', () => {
    const rows = [
      row('a', why('close', false, 18)),
      row('b', why('run', true, 8, 1), why('drinks', false, 3)),
      row('c'),
      row('d', why('run', true, 10, 1)),
      row('e', why('cook', true, 25)),
      row('f', why('run', false, 2, 2)),
    ];
    const g = triageGroups(rows, (o) => o.id.toUpperCase());
    expect(g.now.map((x) => x.label)).toEqual(['Run starters to D', 'Run starters to B']);
    expect(g.now[1].also).toEqual(['drinks 3']);
    expect(g.soon.map((x) => x.key)).toEqual(['a', 'f']);
    expect(g.kitchen.map((x) => x.label)).toEqual(['Ask the kitchen about E']);
    expect(g.fine.map((r) => r.order.id)).toEqual(['c']);
  });

  it('groups the seeded floor with the worst run on top', () => {
    const g = triageGroups(triageRows(seedOrders(), { t, checkInAfter: 2 }), (o) => o.id);
    expect(g.now.length).toBeGreaterThan(0);
    expect(g.now.every((x) => x.late)).toBe(true);
    expect(g.soon.every((x) => !x.late)).toBe(true);
    expect(g.now.every((x, i) => i === 0 || g.now[i - 1].score >= x.score)).toBe(true);
  });

  it('flags a pick up due and not ready: amber in its range, red once the range has passed', () => {
    const cooking = [diner([line('d_peach', { sent: true, kitchenState: 'cooking', firedAt: T0 - 15 * MIN })])];
    const due = (readyAt: string, extra: Partial<Order> = {}) => order(cooking, { queueType: 'pickup', tableId: '', readyAt, ...extra });
    const [soon] = pickupIssues([due('5:50 PM')]);
    expect(soon).toMatchObject({ kind: 'pickup', late: false, mins: 10, due: 'Due 5:50 PM', also: ['Still cooking'] });
    expect(soon.label).toMatch(/^Chase the pick up for /);
    expect(pickupIssues([due('5:30 PM', { queueType: 'delivery' })])[0]).toMatchObject({ late: true, mins: 30 });
    expect(pickupIssues([due('6:15 PM')])).toEqual([]);
    const ready = order([diner([line('d_peach', { sent: true, kitchenState: 'ready' })])], { queueType: 'pickup', tableId: '', readyAt: '5:30 PM' });
    expect(pickupIssues([ready])).toEqual([]);
    expect(pickupIssues([due('5:30 PM', { deliveredAt: T0 })])).toEqual([]);
  });

  it('offers the one-tap fix My Tables offers, and nothing that needs the check', () => {
    expect(rowActions('run', [{ kind: 'run', course: 1 }])).toEqual([{ kind: 'served', course: 1 }]);
    expect(
      rowActions('run', [
        { kind: 'grab', course: 2 },
        { kind: 'markServed', course: 2 },
      ]),
    ).toEqual([{ kind: 'served', course: 2 }]);
    expect(rowActions('run', [{ kind: 'readyAtPass', course: 1 }])).toEqual([]);
    expect(rowActions('checkIn', [{ kind: 'checkIn', course: 2, awake: true }])).toEqual([{ kind: 'checkIn', course: 2 }]);
    expect(rowActions('eat', [{ kind: 'fire', course: 3, fireAs: [3], label: 'Fire dessert' }])).toEqual([
      { kind: 'fire', course: 3, fireAs: [3], label: 'Fire dessert' },
    ]);
    expect(rowActions('close', [{ kind: 'trivia' }, { kind: 'quickClose' }])).toEqual([{ kind: 'quickClose' }]);
    expect(rowActions('close', [{ kind: 'trivia' }, { kind: 'confirmPayment' }])).toEqual([]);
    expect(rowActions('order', [{ kind: 'takeOrder' }])).toEqual([]);
    expect(rowActions('drinks', [{ kind: 'drinks', pour: true, upCount: 0 }])).toEqual([{ kind: 'drinks' }]);
    expect(rowActionLabel({ kind: 'served', course: 1 })).toBe('Mark served');
    expect(rowActionLabel({ kind: 'quickClose' })).toBe('Quick close');
  });

  it('sums up each associate in a few words', () => {
    const by = triageByServer(triageRows(seedOrders(), { t, checkInAfter: 2 }));
    expect(needText(by[0])).toMatch(/^\d+ needs? help$/);
    expect(needText({ need: [] })).toBe('All good');
    expect(loadText({ rows: [row('x')], covers: 2 })).toBe('1 table · 2 covers');
  });
});
