import { describe, expect, it } from 'vitest';
import type { AssocMeal } from '../../../domain/types';
import { canChangeMeal, changeMeal, pickedMods, statusText } from '../myMeals';

const meal = (p: Partial<AssocMeal>): AssocMeal => ({
  id: 'x',
  date: '2026-10-07',
  meal: 'Lunch',
  window: '11:00 AM',
  associate: 'Jordan Reyes',
  item: 'Turkey Club',
  status: 'Planned',
  note: '',
  log: [],
  ...p,
});
const at = (h: number, m: number) => new Date(2026, 9, 7, h, m).getTime();

describe('my planned meals', () => {
  it('can be changed until ordering for the range closes', () => {
    const m = meal({});
    expect(canChangeMeal(m, 45, 20 * 60, at(10, 14))).toBe(true);
    expect(canChangeMeal(m, 45, 20 * 60, at(10, 15))).toBe(false);
    // NOC meals close the cutoff before the dinner line closes, not before the range.
    const noc = meal({ meal: 'NOC', window: '11:00 PM' });
    expect(canChangeMeal(noc, 45, 20 * 60, at(19, 14))).toBe(true);
    expect(canChangeMeal(noc, 45, 20 * 60, at(19, 15))).toBe(false);
  });

  it('swaps the choice in place and logs it', () => {
    const all = [meal({ id: 'a' }), meal({ id: 'b', item: 'Reuben Sandwich' })];
    const next = changeMeal(
      all,
      'a',
      { date: '2026-10-07', meal: 'Lunch', item: 'Cheeseburger Soup', recipeIds: ['s1'], window: '11:15 AM', mods: { Size: 'Bowl' }, note: 'Bowl' },
      'Jordan Reyes',
      5,
    );
    expect(next[0]).toMatchObject({ id: 'a', item: 'Cheeseburger Soup', window: '11:15 AM', mods: { Size: 'Bowl' }, note: 'Bowl', status: 'Planned' });
    expect(next[0].log).toEqual([{ by: 'Jordan Reyes', at: 5, text: 'Changed to Cheeseburger Soup in the Associate App' }]);
    expect(next[1]).toBe(all[1]);
  });

  it('starts the plan screen with the saved choices', () => {
    expect(pickedMods(meal({ mods: { Side: 'Chips', Extra: ['a'] } }))).toEqual({ Side: 'Chips' });
    expect(pickedMods(undefined)).toEqual({});
  });

  it('words a status without dashes', () => {
    expect(statusText('Cancelled — shift removed')).toBe('Cancelled: shift removed');
    expect(statusText('Picked up')).toBe('Picked up');
  });
});
