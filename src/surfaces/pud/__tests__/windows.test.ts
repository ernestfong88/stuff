import { describe, expect, it } from 'vitest';
import type { Order } from '../../../domain/types';
import {
  isNocWindow,
  mealWindows,
  minuteLabel,
  nocStarts,
  rangeLabel,
  rangeOf,
  roomTag,
  windowCaps,
  windowCutoff,
  windowMinute,
  windowRoom,
  windowStarts,
  windowTypeOn,
  windowUsage,
} from '../service/windows';

const order = (id: string, readyAt: string, extra: Partial<Order> = {}): Order => ({
  id,
  room: 'sequoia',
  server: 'AA',
  meal: 'Dinner',
  openedAt: new Date(2026, 9, 7, 12, 0).getTime(),
  queueType: 'pickup',
  readyAt,
  diners: [{ id: id + 'd', kind: 'resident', refId: 'r1', isGuest: false, seat: 1, items: [{ id: id + 'i', itemId: 'd_spag', mods: {}, note: '', sent: true, kitchenState: 'scheduled' }] }],
  ...extra,
});

describe('labels', () => {
  it('labels minutes and ranges, across noon and midnight', () => {
    expect(minuteLabel(1020)).toBe('5:00 PM');
    expect(minuteLabel(1560)).toBe('2:00 AM');
    expect(rangeLabel(1020)).toBe('5:00 to 5:15 PM');
    expect(rangeLabel(705)).toBe('11:45 AM to 12:00 PM');
    expect(rangeOf('6:30 PM')).toBe('6:30 to 6:45 PM');
    expect(rangeOf('soon')).toBe('soon');
  });

  it('reads times before 6 AM as the NOC shift past midnight', () => {
    expect(windowMinute('2:00 AM')).toBe(1560);
    expect(windowMinute('11:00 PM')).toBe(1380);
    expect(windowMinute('12:15 PM')).toBe(735);
    expect(isNocWindow('11:00 PM')).toBe(true);
    expect(isNocWindow('7:00 PM')).toBe(false);
  });
});

describe('ranges offered', () => {
  it('offers the meal hours until Back Office changes them', () => {
    const dinner = mealWindows({}, 'pickup', 'sequoia', 'Dinner');
    expect(dinner[0]).toEqual({ start: 990, at: '4:30 PM' });
    expect(dinner.at(-1)?.at).toBe('7:45 PM');
    expect(nocStarts({}, 'sequoia')).toEqual(Array.from({ length: 12 }, (_, i) => 1380 + i * 15));
    expect(windowCutoff({})).toBe(45);
  });

  it('keeps only quarter hours inside the day from a saved grid', () => {
    const w = { grid: { sequoia: { pickup: [1035, 1020, 1021, 300, 1500] } } };
    expect(windowStarts(w, 'sequoia', 'pickup')).toEqual([1020, 1035]);
    expect(windowStarts(w, 'bistro', 'pickup').length).toBeGreaterThan(0);
  });

  it('associate meals always book a range; other types can be switched off', () => {
    const w = { types: { pickup: { on: false }, assoc: { on: false } } };
    expect(windowTypeOn(w, 'pickup')).toBe(false);
    expect(windowTypeOn(w, 'assoc')).toBe(true);
    expect(windowTypeOn(w, 'delivery')).toBe(true);
  });
});

describe('capacity', () => {
  it('starts Sequoia at 4 a range, and a saved cap replaces it', () => {
    expect(windowCaps({}, 'sequoia')).toEqual({ total: 4, pickup: 0, assoc: 0, delivery: 0 });
    expect(windowCaps({}, 'bistro').total).toBe(0);
    expect(windowCaps({ cap: { sequoia: { pickup: 2 } } }, 'sequoia')).toEqual({ total: 0, pickup: 2, assoc: 0, delivery: 0 });
  });

  it('counts orders and associate meals in a range and says how many are left', () => {
    const b = {
      orders: [order('a', '6:30 PM'), order('b', '6:30 PM', { queueType: 'delivery' }), order('c', '6:45 PM')],
      history: [order('d', '6:30 PM')],
      assocOrders: [{ id: 'm', date: '2026-10-07', meal: 'Dinner', window: '6:30 PM', associate: 'Grace', item: 'x', status: 'Planned', note: '', log: [] }],
    };
    expect(windowUsage(b, 'sequoia', 1110, '2026-10-07')).toEqual({ pickup: 2, assoc: 1, delivery: 1, total: 4 });
    expect(windowUsage(b, 'sequoia', 1110, '2026-10-07', 'a').total).toBe(3);
    const full = windowRoom({}, b, 'pickup', 'sequoia', 1110, '2026-10-07');
    expect(full).toMatchObject({ left: 0, full: true });
    expect(roomTag(full)).toBe('Full');
    const two = windowRoom({}, b, 'pickup', 'sequoia', 1125, '2026-10-07');
    // Three places left is plenty, so no tag.
    expect(two.left).toBe(3);
    expect(roomTag(two)).toBe('');
    expect(roomTag(windowRoom({ cap: { sequoia: { total: 3 } } }, b, 'pickup', 'sequoia', 1125, '2026-10-07'))).toBe('2 left');
    expect(windowRoom({}, b, 'pickup', 'bistro', 1110, '2026-10-07')).toMatchObject({ left: null, full: false });
  });

  it('ignores orders with nothing on them and other days', () => {
    const empty = order('e', '6:30 PM', { diners: [] });
    const tomorrow = order('t', '6:30 PM', { forDate: '2026-10-08' });
    expect(windowUsage({ orders: [empty, tomorrow], history: [], assocOrders: [] }, 'sequoia', 1110, '2026-10-07').total).toBe(0);
    expect(windowUsage({ orders: [empty, tomorrow], history: [], assocOrders: [] }, 'sequoia', 1110, '2026-10-08').total).toBe(1);
  });
});
