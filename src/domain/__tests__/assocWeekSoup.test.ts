import { describe, expect, it } from 'vitest';
import { soupOfTheDay, weekSpecialFor } from '../assocMeals/menu';

describe('associate special of the week', () => {
  const weekly = { '2026-10-05': 'r_pasta', '2026-10-12': 'r_tacos' };

  it('applies on every day of the week that starts on its Monday', () => {
    expect(weekSpecialFor('2026-10-05', weekly)).toBe('r_pasta');
    expect(weekSpecialFor('2026-10-07', weekly)).toBe('r_pasta');
    expect(weekSpecialFor('2026-10-11', weekly)).toBe('r_pasta'); // Sunday
    expect(weekSpecialFor('2026-10-12', weekly)).toBe('r_tacos');
  });

  it('is none for a week with no special, and for older settings without any', () => {
    expect(weekSpecialFor('2026-10-19', weekly)).toBeNull();
    expect(weekSpecialFor('2026-10-07', undefined)).toBeNull();
    expect(weekSpecialFor('2026-10-07', { '2026-10-05': null })).toBeNull();
  });
});

describe('soup of the day', () => {
  const subs: Record<string, string> = { s_tomato: 'Soup', s_chowder: 'Soup', a_wings: 'Appetizers', e_steak: 'Steak' };
  const subOf = (id: string) => subs[id];

  it("is the first soup among the cycle's starters for the meal", () => {
    const items = [
      { recipeId: 'e_steak', category: 'Entrees' },
      { recipeId: 'a_wings', category: 'Starters' },
      { recipeId: 's_tomato', category: 'Starters' },
      { recipeId: 's_chowder', category: 'Starters' },
    ];
    expect(soupOfTheDay(items, subOf)).toBe('s_tomato');
  });

  it('is none when the cycle has no soup that day', () => {
    expect(soupOfTheDay([{ recipeId: 'a_wings', category: 'Starters' }], subOf)).toBeNull();
    expect(soupOfTheDay([{ recipeId: 's_tomato', category: 'Entrees' }], subOf)).toBeNull();
    expect(soupOfTheDay([], subOf)).toBeNull();
  });
});
