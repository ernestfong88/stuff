import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedOrders } from '../../data';
import { holdInfo, tableStatus, TABLE_STATUS_COLORS, stampReady, addCheck, tableName } from '../orders';
import { T0, advance, diner, freezeClock, line, order, prototype } from './helpers';

beforeEach(() => freezeClock());
afterEach(() => vi.useRealTimers());

describe('tableStatus', () => {
  it('matches the prototype for every seeded order', () => {
    const got = Object.fromEntries(seedOrders().map((o) => [o.id, tableStatus(o)]));
    expect(got).toEqual(prototype.tableStatus);
  });

  it('is open with no check or nobody seated', () => {
    expect(tableStatus(undefined)).toBe('open');
    expect(tableStatus(order([]))).toBe('open');
  });

  it('is seated until something is in the kitchen, and again once everything is run', () => {
    expect(tableStatus(order([diner([line('d_peach')])]))).toBe('seated');
    expect(tableStatus(order([diner([line('d_peach', { sent: true, kitchenState: 'cleared' })])]))).toBe('seated');
  });

  it('is ready only when every live plate is at the pass', () => {
    const ready = line('d_peach', { sent: true, kitchenState: 'ready' });
    const cooking = line('d_cbsoup', { sent: true, kitchenState: 'cooking' });
    const run = line('d_trifle', { sent: true, kitchenState: 'cleared' });
    expect(tableStatus(order([diner([ready, run])]))).toBe('ready');
    expect(tableStatus(order([diner([ready, cooking])]))).toBe('cooking');
  });

  it('has a colour for every status', () => {
    expect(TABLE_STATUS_COLORS.cooking).toBe('#B23B2E');
    expect(Object.keys(TABLE_STATUS_COLORS)).toEqual(['open', 'seated', 'cooking', 'ready', 'hold']);
  });
});

describe('holdInfo', () => {
  it('counts unsent held lines and minutes since the oldest hold', () => {
    const o = order([diner([line('d_peach', { hold: true, holdAt: T0 }), line('d_trifle', { hold: true, holdAt: T0 + 60_000 })])]);
    advance(5 * 60_000);
    expect(holdInfo(o)).toEqual({ count: 2, mins: 5 });
    expect(holdInfo(order([diner([line('d_peach')])]))).toBeNull();
  });
});

describe('stampReady', () => {
  it('stamps when every live plate is up and clears the stamp when one goes back', () => {
    const o = order([diner([line('d_peach', { sent: true, kitchenState: 'ready' }), line('d_mashed', { sent: true, kitchenState: 'cooking' })])]);
    const stamped = stampReady(o);
    // The side does not hold the stamp back.
    expect(stamped.readyStampAt).toBe(T0);
    const back = stampReady({ ...stamped, diners: [diner([line('d_peach', { sent: true, kitchenState: 'cooking' })])] });
    expect(back.readyStampAt).toBeNull();
  });
});

describe('addCheck', () => {
  it('letters checks that share a table, never relabelling the first', () => {
    const a = order([], { id: 'a', tableId: 't1' });
    const b = order([], { id: 'b', tableId: 't1' });
    const c = order([], { id: 'c', tableId: 't1' });
    const list = addCheck(addCheck(addCheck([], a), b), c);
    expect(list.map((o) => o.checkTag)).toEqual(['A', 'B', 'C']);
    expect(addCheck([], a)[0].checkTag).toBeUndefined();
  });

  it('names tables and queue orders', () => {
    expect(tableName(order([], { tableId: 't_sq3', checkTag: 'B' }))).toMatch(/B$/);
    expect(tableName(order([], { tableId: undefined, queueType: 'delivery' }))).toBe('Delivery');
  });
});
