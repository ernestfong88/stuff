import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendLogEvent, logEvent, needsTakeover, takeOverOrder } from '../activityLog';
import * as A from '../diningActions';
import { seedDiningState } from '../diningState';
import { learnedFavorites } from '../orders';
import { T0, advance, diner, freezeClock, line, lines, order, stateOf } from './helpers';

beforeEach(() => freezeClock());
afterEach(() => vi.useRealTimers());

describe('seed', () => {
  it('puts seeded pick up promises on quarter hours of the demo clock', () => {
    const pq5 = seedDiningState().orders.find((o) => o.id === 'pq5')!;
    // 47 minutes from 6:00 PM, on the nearest quarter hour.
    expect(pq5.readyAt).toBe('6:45 PM');
  });
});

describe('opening checks and seating', () => {
  it('newCheck letters a second check at the same table; findTableCheck filters by server', () => {
    let s = A.newCheck(stateOf(), 'c1', { tableId: 't1', room: 'sequoia', server: 'AA' });
    s = A.newCheck(s, 'c2', { tableId: 't1', room: 'sequoia', server: 'RJ' });
    expect(s.orders.map((o) => [o.id, o.checkTag, o.meal, o.openedAt])).toEqual([
      ['c1', 'A', 'Dinner', T0],
      ['c2', 'B', 'Dinner', T0],
    ]);
    expect(A.findTableCheck(s, 't1', 'RJ')?.id).toBe('c2');
    expect(A.findTableCheck(s, 't1')?.id).toBe('c1');
  });

  it('addDiner numbers seats in order; addItem brings default sides as their own lines', () => {
    let s = A.newCheck(stateOf(), 'c', { tableId: 't1', room: 'sequoia' });
    s = A.addDiner(s, 'c', 'd1', 'resident', 'r1');
    s = A.addDiner(s, 'c', 'd2', 'resident', 'r1', true, { guestName: 'Amy' });
    expect(s.orders[0].diners.map((d) => [d.seat, d.isGuest, d.guestName])).toEqual([
      [1, false, undefined],
      [2, true, 'Amy'],
    ]);
    s = A.addItem(s, 'c', 'd1', { id: 'e', itemId: 'd_peach', mods: {}, sideIds: ['s1', 's2'] });
    const items = s.orders[0].diners[0].items;
    expect(items.map((i) => [i.id, i.itemId, i.autoSide, i.parentId])).toEqual([
      ['e', 'd_peach', undefined, undefined],
      ['s1', 'd_mashed', true, 'e'],
      ['s2', 'd_greenbeans', true, 'e'],
    ]);
    expect(items[0].dfs).toEqual(['d_mashed', 'd_greenbeans']);
  });
});

describe('lines', () => {
  it('cancelLine marks a line the kitchen is working on, and removes one it never saw', () => {
    const cooking = line('d_peach', { sent: true, kitchenState: 'cooking' });
    const unsent = line('d_trifle');
    const d = diner([cooking, unsent]);
    const o = order([d]);
    let s = A.cancelLine(stateOf(o), o.id, d.id, cooking.id);
    s = A.cancelLine(s, o.id, d.id, unsent.id);
    expect(lines(s.orders[0])).toEqual([{ ...cooking, cancelled: true, cancelledAt: T0 }]);
  });

  it('remakeLine comps the line and rushes a copy marked REMAKE', () => {
    const l = line('d_peach', { sent: true, kitchenState: 'cleared', note: 'no sauce' });
    const d = diner([l]);
    const o = order([d]);
    const [orig, copy] = lines(A.remakeLine(stateOf(o), o.id, d.id, l.id, 'rm1').orders[0]);
    expect(orig.comped).toBe(true);
    expect(copy).toMatchObject({ id: 'rm1', comped: false, rush: true, note: 'no sauce · REMAKE', kitchenState: 'cooking', firedAt: T0 });
  });

  it('toggleHold stamps and clears the hold time', () => {
    const l = line('d_peach');
    const d = diner([l]);
    const o = order([d]);
    const held = A.toggleHold(stateOf(o), o.id, d.id, l.id);
    expect(lines(held.orders[0])[0]).toMatchObject({ hold: true, holdAt: T0 });
    expect(lines(A.toggleHold(held, o.id, d.id, l.id).orders[0])[0]).toMatchObject({ hold: false, holdAt: null });
  });
});

describe('kitchen and expo', () => {
  it('markCourseReady readies only that course and stamps the order when all is up', () => {
    const c1 = line('d_cbsoup', { sent: true, course: 1, kitchenState: 'cooking' });
    const c2 = line('d_peach', { sent: true, course: 2, kitchenState: 'cooking' });
    const o = order([diner([c1, c2])]);
    let s = A.markCourseReady(stateOf(o), o.id, 1);
    expect(lines(s.orders[0]).map((i) => i.kitchenState)).toEqual(['ready', 'cooking']);
    expect(s.orders[0].readyStampAt).toBeUndefined();
    s = A.markCourseReady(s, o.id, 2);
    expect(s.orders[0].readyStampAt).toBe(T0);
    s = A.clearCourse(s, o.id, 1);
    expect(lines(s.orders[0]).map((i) => i.kitchenState)).toEqual(['cleared', 'ready']);
    expect(s.orders[0].readyStampAt).toBeNull();
  });

  it('drinks: the bar makes them, then they are served', () => {
    const beer = line('d_beer805', { sent: true, drink: true, kitchenState: 'bar' });
    const coffee = line('d_coffee', { sent: true, drink: true, kitchenState: 'pour' });
    const o = order([diner([beer, coffee])]);
    let s = A.markBarUp(stateOf(o), o.id);
    expect(lines(s.orders[0]).map((i) => i.kitchenState)).toEqual(['up', 'pour']);
    s = A.serveDrinks(s, o.id);
    expect(lines(s.orders[0]).every((i) => i.kitchenState === 'cleared' && i.clearedAt === T0)).toBe(true);
  });

  it('checkIn records the course and server', () => {
    const o = order([]);
    expect(A.checkIn(stateOf(o), o.id, 2).orders[0].checkIns).toEqual([{ course: 2, at: T0, by: 'AA' }]);
  });
});

describe('closing', () => {
  it('closeOrder moves a check with lines to history with each payment; an empty one is dropped', () => {
    const d = diner([line('d_peach')]);
    const o = order([d]);
    const s = A.closeOrder(stateOf(o, order([], { id: 'empty' })), o.id, { [d.id]: 'card' });
    expect(s.orders.map((x) => x.id)).toEqual(['empty']);
    expect(s.history[0]).toMatchObject({ id: o.id, closedAt: T0, closedBy: 'AA' });
    expect(s.history[0].diners[0].chargeDrop).toBe('card');
    expect(A.closeOrder(s, 'empty').history).toHaveLength(1);
  });

  it('closeDiner closes one seat; the check closes with the last one', () => {
    const d1 = diner([line('d_peach')]);
    const d2 = diner([line('d_trifle')], { seat: 2 });
    const o = order([d1, d2]);
    let s = A.closeDiner(stateOf(o), o.id, d1.id);
    expect(s.history[0]).toMatchObject({ id: `${o.id}:${d1.id}` });
    expect(s.history[0].diners).toEqual([{ ...d1, chargeDrop: 'plan' }]);
    expect(s.orders[0].diners).toEqual([d2]);
    s = A.closeDiner(s, o.id, d2.id, 'apt');
    expect(s.orders).toEqual([]);
    expect(s.history).toHaveLength(2);
  });

  it('markDelivered closes into history charged to the apartment; reopenOrder brings it back', () => {
    const o = order([diner([line('d_peach', { sent: true, kitchenState: 'ready' })])], { queueType: 'delivery' });
    let s = A.markDelivered(stateOf(o), o.id);
    expect(s.orders).toEqual([]);
    expect(s.history[0]).toMatchObject({ deliveredAt: T0, closedAt: T0 });
    expect(s.history[0].diners[0]).toMatchObject({ chargeDrop: 'apt', items: [{ kitchenState: 'cleared' }] });
    s = A.reopenOrder(s, o.id);
    expect(s.history).toEqual([]);
    expect(s.orders[0].closedAt).toBeUndefined();
    expect(s.orders[0].deliveredAt).toBe(T0);
  });

  it('learnedFavorites ranks a resident’s most ordered combinations', () => {
    const closed = (itemId: string, at: number) =>
      order([diner([line(itemId)], { refId: 'r9' })], { closedAt: at });
    const fav = learnedFavorites([closed('d_peach', 1), closed('d_peach', 3), closed('d_trifle', 5)], 'r9');
    expect(fav.map((f) => [f.itemId, f.n, f.lastAt])).toEqual([
      ['d_peach', 2, 3],
      ['d_trifle', 1, 5],
    ]);
  });
});

describe('activity log', () => {
  it('appends to open or closed checks, and stamps readyAtMs for plates coming up', () => {
    const cooking = line('d_peach', { sent: true, course: 2, kitchenState: 'cooking' });
    const other = line('d_cbsoup', { sent: true, course: 1, kitchenState: 'cooking' });
    const o = order([diner([cooking, other])]);
    const s = appendLogEvent(stateOf(o), o.id, logEvent('markCourseReady', 'Expo', 'C2 up at the pass', 2), {
      kind: 'course',
      course: 2,
    });
    expect(s.orders[0].log).toEqual([{ at: T0, k: 'ready', by: 'Expo', what: 'C2 up at the pass', c: 2 }]);
    expect(lines(s.orders[0]).map((i) => i.readyAtMs)).toEqual([T0, undefined]);
    expect(appendLogEvent(s, 'missing', logEvent('noDessert', 'x', 'y'))).toBe(s);
  });

  it('asks before a server changes another server’s open dine-in check', () => {
    const o = order([], { server: 'RJ' });
    expect(needsTakeover('addItem', o, 'AA', 'server')).toBe(true);
    expect(needsTakeover('addItem', o, 'RJ', 'server')).toBe(false);
    expect(needsTakeover('markOrderReady', o, 'AA', 'server')).toBe(false);
    expect(needsTakeover('addItem', o, 'AA', 'cook')).toBe(false);
    expect(needsTakeover('addItem', { ...o, queueType: 'pickup' }, 'AA', 'server')).toBe(false);
  });

  it('takeOverOrder moves the check and re-attributes its trail', () => {
    const o = order([], { server: 'RJ', log: [{ at: 1, k: 'open', by: 'Ricardo', what: 'Opened the check' }] });
    advance(1000);
    const [t] = takeOverOrder([o], o.id, 'AA');
    expect(t).toMatchObject({ server: 'AA', takenFrom: 'RJ', takenAt: T0 + 1000 });
    expect(t.log![0].by).toBe('Adriana');
  });
});
