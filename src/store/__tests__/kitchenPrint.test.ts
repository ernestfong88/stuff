import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type DiningConfig } from '../../domain/config';
import { pacingTick, sendOrder, DEFAULT_CONTEXT } from '../../domain/diningActions';
import { diner, freezeClock, line, order, stateOf } from '../../domain/__tests__/helpers';
import { kitchenPrintLog, printChanges, printWarning } from '../kitchenPrint';

const printers: DiningConfig = { ...DEFAULT_CONFIG, kitchenMode: 'printers' };

beforeEach(() => freezeClock());
afterEach(() => {
  kitchenPrintLog.reset();
  vi.useRealTimers();
});

describe('printer mode prints on every path to the kitchen', () => {
  it('prints a kiosk-style order sent straight to the kitchen, and logs it', () => {
    const o = order([diner([line('d_peach'), line('d_cbsoup')])], { queueType: 'pickup', tableId: undefined, readyAt: 'ASAP', source: 'kiosk' });
    const s = sendOrder(stateOf(o), o.id, { ...DEFAULT_CONTEXT, cfg: printers });
    const [p] = printChanges([o], s.orders, printers);
    expect(p.orderId).toBe(o.id);
    expect(p.summary).toMatch(/^Printed at Hot Line/);
    // The seeded Expo Receipt can't be reached: named apart, and the warning says so.
    expect(p.down).toEqual(['Expo Receipt']);
    expect(printWarning(p)).toMatch(/Expo Receipt can't be reached/);
    expect(kitchenPrintLog.get()[0]).toMatchObject({ orderId: o.id, printers: expect.arrayContaining(['Hot Line']) });
  });

  it('prints nothing in KDS mode, and nothing again for lines already printed', () => {
    const o = order([diner([line('d_peach')])]);
    const s = sendOrder(stateOf(o), o.id, { ...DEFAULT_CONTEXT, cfg: printers });
    expect(printChanges([o], s.orders, DEFAULT_CONFIG)).toEqual([]);
    expect(printChanges(s.orders, s.orders, printers)).toEqual([]);
  });

  it('a pick up booked ahead prints when it fires, not when it is booked', () => {
    const o = order([diner([line('d_peach')])], { queueType: 'pickup', tableId: undefined, readyAt: '9:00 PM' });
    const booked = sendOrder(stateOf(o), o.id, { ...DEFAULT_CONTEXT, cfg: printers });
    expect(printChanges([o], booked.orders, printers)).toEqual([]);
    const due = booked.orders.map((x) => ({ ...x, fireAtTs: Date.now() - 1 }));
    const fired = pacingTick(due, printers);
    expect(printChanges(due, fired, printers).map((p) => p.orderId)).toEqual([o.id]);
  });
});
