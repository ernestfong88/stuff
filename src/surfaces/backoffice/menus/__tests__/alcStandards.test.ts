import { describe, expect, it } from 'vitest';
import type { GridEntry, Recipe } from '../../../../store/menuEdits';
import { countAlc, MENU_STANDARDS, standardLevel } from '../model/alcStandards';
import { isUpchargeRecipe } from '../model/tablet';

const recipes: Record<string, Pick<Recipe, 'cat' | 'placeholder'>> = {
  burger: { cat: 'Entrees' },
  soup: { cat: 'Starters' },
  fries: { cat: 'Sides' },
  slaw: { cat: 'Sides' },
  pie: { cat: 'Desserts' },
  tea: { cat: 'Drinks' },
  addChicken: { cat: 'Sides' },
  fee: { cat: 'Snacks', placeholder: true },
  cookie: { cat: 'Snacks' },
};
let n = 0;
const g = (recipeId: string, meal: GridEntry['meal'] = 'Lunch', cat?: GridEntry['cat']): GridEntry => ({
  id: 'g' + ++n,
  menuId: 'alc',
  recipeId,
  day: 0,
  meal,
  cat: cat ?? recipes[recipeId]?.cat ?? 'Entrees',
  sort: n,
});
const lookup = (id: string) => recipes[id];
const upcharge = (id: string) => id === 'addChicken';

describe('à la carte menu standard', () => {
  it('counts dishes and sides, leaving out beverages, upcharges and fee lines', () => {
    const list = ['burger', 'soup', 'fries', 'slaw', 'pie', 'tea', 'addChicken', 'fee', 'cookie'].map((id) => g(id));
    expect(countAlc(list, lookup, upcharge)).toEqual({ items: 6, sides: 2, limitItems: 20, limitSides: 8 });
  });

  it('counts a dish once however many meals carry it', () => {
    const list = [g('burger', 'Lunch'), g('burger', 'Dinner'), g('fries', 'Lunch'), g('fries', 'Dinner')];
    expect(countAlc(list, lookup)).toMatchObject({ items: 2, sides: 1 });
  });

  it('treats anything placed in a drinks row as a beverage', () => {
    expect(countAlc([g('cookie', 'Lunch', 'Drinks')], lookup).items).toBe(0);
  });

  it('falls back to the placement category for an unknown recipe', () => {
    expect(countAlc([g('mystery', 'Lunch', 'Sides')], lookup)).toMatchObject({ items: 1, sides: 1 });
  });

  it('keeps the limits in one place and grades a count against them', () => {
    expect(MENU_STANDARDS).toEqual({ alcItems: 20, alcSides: 8 });
    expect(standardLevel(17, 20)).toBe('under');
    expect(standardLevel(20, 20)).toBe('at');
    expect(standardLevel(23, 20)).toBe('over');
  });

  it('knows the tablet add-ons are upcharges', () => {
    expect(isUpchargeRecipe('cv_ao_chicken')).toBe(true);
  });
});
