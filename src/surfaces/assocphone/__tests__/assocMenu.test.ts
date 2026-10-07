import { afterEach, describe, expect, it } from 'vitest';
import { addDays, itemsLeft, missingChoice, modsText, mondayOf } from '../../../domain/assocMeals/menu';
import { isoDate } from '../../../domain/pickup';
import type { AssocMeal } from '../../../domain/types';
import { recipeInfo } from '../../../store/recipes';
import {
  assocMenuFor,
  assocMenuForDay,
  daySoup,
  daySpecial,
  setDaySpecial,
  setDaySpecialCap,
  setStandingRecipe,
  setWeekSpecial,
  standingItems,
} from '../../../store/assocMenu';
import { cycleEntrees, cycleItems } from '../../../store/production';
import { serviceConfig } from '../../../store/serviceConfig';

const today = isoDate(0);
const order = (p: Partial<AssocMeal>): AssocMeal => ({
  id: Math.random().toString(36),
  date: today,
  meal: 'Dinner',
  window: '5:00 PM',
  associate: 'A',
  item: '',
  status: 'Planned',
  note: '',
  log: [],
  ...p,
});

afterEach(() => serviceConfig.reset());

describe('associate menu', () => {
  it("offers the cycle's first entrée special for each meal period, then the standing choices with the soup of the day", () => {
    const lunch = assocMenuFor(today, 'Lunch', today)!;
    const dinner = assocMenuFor(today, 'Dinner', today)!;
    expect(lunch[0]).toMatchObject({ special: true, name: cycleEntrees('sequoia', today, 'Lunch')[0].name, cap: 12 });
    expect(dinner[0]).toMatchObject({ special: true, name: cycleEntrees('sequoia', today, 'Dinner')[0].name });
    expect(lunch[0].name).not.toBe(dinner[0].name);
    const soup = daySoup(today, 'Lunch')!;
    expect(soup).toBeDefined();
    expect(lunch.slice(1).map((x) => x.name)).toEqual(['Southwest Summer Salad', 'Turkey Club', soup.name, 'Soup & Salad Combo']);
  });

  it('gives overnight meals the dinner special, sharing its daily limit', () => {
    const noc = assocMenuFor(today, 'NOC', today)!;
    const dinner = assocMenuFor(today, 'Dinner', today)!;
    expect(noc[0].name).toBe(dinner[0].name);
    const special = dinner[0];
    const taken = [
      order({ meal: 'Dinner', item: special.name }),
      order({ meal: 'NOC', window: '11:00 PM', item: special.name }),
      order({ meal: 'Lunch', item: special.name }),
    ];
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

  it('makes each standing choice from a recipe the chef can swap; the soup is the soup of the day', () => {
    const daySoupRecipe = recipeInfo('l_cbsoup');
    const [salad, , soup, combo] = standingItems(daySoupRecipe);
    expect(salad).toMatchObject({ recipeIds: ['l_swsalad'], allergens: ['Milk'] });
    expect(combo).toMatchObject({ name: 'Soup & Salad Combo', recipeIds: ['l_cbsoup', 'l_sidesalad'] });
    expect(combo.sub).toContain('cheeseburger soup');
    expect(soup).toMatchObject({ name: 'Cheeseburger Soup', soupOfDay: true });
    // A soup picked by hand (older settings) no longer changes it.
    setStandingRecipe('am_soup', 'vf_blackbeansoup');
    expect(standingItems(daySoupRecipe)[2].name).toBe('Cheeseburger Soup');
    // No soup that day: neither the soup nor the combo.
    expect(standingItems(undefined).map((x) => x.id)).toEqual(['am_salad', 'am_sandwich']);
  });

  it("puts today's soup of the day from the menu cycle on the associate menu", () => {
    const starters = cycleItems('sequoia', today, 'Dinner').filter((x) => x.category === 'Starters');
    const soup = daySoup(today, 'Dinner')!;
    expect(starters.map((x) => x.recipeId)).toContain(soup.id);
    expect(soup.sub).toBe('Soup');
    const dinner = assocMenuFor(today, 'Dinner', today)!;
    expect(dinner.find((x) => x.soupOfDay)?.name).toBe(soup.name);
    expect(dinner.find((x) => x.id === 'am_combo')?.recipeIds[0]).toBe(soup.id);
  });

  it('offers the special of the week every day of its week, after the chef special', () => {
    const monday = mondayOf(today);
    setWeekSpecial(monday, 'vf_turkeyclub');
    for (const date of [today, addDays(monday, 6)]) {
      const menu = assocMenuFor(date, 'Lunch', today, undefined, true)!;
      expect(menu[1]).toMatchObject({ id: 'am_week', name: 'Turkey Club', weekly: true, recipeIds: ['vf_turkeyclub'] });
      expect(menu[0].special).toBe(true);
    }
    expect(assocMenuForDay(today).some((x) => x.weekly)).toBe(true);
    expect(assocMenuFor(addDays(monday, 7), 'Lunch', today, undefined, true)!.some((x) => x.weekly)).toBe(false);
    setWeekSpecial(monday, undefined);
    expect(assocMenuFor(today, 'Lunch', today)!.some((x) => x.weekly)).toBe(false);
  });

  it('asks for every choice in order', () => {
    const salad = standingItems(undefined)[0];
    expect(missingChoice(salad, {})?.group).toBe('Dressing');
    expect(missingChoice(salad, { Dressing: 'Ranch' })?.group).toBe('Protein');
    expect(modsText(salad, { Protein: 'No protein', Dressing: 'Ranch' })).toBe('Ranch, No protein');
  });

  it('closes days that cannot be planned', () => {
    expect(assocMenuFor(isoDate(-1), 'Lunch', today)).toBeNull();
    expect(assocMenuFor(isoDate(-1), 'Lunch', today, undefined, true)).not.toBeNull();
  });
});
