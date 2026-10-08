import { describe, expect, it } from 'vitest';
import { CATEGORY_GREY, CATEGORY_HUES, categoryHue, courseOf } from '../charts/palette';

describe('categoryHue', () => {
  it('maps menu and recipe category names onto the three courses', () => {
    expect(courseOf('Starters')).toBe('Starters');
    expect(courseOf('Soups and starters')).toBe('Starters');
    expect(courseOf('Entrées')).toBe('Entrées');
    expect(courseOf('Entrees')).toBe('Entrées');
    expect(courseOf('Sandwiches')).toBe('Entrées');
    expect(courseOf('Desserts')).toBe('Desserts');
    expect(courseOf('Drinks')).toBeNull();
  });
  it('gives the dashboard wheel hues, grey for anything else', () => {
    expect(categoryHue('Entrees')).toBe(CATEGORY_HUES['Entrées']);
    expect(categoryHue('Starters').base).toBe('#eb6834');
    expect(categoryHue('Sides')).toBe(CATEGORY_GREY);
  });
});
