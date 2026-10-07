import { describe, expect, it } from 'vitest';
import { alcoholThisMeal } from '../alcohol';
import type { Diner, Order, OrderLine } from '../types';

const line = (itemId: string, extra: Partial<OrderLine> = {}): OrderLine => ({
  id: itemId + Math.random(),
  itemId,
  mods: {},
  note: '',
  sent: true,
  kitchenState: 'cleared',
  ...extra,
});
const diner = (refId: string, items: OrderLine[], extra: Partial<Diner> = {}): Diner => ({
  id: 'd' + refId,
  kind: 'resident',
  refId,
  isGuest: false,
  seat: 1,
  items,
  ...extra,
});
const order = (meal: Order['meal'], openedAt: number, diners: Diner[]): Order =>
  ({ id: 'o' + Math.random(), meal, openedAt, diners }) as unknown as Order;
const isAlcohol = (id: string) => id.startsWith('wine') || id.startsWith('beer');

describe('alcohol this meal', () => {
  const day = 1_000;
  const orders = [
    order('Dinner', 2_000, [diner('r1', [line('wine1'), line('beer1'), line('steak')]), diner('r1', [line('wine2')], { isGuest: true })]),
    order('Dinner', 3_000, [diner('r1', [line('wine3'), line('wine4', { cancelled: true })])]),
    order('Lunch', 2_000, [diner('r1', [line('wine5')])]),
    order('Dinner', 500, [diner('r1', [line('wine6')])]),
    order('Dinner', 2_000, [diner('r2', [line('wine7')])]),
  ];

  it('counts the resident’s own drinks across every check this meal today', () => {
    expect(alcoholThisMeal(orders, 'r1', 'Dinner', day, isAlcohol)).toBe(3);
  });

  it('starts again for another meal or another day', () => {
    expect(alcoholThisMeal(orders, 'r1', 'Lunch', day, isAlcohol)).toBe(1);
    expect(alcoholThisMeal(orders, 'r1', 'Breakfast', day, isAlcohol)).toBe(0);
  });
});
