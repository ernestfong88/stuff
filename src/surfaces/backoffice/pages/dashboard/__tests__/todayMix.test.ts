import { describe, expect, it } from 'vitest';
import type { AssocMeal, CatalogItem, Order, OrderLine } from '../../../../../domain/types';
import { todayMix } from '../model/todayMix';

const TODAY = new Date(2026, 9, 7).getTime();
const item = (id: string, name: string, category = 'Entrées', special = false) => ({ id, name, category, special }) as CatalogItem;
const catalog = [
  item('a', 'Pot Roast', 'Entrées', true),
  item('b', 'Reuben'),
  item('c', 'Soup', 'Starters'),
  item('d', 'Pie', 'Desserts'),
  item('e', 'Cobb'),
  item('cof', 'Coffee', 'Drinks'),
  item('fr', 'Fries', 'Sides'),
  item('a2', 'Pot Roast', 'Entrées', true),
];
const line = (itemId: string, extra: Partial<OrderLine> = {}) => ({ id: itemId, itemId, sent: true, ...extra }) as OrderLine;
const check = (lines: OrderLine[], openedAt = TODAY + 3600_000) => ({ id: 'o', openedAt, diners: [{ items: lines }] }) as unknown as Order;
const opts = { todayStart: TODAY, todayIso: '2026-10-07', catalog };

describe('todayMix', () => {
  it('counts plates served today with their share, best seller first, one row per dish', () => {
    const m = todayMix([check([line('b'), line('a'), line('a2'), line('c')])], [], { ...opts, earlier: { a: 4 } });
    expect(m.tot).toBe(8);
    expect(m.top.map((r) => [r.name, r.n, r.pct, r.special])).toEqual([
      ['Pot Roast', 6, 75, true],
      ['Reuben', 1, 13, false],
      ['Soup', 1, 13, false],
    ]);
    expect(m.rest).toBeNull();
  });
  it('leaves out drinks, sides, unsent, cancelled lines and older checks', () => {
    const m = todayMix(
      [
        check([line('cof'), line('fr'), line('b', { sent: false }), line('b', { cancelled: true }), line('e', { autoSide: true })]),
        check([line('b')], TODAY - 3600_000),
      ],
      [],
      opts,
    );
    expect(m.tot).toBe(0);
    expect(m.top).toEqual([]);
  });
  it('adds associate meals for today by name', () => {
    const a = (item: string, date = '2026-10-07', status = 'Ready') => ({ item, date, status }) as AssocMeal;
    const m = todayMix([], [a('reuben'), a('Reuben', '2026-10-06'), a('Reuben', '2026-10-07', 'Cancelled'), a('Soup & Salad Combo')], opts);
    expect(m.top.map((r) => [r.name, r.n])).toEqual([
      ['Reuben', 1],
      ['Soup & Salad Combo', 1],
    ]);
  });
  it('rolls everything past the limit into one row, but never a single dish', () => {
    const lines = ['a', 'a', 'a', 'b', 'b', 'c', 'd', 'e'].map((x) => line(x));
    const m = todayMix([check(lines)], [], { ...opts, limit: 2 });
    expect(m.top.map((r) => r.id)).toEqual(['a', 'b']);
    expect(m.rest).toEqual({ n: 3, pct: 38, dishes: 3 });
    expect(todayMix([check(lines)], [], { ...opts, limit: 4 }).rest).toBeNull();
  });
});
