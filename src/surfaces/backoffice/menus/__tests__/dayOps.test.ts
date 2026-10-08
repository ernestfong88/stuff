import { describe, expect, it } from 'vitest';
import type { GridEntry, SideOverrides } from '../../../../store/menuEdits';
import { copyDaySides, copyMeal, mealCount, swapMeals } from '../model/dayOps';

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

const L1 = { day: 1, meal: 'Lunch' };

describe('copy a meal', () => {
  it('copies Monday lunch onto Tuesday dinner, replacing it, sides tied to the copied entrée', () => {
    const out = copyMeal(grid, 'm1', L1, [{ day: 2, meal: 'Dinner' }], { mode: 'replace', newId: counter() });
    const din2 = out.filter((g) => g.menuId === 'm1' && g.day === 2 && g.meal === 'Dinner');
    expect(din2.map((g) => [g.id, g.recipeId])).toEqual([
      ['new1', 'r-a1'],
      ['new2', 'r-a2'],
    ]);
    expect(din2[1].with).toBe('new1');
    // Tuesday lunch, the source, Any Day and other menus are untouched.
    expect(mealCount(out, 'm1', { day: 2, meal: 'Lunch' })).toBe(1);
    expect(out.filter((g) => g.day === 1 && g.menuId === 'm1')).toEqual(grid.filter((g) => g.day === 1 && g.menuId === 'm1'));
    expect(out.filter((g) => g.day === 0 || g.menuId === 'm2')).toEqual(grid.filter((g) => g.day === 0 || g.menuId === 'm2'));
  });

  it('copies to another meal on the same day', () => {
    const out = copyMeal(grid, 'm1', L1, [{ day: 1, meal: 'Dinner' }], { mode: 'add', newId: counter() });
    expect(mealCount(out, 'm1', { day: 1, meal: 'Dinner' })).toBe(3);
  });

  it('adds to several days at once, each with its own ids', () => {
    const out = copyMeal(
      grid,
      'm1',
      L1,
      [
        { day: 2, meal: 'Lunch' },
        { day: 3, meal: 'Lunch' },
      ],
      { mode: 'add', newId: counter() },
    );
    expect(mealCount(out, 'm1', { day: 2, meal: 'Lunch' })).toBe(3);
    const side3 = out.find((g) => g.day === 3 && g.recipeId === 'r-a2')!;
    expect(out.find((g) => g.id === side3.with)?.day).toBe(3);
  });

  it('never writes to Any Day or onto the meal itself', () => {
    expect(copyMeal(grid, 'm1', L1, [{ day: 0, meal: 'Lunch' }], { mode: 'replace', newId: counter() })).toBe(grid);
    expect(copyMeal(grid, 'm1', L1, [L1], { mode: 'replace', newId: counter() })).toBe(grid);
  });
});

describe('swap meals', () => {
  it('trades Monday lunch and Tuesday dinner on one menu only', () => {
    const out = swapMeals(grid, 'm1', L1, { day: 2, meal: 'Dinner' });
    expect(out.filter((g) => g.menuId === 'm1' && g.day === 2 && g.meal === 'Dinner').map((g) => g.id)).toEqual(['a1', 'a2']);
    expect(out.filter((g) => g.menuId === 'm1' && g.day === 1 && g.meal === 'Lunch').map((g) => g.id)).toEqual(['b2']);
    expect(out.find((g) => g.id === 'a2')?.with).toBe('a1');
    expect(out.filter((g) => g.menuId === 'm2')).toEqual(grid.filter((g) => g.menuId === 'm2'));
    expect(swapMeals(out, 'm1', L1, { day: 2, meal: 'Dinner' })).toEqual(grid);
  });

  it('swaps two meals on the same day', () => {
    const out = swapMeals(grid, 'm1', L1, { day: 1, meal: 'Dinner' });
    expect(out.find((g) => g.id === 'a3')?.meal).toBe('Lunch');
    expect(out.find((g) => g.id === 'a1')?.meal).toBe('Dinner');
  });

  it('refuses Any Day and the same meal', () => {
    expect(swapMeals(grid, 'm1', { day: 0, meal: 'Lunch' }, L1)).toBe(grid);
    expect(swapMeals(grid, 'm1', L1, L1)).toBe(grid);
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
});
