import { describe, expect, it } from 'vitest';
import type { AssocMeal, CatalogItem, Order, OrderLine } from '../../../../../domain/types';
import { categoryDishes, categoryTotals, todayMix, type MixDish } from '../model/todayMix';

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
    expect(m.dishes.map((r) => [r.name, r.category, r.n, r.special])).toEqual([
      ['Pot Roast', 'Entrées', 6, true],
      ['Reuben', 'Entrées', 1, false],
      ['Soup', 'Starters', 1, false],
    ]);
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
    expect(m.dishes).toEqual([]);
  });
  it('adds associate meals for today by name, as entrées when they are not on the menu', () => {
    const a = (item: string, date = '2026-10-07', status = 'Ready') => ({ item, date, status }) as AssocMeal;
    const m = todayMix([], [a('soup'), a('Reuben', '2026-10-06'), a('Reuben', '2026-10-07', 'Cancelled'), a('Soup & Salad Combo')], opts);
    expect(m.dishes.map((r) => [r.name, r.category, r.n])).toEqual([
      ['Soup', 'Starters', 1],
      ['Soup & Salad Combo', 'Entrées', 1],
    ]);
  });
  it('filters to one meal and counts plates per meal from every source', () => {
    const cat = [
      ...catalog,
      { ...item('bp', 'Pancakes', 'Entrées', true), meal: 'Breakfast' } as CatalogItem,
      { ...item('dp', 'Peach Chicken', 'Entrées', true), meal: 'Dinner' } as CatalogItem,
    ];
    const meal = (m: Order['meal'], lines: OrderLine[]) => ({ ...check(lines), meal: m }) as Order;
    const a = (item: string, m: string, readyAt?: number) => ({ item, date: '2026-10-07', status: 'Ready', meal: m, readyAt }) as AssocMeal;
    const checks = [
      meal('Breakfast', [line('b'), line('c')]),
      meal('Lunch', [line('b'), line('b'), line('e')]),
      check([line('d')], TODAY + 19 * 3600_000),
    ];
    const assoc = [a('Reuben', 'Lunch'), a('Cobb', 'NOC'), a('Soup', '', TODAY + 12 * 3600_000)];
    const o = { ...opts, catalog: cat, earlier: { bp: 5, dp: 2 } };
    const all = todayMix(checks, assoc, o);
    expect(all.tot).toBe(16);
    expect(all.byMeal).toEqual({ Breakfast: 7, Lunch: 5, Dinner: 4 });
    const lunch = todayMix(checks, assoc, { ...o, meal: 'Lunch' });
    expect(lunch.tot).toBe(5);
    expect(lunch.dishes.map((r) => [r.name, r.n])).toEqual([
      ['Reuben', 3],
      ['Cobb', 1],
      ['Soup', 1],
    ]);
    expect(lunch.byMeal).toEqual(all.byMeal);
    // Untagged checks go by when they were opened; NOC associate meals count with dinner.
    expect(todayMix(checks, assoc, { ...o, meal: 'Dinner' }).dishes.map((r) => [r.name, r.n])).toEqual([
      ['Peach Chicken', 2],
      ['Cobb', 1],
      ['Pie', 1],
    ]);
  });
  it('is empty for a meal with nothing served yet', () => {
    const m = todayMix([check([line('b')])], [], { ...opts, meal: 'Dinner' });
    expect(m).toEqual({ tot: 0, dishes: [], byMeal: { Breakfast: 1, Lunch: 0, Dinner: 0 } });
  });
});

const dish = (name: string, category: string, n: number, special = false): MixDish => ({ id: name, name, category, n, special });

describe('categoryTotals', () => {
  it('sums plates per category in course order with their share, empty ones left out', () => {
    const t = categoryTotals([
      dish('Cobb', 'Entrées', 5),
      dish('Pie', 'Desserts', 2),
      dish('Reuben', 'Entrées', 3),
      dish('Mystery', 'Specials Board', 1),
      dish('Soup', 'Starters', 1),
      dish('Tart', 'Desserts', 0),
    ]);
    expect(t).toEqual([
      { category: 'Starters', n: 1, pct: 8, dishes: 1 },
      { category: 'Entrées', n: 8, pct: 67, dishes: 2 },
      { category: 'Desserts', n: 2, pct: 17, dishes: 2 },
      { category: 'Specials Board', n: 1, pct: 8, dishes: 1 },
    ]);
  });
  it('is empty when nothing was served', () => {
    expect(categoryTotals([])).toEqual([]);
  });
});

describe('categoryDishes', () => {
  const dishes = [
    dish('Pot Roast', 'Entrées', 6, true),
    dish('Reuben', 'Entrées', 4),
    dish('Soup', 'Starters', 3),
    dish('Cobb', 'Entrées', 2),
    dish('Club', 'Entrées', 1),
    dish('Melt', 'Entrées', 1),
    dish('Wrap', 'Entrées', 1),
  ];
  it("keeps one category's best sellers with their share of it and rolls up the rest", () => {
    const m = categoryDishes(dishes, 'Entrées', 2);
    expect(m.tot).toBe(15);
    expect(m.top.map((r) => [r.name, r.n, r.pct, r.special])).toEqual([
      ['Pot Roast', 6, 40, true],
      ['Reuben', 4, 27, false],
    ]);
    expect(m.rest).toEqual({ n: 5, pct: 33, dishes: 4 });
  });
  it('never rolls a single dish into the rest', () => {
    const m = categoryDishes(dishes, 'Entrées', 5);
    expect(m.top.map((r) => r.name)).toEqual(['Pot Roast', 'Reuben', 'Cobb', 'Club', 'Melt', 'Wrap']);
    expect(m.rest).toBeNull();
  });
  it('covers every category when none is named, and is empty for one with nothing served', () => {
    expect(categoryDishes(dishes, undefined, 1).top.map((r) => [r.name, r.pct])).toEqual([['Pot Roast', 33]]);
    expect(categoryDishes(dishes, 'Desserts')).toEqual({ tot: 0, top: [], rest: null });
  });
});
