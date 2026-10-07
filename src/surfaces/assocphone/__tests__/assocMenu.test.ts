import { afterEach, describe, expect, it } from 'vitest';
import { itemsLeft, missingChoice, modsText } from '../../../domain/assocMeals/menu';
import { isoDate } from '../../../domain/pickup';
import type { AssocMeal } from '../../../domain/types';
import { assocMenuFor, daySpecial, setDaySpecial, setDaySpecialCap, setStandingRecipe, standingItems } from '../../../store/assocMenu';
import { cycleEntrees } from '../../../store/production';
import { serviceConfig } from '../../../store/serviceConfig';

const today = isoDate(0);
const order = (p: Partial<AssocMeal>): AssocMeal => ({ id: Math.random().toString(36), date: today, meal: 'Dinner', window: '5:00 PM', associate: 'A', item: '', status: 'Planned', note: '', log: [], ...p });

afterEach(() => serviceConfig.reset());

describe('associate menu', () => {
  it("offers the cycle's first entrée special for each meal period, then the four standing choices", () => {
    const lunch = assocMenuFor(today, 'Lunch', today)!;
    const dinner = assocMenuFor(today, 'Dinner', today)!;
    expect(lunch[0]).toMatchObject({ special: true, name: cycleEntrees('sequoia', today, 'Lunch')[0].name, cap: 12 });
    expect(dinner[0]).toMatchObject({ special: true, name: cycleEntrees('sequoia', today, 'Dinner')[0].name });
    expect(lunch[0].name).not.toBe(dinner[0].name);
    expect(lunch.slice(1).map((x) => x.name)).toEqual(['Southwest Summer Salad', 'Turkey Club', 'Cheeseburger Soup', 'Soup & Salad Combo']);
  });

  it('gives overnight meals the dinner special, sharing its daily limit', () => {
    const noc = assocMenuFor(today, 'NOC', today)!;
    const dinner = assocMenuFor(today, 'Dinner', today)!;
    expect(noc[0].name).toBe(dinner[0].name);
    const special = dinner[0];
    const taken = [order({ meal: 'Dinner', item: special.name }), order({ meal: 'NOC', window: '11:00 PM', item: special.name }), order({ meal: 'Lunch', item: special.name })];
    expect(itemsLeft(taken, today, special)).toBe(10);
  });

  it("lets the chef pick the day's other special, turn it off, and set the limit", () => {
    const options = daySpecial(today, 'Dinner').options;
    expect(options.length).toBeGreaterThan(1);
    setDaySpecial(today, 'Dinner', options[1].recipeId);
    setDaySpecialCap(today, 'Dinner', 5);
    expect(assocMenuFor(today, 'Dinner', today)![0]).toMatchObject({ name: options[1].name, cap: 5 });
    setDaySpecial(today, 'Dinner', null);
    expect(assocMenuFor(today, 'Dinner', today)!.some((x) => x.special)).toBe(false);
    setDaySpecial(today, 'Dinner', undefined);
    expect(assocMenuFor(today, 'Dinner', today)![0].name).toBe(options[0].name);
  });

  it('makes each standing choice from a recipe the chef can swap', () => {
    const [salad, , soup, combo] = standingItems();
    expect(salad).toMatchObject({ recipeIds: ['l_swsalad'], allergens: ['Milk'] });
    expect(combo).toMatchObject({ name: 'Soup & Salad Combo', recipeIds: ['l_cbsoup', 'l_sidesalad'] });
    expect(combo.sub).toContain('cheeseburger soup');
    expect(soup.sub).toContain('Soup of the week');
    setStandingRecipe('am_soup', 'vf_blackbeansoup');
    const after = standingItems();
    expect(after[2].name).toBe('Black Bean Soup');
    expect(after[3].recipeIds).toEqual(['vf_blackbeansoup', 'l_sidesalad']);
  });

  it('asks for every choice in order', () => {
    const salad = standingItems()[0];
    expect(missingChoice(salad, {})?.group).toBe('Dressing');
    expect(missingChoice(salad, { Dressing: 'Ranch' })?.group).toBe('Protein');
    expect(modsText(salad, { Protein: 'No protein', Dressing: 'Ranch' })).toBe('Ranch, No protein');
  });

  it('closes days that cannot be planned', () => {
    expect(assocMenuFor(isoDate(-1), 'Lunch', today)).toBeNull();
    expect(assocMenuFor(isoDate(-1), 'Lunch', today, undefined, true)).not.toBeNull();
  });
});
