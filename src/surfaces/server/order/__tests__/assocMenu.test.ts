import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../../../domain/types';
import { assocMealOf, assocSections, tabletItemFor } from '../menu/assocMenu';

const item = (id: string, name: string, meal: CatalogItem['meal']) =>
  ({ id, name, meal, category: 'Entrées', desc: '', residentPrice: 0, guestPrice: 0, alaPrice: 0, day: 0, avail: null, mods: [], allergens: [] }) as CatalogItem;
const items = [item('l_club', 'Turkey Club', 'Lunch'), item('d_club', 'Turkey Club', 'Dinner'), item('l_soup', 'Cheeseburger Soup', 'Lunch')];

describe('the associate menu on the tablet', () => {
  it('uses the same dish on this meal when the tablet has it, else the recipe’s own item', () => {
    expect(tabletItemFor('l_club', 'Dinner', items)?.id).toBe('d_club');
    expect(tabletItemFor('l_club', 'Lunch', items)?.id).toBe('l_club');
    expect(tabletItemFor('l_soup', 'Dinner', items)?.id).toBe('l_soup');
    expect(tabletItemFor('nope', 'Dinner', items)).toBeUndefined();
  });

  it('makes one section per choice, a combo holding both its dishes', () => {
    const secs = assocSections(
      [
        { id: 'am_special', name: 'Turkey Club', sub: '', recipeIds: ['l_club'], allergens: [], mods: [], special: true },
        { id: 'am_combo', name: 'Soup & Salad Combo', sub: '', recipeIds: ['l_soup', 'l_club'], allergens: [], mods: [] },
      ],
      'Dinner',
      items,
    );
    expect(secs.map((x) => [x.label, x.items.map((i) => i.id)])).toEqual([
      ["Chef's special · Turkey Club", ['d_club']],
      ['Soup & Salad Combo', ['l_soup', 'd_club']],
    ]);
    expect(assocMealOf('Breakfast')).toBe('Lunch');
  });
});
