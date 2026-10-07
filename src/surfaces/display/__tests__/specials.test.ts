import { describe, expect, it } from 'vitest';
import { catalog } from '../../../data';
import { mealAt, parseMeal } from '../../../domain/pickupService/meals';
import { displaySlides, nextPreview, slideLabel } from '../specials';

const idOf = (name: string, meal: string) => catalog.find((i) => i.name === name && i.meal === meal)!.id;

describe('specials display', () => {
  it('shows the special entrées, then the soup, then the dessert special', () => {
    const slides = displaySlides('Dinner', () => false);
    expect(slides.map((s) => [s.kind, s.name])).toEqual([
      ['entree', 'Peach Glazed Chicken Breast'],
      ['entree', 'Cheese Stuffed Shells with Marinara'],
      ['soup', 'Cheeseburger Soup'],
      ['dessert', 'Pineapple Trifle'],
    ]);
    expect(slides[0].sides).toEqual(['Mashed Potatoes', 'Garlic Green Beans']);
    expect(slideLabel(slides[0], 'Dinner', 2)).toBe("Tonight's Specials");
    expect(slideLabel(slides[2], 'Dinner', 2)).toBe("Tonight's Soup");
    expect(slideLabel(slides[3], 'Lunch', 1)).toBe("Today's Dessert Special");
  });

  it('never shows something the kitchen has 86’d', () => {
    const out = new Set([idOf('Peach Glazed Chicken Breast', 'Dinner'), idOf('Cheeseburger Soup', 'Dinner')]);
    expect(displaySlides('Dinner', (id) => out.has(id)).map((s) => s.name)).toEqual(['Cheese Stuffed Shells with Marinara', 'Pineapple Trifle']);
  });

  it('holds the lunch cereal bar off the screen', () => {
    expect(displaySlides('Lunch', () => false).some((s) => s.name === 'Cereal Bar')).toBe(false);
  });

  it('follows the clock and lets staff step through the meals', () => {
    expect(mealAt(new Date(2026, 9, 7, 10, 29).getTime())).toBe('Breakfast');
    expect(mealAt(new Date(2026, 9, 7, 14, 59).getTime())).toBe('Lunch');
    expect(mealAt(new Date(2026, 9, 7, 17, 45).getTime())).toBe('Dinner');
    expect(parseMeal('lunch')).toBe('Lunch');
    expect(parseMeal('brunch')).toBeNull();
    expect([nextPreview(null), nextPreview('Breakfast'), nextPreview('Dinner')]).toEqual(['Breakfast', 'Lunch', null]);
  });
});
