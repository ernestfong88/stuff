import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../domain/config';
import type { Order, OrderLine } from '../../../domain/types';
import { barQueue, roomHasBar } from '../barQueue';

const drink = (id: string, extra: Partial<OrderLine>): OrderLine => ({ id, itemId: 'cv_marg', mods: {}, note: '', sent: true, drink: true, kitchenState: 'bar', ...extra });
const check = (id: string, items: OrderLine[], extra: Partial<Order> = {}): Order => ({
  id,
  tableId: 't_b1',
  room: 'bistro',
  server: 'AA',
  meal: 'Dinner',
  openedAt: 0,
  diners: [{ id: id + 'd', kind: 'resident', refId: 'r1', isGuest: false, seat: 1, items }],
  ...extra,
});

describe('barQueue', () => {
  it('lists drinks to make oldest first and drinks waiting for pickup', () => {
    const q = barQueue([
      check('a', [drink('1', { firedAt: 500 })]),
      check('b', [drink('2', { firedAt: 100 }), drink('3', { kitchenState: 'up', firedAt: 50, upAt: 300 })]),
      check('c', [drink('4', { kitchenState: 'pour', firedAt: 10 }), drink('5', { cancelled: true, firedAt: 1 })]),
      check('d', [drink('6', { firedAt: 1 })], { queueType: 'pickup' }),
    ]);
    expect(q.make.map((t) => t.order.id)).toEqual(['b', 'a']);
    expect(q.make[0].since).toBe(100);
    expect(q.waiting.map((t) => [t.order.id, t.since])).toEqual([['b', 300]]);
  });

  it('knows which rooms send drinks to a bar', () => {
    expect(roomHasBar('bistro', DEFAULT_CONFIG)).toBe(true);
    expect(roomHasBar('sequoia', DEFAULT_CONFIG)).toBe(false);
    expect(roomHasBar('sequoia', { ...DEFAULT_CONFIG, route: { 'sequoia|d_beer805': 'bar' } })).toBe(true);
  });
});
