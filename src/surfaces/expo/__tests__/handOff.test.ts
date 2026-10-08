import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diner, freezeClock, line, order } from '../../../domain/__tests__/helpers';
import { assocTickets, missedAssocTickets } from '../assocTickets';
import { buildExpoTickets, handedOn } from '../expoTickets';
import { ticketClock } from '../ExpoTicketCard';

const MIN = 60_000;
const ready = () => line('d_peach', { sent: true, kitchenState: 'ready', course: 1, firedAt: 1 });

describe('Expo and PU & Delivery share one order state', () => {
  it('a pick up set out, or a delivery out the door, is off the pass', () => {
    const pu = order([diner([ready()])], { queueType: 'pickup', tableId: undefined });
    expect(buildExpoTickets([pu]).length).toBe(1);
    // PU & Delivery "Packed" (or Expo "Packed and set out?") marks it notified.
    expect(handedOn({ ...pu, notified: true })).toBe(true);
    expect(buildExpoTickets([{ ...pu, notified: true }])).toEqual([]);
    // "On my way" on either screen.
    const del = order([diner([ready()])], { queueType: 'delivery', tableId: undefined, pickedUpAt: 5 });
    expect(buildExpoTickets([del])).toEqual([]);
    // A table is never "handed on".
    expect(handedOn(order([diner([ready()])], { notified: true }))).toBe(false);
  });

  it('an order booked ahead shows when it fires, not hours of elapsed time', () => {
    const at = new Date(2026, 9, 7, 17, 45).getTime();
    const later = order([diner([line('d_peach', { sent: true, kitchenState: 'scheduled', course: 1, firedAt: at - 3 * 60 * MIN })])], {
      queueType: 'delivery',
      tableId: undefined,
      fireAtTs: new Date(2026, 9, 7, 19, 15).getTime(),
    });
    const [t] = buildExpoTickets([later]);
    expect(ticketClock(t, at)).toBe('fires 7:15 PM');
  });
});

describe('associate meals nobody fired', () => {
  const meal = (id: string, window: string, extra = {}) => ({ id, date: '2026-10-07', meal: 'Lunch', window, associate: 'Maria Lopez', item: 'TURKEY CLUB', status: 'Planned', note: '', log: [], ...extra });
  const at = new Date(2026, 9, 7, 17, 45).getTime();
  beforeEach(() => freezeClock(at));
  afterEach(() => vi.useRealTimers());

  it('leave the pass an hour after their window starts, listed as missed', () => {
    const list = [meal('a', '11:00 AM'), meal('b', '5:00 PM'), meal('c', '6:30 PM'), meal('d', '11:00 AM', { firedAt: at - 60 * MIN })];
    expect(assocTickets(list, '2026-10-07', true, at).map((t) => t.meal.id)).toEqual(['d', 'b', 'c']);
    expect(missedAssocTickets(list, '2026-10-07', true, at).map((t) => t.meal.id)).toEqual(['a']);
    // Without a time, nothing ages out (as before).
    expect(assocTickets(list, '2026-10-07', true).length).toBe(4);
  });
});
