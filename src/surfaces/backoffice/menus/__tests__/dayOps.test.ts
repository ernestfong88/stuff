import { describe, expect, it } from 'vitest';
import type { GridEntry, SideOverrides } from '../../../../store/menuEdits';
import { copyDay, copyDaySides, dayCount, swapDays, swapDaySides } from '../model/dayOps';

const e = (id: string, day: number, meal: GridEntry['meal'], cat: GridEntry['cat'], extra: Partial<GridEntry> = {}): GridEntry => ({
  id,
  menuId: 'm1',
  recipeId: 'r-' + id,
  day,
  meal,
  cat,
  sort: Number(id.replace(/\D/g, '')) || 1,
  ...extra,
});

const grid: GridEntry[] = [
  e('a1', 1, 'Lunch', 'Entrees'),
  e('a2', 1, 'Lunch', 'Sides', { with: 'a1' }),
  e('a3', 1, 'Dinner', 'Desserts'),
  e('b1', 2, 'Lunch', 'Entrees'),
  e('b2', 2, 'Dinner', 'Entrees'),
  e('z1', 0, 'Lunch', 'Entrees'),
  e('o1', 1, 'Lunch', 'Entrees', { menuId: 'm2' }),
  e('o2', 2, 'Lunch', 'Entrees', { menuId: 'm2' }),
];

const counter = () => {
  let n = 0;
  return () => `new${++n}`;
};

describe('copy a day', () => {
  it('replaces every meal on the target day with fresh copies, sides tied to the copied entrée', () => {
    const out = copyDay(grid, 'm1', 1, 2, { mode: 'replace', newId: counter() });
    const day2 = out.filter((g) => g.menuId === 'm1' && g.day === 2);
    expect(day2.map((g) => g.recipeId)).toEqual(['r-a1', 'r-a2', 'r-a3']);
    expect(day2.map((g) => g.id)).toEqual(['new1', 'new2', 'new3']);
    expect(day2.find((g) => g.recipeId === 'r-a2')?.with).toBe('new1');
    // The source day, Any Day and other menus are untouched.
    expect(out.filter((g) => g.day === 1 && g.menuId === 'm1')).toEqual(grid.filter((g) => g.day === 1 && g.menuId === 'm1'));
    expect(out.filter((g) => g.day === 0 || g.menuId === 'm2')).toEqual(grid.filter((g) => g.day === 0 || g.menuId === 'm2'));
    expect(Math.min(...day2.map((g) => g.sort))).toBeGreaterThan(Math.max(...grid.map((g) => g.sort)));
  });

  it('copies one meal and leaves the other meals of the target day alone', () => {
    const out = copyDay(grid, 'm1', 1, 2, { meal: 'Lunch', mode: 'replace', newId: counter() });
    const day2 = out.filter((g) => g.menuId === 'm1' && g.day === 2);
    expect(day2.map((g) => g.recipeId).sort()).toEqual(['r-a1', 'r-a2', 'r-b2']);
    expect(dayCount(out, 'm1', 2, 'Dinner')).toBe(1);
  });

  it('adds to what is there, and to several days at once with their own ids', () => {
    const out = copyDay(grid, 'm1', 1, [2, 3], { mode: 'add', newId: counter() });
    expect(dayCount(out, 'm1', 2)).toBe(5);
    expect(dayCount(out, 'm1', 3)).toBe(3);
    const side3 = out.find((g) => g.day === 3 && g.recipeId === 'r-a2')!;
    expect(out.find((g) => g.id === side3.with)?.day).toBe(3);
  });

  it('drops a link to an entrée that was not copied', () => {
    const g2 = [e('x1', 1, 'Lunch', 'Entrees'), e('x2', 1, 'Dinner', 'Sides', { with: 'x1' })];
    const out = copyDay(g2, 'm1', 1, 2, { meal: 'Dinner', mode: 'replace', newId: counter() });
    expect(out.find((g) => g.day === 2)?.with).toBeUndefined();
  });

  it('never writes to Any Day or onto the day itself', () => {
    expect(copyDay(grid, 'm1', 1, 0, { mode: 'replace', newId: counter() })).toBe(grid);
    expect(copyDay(grid, 'm1', 1, 1, { mode: 'replace', newId: counter() })).toBe(grid);
    expect(copyDay(grid, 'm1', 0, 2, { mode: 'replace', newId: counter() })).toBe(grid);
  });
});

describe('swap days', () => {
  it('trades every meal between two days on one menu only', () => {
    const out = swapDays(grid, 'm1', 1, 2);
    expect(out.filter((g) => g.menuId === 'm1' && g.day === 2).map((g) => g.id)).toEqual(['a1', 'a2', 'a3']);
    expect(out.filter((g) => g.menuId === 'm1' && g.day === 1).map((g) => g.id)).toEqual(['b1', 'b2']);
    expect(out.find((g) => g.id === 'a2')?.with).toBe('a1');
    expect(out.filter((g) => g.day === 0 || g.menuId === 'm2')).toEqual(grid.filter((g) => g.day === 0 || g.menuId === 'm2'));
    expect(swapDays(out, 'm1', 1, 2)).toEqual(grid);
  });

  it('refuses Any Day and the same day', () => {
    expect(swapDays(grid, 'm1', 0, 2)).toBe(grid);
    expect(swapDays(grid, 'm1', 2, 2)).toBe(grid);
  });
});

describe('side choices follow the day', () => {
  const seed: SideOverrides = { m1: { 1: { 'r-a1': ['s-seed'] }, 2: { 'r-b1': ['s-b'] } } };

  it('copies the source day sides for the copied entrées', () => {
    const own: SideOverrides = { m1: { 1: { 'r-a1': ['s-own'] } }, m2: { 1: { x: ['y'] } } };
    const out = copyDaySides(own, seed, 'm1', 1, [2, 3], ['r-a1']);
    expect(out.m1[2]['r-a1']).toEqual(['s-own']);
    expect(out.m1[3]['r-a1']).toEqual(['s-own']);
    expect(out.m1[1]).toEqual(own.m1[1]);
    expect(out.m2).toBe(own.m2);
    expect(copyDaySides({}, seed, 'm1', 1, 2, ['r-a1']).m1[2]['r-a1']).toEqual(['s-seed']);
  });

  it('swaps side choices, writing them out so the seed does not show through', () => {
    const out = swapDaySides({}, seed, 'm1', 1, 2);
    expect(out.m1[2]).toEqual({ 'r-a1': ['s-seed'], 'r-b1': [] });
    expect(out.m1[1]).toEqual({ 'r-b1': ['s-b'], 'r-a1': [] });
    expect(swapDaySides({}, {}, 'm1', 1, 2)).toEqual({});
  });
});
