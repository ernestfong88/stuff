import { describe, expect, it } from 'vitest';
import { mealAt, mealAtHour, mealAtMinute, MEALS } from '../mealPeriods';
import { mealAt as pickupMealAt } from '../pickupService/meals';
import { MEAL_WINDOWS, WINDOW_DAY } from '../pickupService/windows';
import { currentMeal } from '../../surfaces/server/shared/meal';
import { mealAt as menuMealAt } from '../../surfaces/server/features/menu/menuSections';

const at = (h: number, m: number) => new Date(2026, 9, 7, h, m).getTime();

describe('meal periods', () => {
  it('serves breakfast until 10:30, lunch until 3, then dinner', () => {
    expect([mealAtMinute(629), mealAtMinute(630), mealAtMinute(899), mealAtMinute(900)]).toEqual(['Breakfast', 'Lunch', 'Lunch', 'Dinner']);
    expect(mealAt(at(10, 29))).toBe('Breakfast');
    expect(mealAtHour(10.5)).toBe('Lunch');
  });

  it('is the one answer for the opening meal, the menu reference and the pick up ranges', () => {
    for (let m = WINDOW_DAY[0]; m < WINDOW_DAY[1]; m += 15) {
      const ts = at(Math.floor(m / 60), m % 60);
      const meal = mealAtMinute(m);
      expect(currentMeal(ts)).toBe(meal);
      expect(pickupMealAt(ts)).toBe(meal);
      expect(menuMealAt(m / 60)).toBe(meal);
      const span = MEAL_WINDOWS[meal];
      expect(m >= span[0] && m < span[1]).toBe(true);
    }
    expect(MEALS.map((x) => MEAL_WINDOWS[x])).toEqual([
      [WINDOW_DAY[0], 630],
      [630, 900],
      [900, WINDOW_DAY[1]],
    ]);
  });
});
