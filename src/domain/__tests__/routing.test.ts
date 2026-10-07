import { describe, expect, it } from 'vitest';
import { catalog, residents } from '../../data';
import { DEFAULT_CONFIG } from '../config';
import { isAlcohol, isSide, itemCourse, modNames, modsText, shortName, chosenMods } from '../menu';
import { residentPills, dinerPills } from '../residents';
import {
  defaultFoodRoute,
  drinkRoute,
  firedState,
  foodRoute,
  isDrinkLine,
  queueFiredState,
} from '../routing';
import { line, prototype } from './helpers';

describe('routing', () => {
  it('matches the prototype for every menu item (sequoia / bistro / bistro drink route)', () => {
    const got = Object.fromEntries(
      catalog.map((i) => [i.id, `${foodRoute(i.id, 'sequoia')}/${foodRoute(i.id, 'bistro')}/${drinkRoute(i.id, 'bistro')}`]),
    );
    expect(got).toEqual(prototype.routes);
  });

  it('routes by name: sandwiches cook, soups and salads are made by the server', () => {
    expect(defaultFoodRoute('d_cbsoup')).toBe('expo');
    expect(defaultFoodRoute('d_peach')).toBe('kds');
    expect(defaultFoodRoute('d_beer805')).toBe('none');
  });

  it('applies venue overrides; an old "none" override reads as the server making it', () => {
    const cfg = { ...DEFAULT_CONFIG, route: { 'sequoia|d_peach': 'expo', 'sequoia|d_cbsoup': 'none', 'sequoia|d_coffee': 'bar' } };
    expect(foodRoute('d_peach', 'sequoia', cfg)).toBe('expo');
    expect(foodRoute('d_peach', 'bistro', cfg)).toBe('kds');
    expect(foodRoute('d_cbsoup', 'sequoia', cfg)).toBe('expo');
    expect(drinkRoute('d_coffee', 'sequoia', cfg)).toBe('bar');
  });

  it('fired states', () => {
    expect(firedState('d_peach', 'sequoia')).toBe('cooking');
    expect(firedState('d_cbsoup', 'sequoia')).toBe('ready');
    expect(firedState('d_coffee', 'sequoia')).toBe('cleared');
    // Takeout never skips the pass.
    expect(queueFiredState('d_coffee', 'sequoia')).toBe('ready');
  });

  it('drink lines: dine-in drinks, but not on a takeout order', () => {
    expect(isDrinkLine(line('d_coffee'), { queueType: undefined })).toBe(true);
    expect(isDrinkLine(line('d_coffee'), { queueType: 'pickup' })).toBe(false);
    expect(isDrinkLine(line('d_coffee', { drink: true }), { queueType: 'pickup' })).toBe(true);
  });
});

describe('menu', () => {
  it('course and side classification match the prototype for every item', () => {
    const got = Object.fromEntries(catalog.map((i) => [i.id, { course: itemCourse(i.id), side: isSide(i.id) }]));
    expect(got).toEqual(prototype.courses);
  });

  it('alcohol matches the prototype', () => {
    expect(catalog.filter((i) => isAlcohol(i.id)).map((i) => i.id)).toEqual(prototype.booze);
  });

  it('short names match the prototype, and Back Office overrides win', () => {
    const got = Object.fromEntries(catalog.filter((i) => shortName(i.name) !== i.name).map((i) => [i.name, shortName(i.name)]));
    expect(got).toEqual(prototype.shortNames);
    expect(shortName('Atlantic Salmon', { ...DEFAULT_CONFIG, shortNames: { 'Atlantic Salmon': 'Salm' } })).toBe('Salm');
  });

  it('modifier names and text', () => {
    expect(modNames({ Add: ['Xtra Bacon', 'No Onions', 'Add Avocado'], Bread: 'Rye' })).toEqual(['Bacon', 'Add Avocado', 'Rye']);
    expect(modsText({ Prep: 'Grilled', Prepared: ['Chopped'], Notes: 'x', Sauce: 'None' }, 'On the side')).toBe(
      'Grilled · Chopped · On the side',
    );
  });

  it('chosenMods hides defaults the server did not change', () => {
    const item = { mods: [{ group: 'Temp', opts: ['Medium', 'Well'], default: 'Medium' }] } as never;
    expect(chosenMods({ Temp: 'Medium', Cheese: 'Swiss' }, item)).toEqual({ Cheese: 'Swiss' });
    expect(chosenMods({ Temp: 'Well' }, item)).toEqual({ Temp: 'Well' });
  });
});

describe('diet and allergy pills', () => {
  it('match the prototype for every resident', () => {
    const got = Object.fromEntries(residents.map((r) => [r.id, residentPills(r)]));
    expect(got).toEqual(prototype.pills);
  });

  it('only assisted living residents get pills, never guests', () => {
    const al = residents.find((r) => r.level === 'AL' && (r.allergies.length || r.diet.length))!;
    const d = { id: 'x', kind: 'resident' as const, refId: al.id, isGuest: false, seat: 1, items: [] };
    expect(dinerPills(d).length).toBeGreaterThan(0);
    expect(dinerPills({ ...d, isGuest: true })).toEqual([]);
  });
});
