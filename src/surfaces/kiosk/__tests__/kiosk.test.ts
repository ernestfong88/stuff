import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getItem, getResident, residents } from '../../../data';
import { dinerBilling } from '../../../domain/billing';
import { backWithin, countedSteps, INITIAL_STATE, nextStep, skips, type KioskState } from '../model/flow';
import { dishLongName, drinkGroup, drinkName, kioskMenu, shortList, versionMods, dishVersions, changeChips, modsFromWords } from '../../../domain/kioskMenu';
import { buildKioskOrder, kioskNote, kioskTextBody, mainDishName, planSentence, reviewWhen, sideIds } from '../model/order';
import { aptLetters, findResidents } from '../model/residents';
import { ASAP_WIN, kioskMeals, kioskTypes, nextTimes, timeChoices } from '../model/times';
import { mainWithSides, reviewLines } from '../model/review';
import { kioskUnitFor } from '../ui/unit';

const T0 = new Date(2026, 9, 7, 17, 45, 0, 0).getTime();
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

const none = () => false;
const dinner = kioskMenu('Dinner', none);
const eleanor = getResident('r2')!;

const state = (patch: Partial<KioskState>): KioskState => ({ ...INITIAL_STATE, ...patch });

describe('menu', () => {
  it('offers the meal’s specials, ready-made versions, soups and drinks, and hides what is 86’d', () => {
    expect(dinner.specials.map((i) => i.name)).toEqual(['Peach Glazed Chicken Breast', 'Cheese Stuffed Shells with Marinara']);
    expect(dinner.buildYourOwn.map((i) => i.name)).toContain('Build Your Own Pizza');
    expect(dinner.others.map(([g]) => g)).toEqual(['Entrée Salad', 'Sandwiches', 'Plates', 'Pasta']);
    expect(dinner.soups.map((i) => i.name)).toEqual(['Cheeseburger Soup']);
    expect(dinner.alcohol.some((i) => i.name.startsWith('BTL'))).toBe(false);
    expect(dinner.drinks.map(drinkName)).toContain('Alcohol-Free Chardonnay');
    const out = kioskMenu('Dinner', (id) => id === dinner.specials[0].id);
    expect(out.specials).toHaveLength(1);
  });

  it('names dishes and drinks the way residents read them', () => {
    expect(dishLongName('COD · Wild Salmon')).toBe('Catch of the Day (Wild Salmon)');
    expect(drinkName({ name: 'Glass of Blanc Mondavi' })).toBe('Blanc Mondavi');
    expect(drinkName({ name: 'Wine Alcohol Free Cab' })).toBe('Alcohol-Free Cabernet');
    expect(drinkGroup(dinner.drinks.find((d) => d.name === 'Hot Tea')!)).toBe('Coffee & tea');
  });

  it('builds the short list from the featured names, filled from the menu, keeping the current pick', () => {
    const pool = dinner.sides;
    const list = shortList(['French Fries', 'Not On Menu', 'Baked Potato', 'French Fries'], pool);
    expect(list.slice(0, 2).map((i) => i.name)).toEqual(['French Fries', 'Baked Potato']);
    expect(list).toHaveLength(9);
    const last = pool[pool.length - 1];
    expect(shortList(['French Fries'], pool, last.id)[0]).toBe(last);
  });

  it('turns a ready-made version into the line’s modifiers', () => {
    const pizza = getItem('d_pizza')!;
    const veggie = dishVersions(pizza).find((v) => v.name === 'Veggie')!;
    expect(veggie.title).toBe('Veggie Pizza');
    expect(versionMods('d_pizza', veggie)).toEqual({
      'Pizza Crust': 'Regular Crust',
      'Pizza Sauce': 'Marinara Base',
      'Pizza Toppings': ['Mushrooms', 'Green Peppers', 'Black Olives'],
      Cheese: ['Mozzarella'],
    });
    expect(changeChips(pizza)).toContain('Cut in small squares');
  });

  it('picks a modifier from words only on a clear match', () => {
    const it = getItem('d_burger')!;
    expect(modsFromWords(it, 'Well done please, and no cheese')).toEqual({ Temp: 'Well Done', Cheese: 'No cheese' });
    expect(modsFromWords(it, 'medium, thank you')).toEqual({ Temp: 'Medium' });
    expect(modsFromWords(it, 'thank you')).toEqual({});
  });
});

describe('questions', () => {
  it('skips the version question for an ordinary dish and the side question with no main', () => {
    expect(nextStep(state({ step: 'entree', entree: 'd_chicken', meal: 'Dinner' }), dinner)).toBe('side');
    expect(nextStep(state({ step: 'entree', entree: 'd_pizza', meal: 'Dinner' }), dinner)).toBe('ver');
    expect(nextStep(state({ step: 'entree', entree: null, meal: 'Dinner' }), dinner)).toBe('soup');
    expect(nextStep(state({ step: 'side', meal: 'Breakfast' }), kioskMenu('Breakfast', none))).toBe('drink');
  });

  it('goes back to the review while changing one answer, unless that answer leads on', () => {
    expect(nextStep(state({ step: 'drink', edit: true }), dinner)).toBe('review');
    expect(nextStep(state({ step: 'type', edit: true }), dinner)).toBe('meal');
    expect(nextStep(state({ step: 'entree', entree: 'd_pizza', edit: true }), dinner)).toBe('ver');
  });

  it('counts the questions that apply', () => {
    expect(countedSteps(state({ step: 'apt' }), null)).toHaveLength(14);
    expect(countedSteps(state({ step: 'drink', meal: 'Dinner', entree: 'd_chicken' }), dinner)).toHaveLength(13);
  });

  it('steps back inside a screen before leaving it', () => {
    expect(backWithin(state({ step: 'drink', more: 'drinks' }))).toEqual({ more: null });
    expect(backWithin(state({ step: 'drink', drinkList: true }))).toEqual({ drinkList: false });
    expect(backWithin(state({ step: 'dessert', moreDessert: true }))).toEqual({ moreDessert: false });
    expect(backWithin(state({ step: 'dessert', moreDessert: true, edit: true }))).toBeNull();
    expect(backWithin(state({ step: 'soup' }))).toBeNull();
  });
});

describe('finding the resident', () => {
  it('finds by any phone’s last four digits or by apartment', () => {
    expect(findResidents(residents, 'phone', '0103').map((r) => r.id)).toEqual(['r2']);
    expect(findResidents(residents, 'phone', '010')).toEqual([]);
    expect(findResidents(residents, 'apt', '153').map((r) => r.id)).toEqual(['r1', 'r1b']);
    expect(findResidents(residents, 'apt', 'A204').map((r) => r.name)).toEqual(['George Lindqvist']);
    expect(aptLetters(residents)).toEqual(['A', 'B']);
  });
});

describe('times', () => {
  const minute = (h: number, m: number) => h * 60 + m;
  it('offers ranges that are still open today, else tomorrow', () => {
    const meals = kioskMeals({}, 'pickup', minute(17, 45), '2026-10-07', '2026-10-08');
    expect(meals.map((m) => m.meal)).toEqual(['Dinner']);
    expect(meals[0].windows[0].at).toBe('6:30 PM');
    const late = kioskMeals({}, 'pickup', minute(21, 0), '2026-10-07', '2026-10-08');
    expect(late.map((m) => [m.meal, m.tomorrow])).toEqual([
      ['Breakfast', true],
      ['Lunch', true],
      ['Dinner', true],
    ]);
    // Ranges off keeps the type: it is made as soon as it is ready, like on the server tablet.
    const off = { types: { delivery: { on: false } } };
    expect(kioskTypes(off)).toEqual(['pickup', 'delivery']);
    expect(kioskMeals(off, 'delivery', minute(17, 45), '2026-10-07', '2026-10-08')).toEqual([
      { meal: 'Dinner', date: '2026-10-07', tomorrow: false, windows: [], asap: true },
    ]);
    expect(kioskMeals(off, 'delivery', minute(22, 0), '2026-10-07', '2026-10-08')).toEqual([]);
  });

  it('shows the next four open times and keeps the one already picked', () => {
    const meal = kioskMeals({}, 'pickup', minute(17, 45), '2026-10-07', '2026-10-08')[0];
    const choices = timeChoices({}, { orders: [], history: [], assocOrders: [] }, 'pickup', meal);
    expect(nextTimes(choices, null).map((c) => c.slot.at)).toEqual(['6:30 PM', '6:45 PM', '7:00 PM', '7:15 PM']);
    expect(nextTimes(choices, minute(19, 45)).map((c) => c.slot.at)).toEqual(['6:30 PM', '6:45 PM', '7:00 PM', '7:45 PM']);
  });
});

describe('the order', () => {
  const answers = state({
    resident: eleanor,
    type: 'pickup',
    meal: 'Dinner',
    date: '2026-10-07',
    win: 1110,
    entree: 'd_pizza',
    version: 'Veggie',
    side: 'none',
    soup: 'd_cbsoup',
    drink: dinner.drinks.find((d) => d.name === 'Iced Tea')!.id,
    changes: ['No onions'],
    note: kioskNote(['No onions'], ''),
    utensils: true,
  });
  const ctx = { id: 'kk1', now: T0, today: '2026-10-07', sickUsed: 0 };

  it('places a real pick up order the kitchen and PU & Delivery read like a staff one', () => {
    const o = buildKioskOrder(answers, ctx);
    expect(o).toMatchObject({ id: 'kk1', queueType: 'pickup', room: 'sequoia', server: 'Kiosk', source: 'kiosk', meal: 'Dinner', readyAt: '6:30 PM', utensils: true });
    expect(o.forDate).toBeUndefined();
    const lines = o.diners[0].items;
    expect(lines.map((l) => l.itemId)).toEqual(['d_cbsoup', 'd_pizza', answers.drink]);
    expect(lines[1]).toMatchObject({ note: 'Veggie Pizza · No onions', ver: 'Veggie Pizza', sent: false });
    expect(lines[1].mods).toMatchObject({ 'Pizza Crust': 'Regular Crust' });
  });

  it('keeps the sides an entrée comes with as their own lines', () => {
    const o = buildKioskOrder({ ...answers, entree: 'd_peach', version: null, side: 'keep' }, ctx);
    const sides = o.diners[0].items.filter((l) => l.parentId);
    expect(sides.map((l) => [getItem(l.itemId)?.name, l.autoSide])).toEqual([
      ['Mashed Potatoes', true],
      ['Garlic Green Beans', true],
    ]);
    expect(sideIds({ entree: 'd_peach', side: 'd_fries' })).toEqual(['d_fries']);
  });

  it('books tomorrow and waives a sick delivery fee', () => {
    const o = buildKioskOrder({ ...answers, type: 'delivery', sick: true, date: '2026-10-08' }, { ...ctx, sickUsed: 1 });
    expect(o.forDate).toBe('2026-10-08');
    expect(o.deliveryFeeId).toBe('df1');
    expect(o.sickTray).toMatchObject({ rid: 'r2', n: 2, by: 'Resident at the kiosk' });
  });

  it('reads back the order and texts a short copy', () => {
    expect(mainDishName(answers)).toBe('Veggie Pizza');
    expect(mainWithSides(answers)).toBe('Veggie Pizza, no side');
    expect(reviewWhen(answers, '2026-10-07')).toBe('Dinner today, 6:30 to 6:45 PM, pick up at the Sequoia Dining basket.');
    // No ranges for the type: as soon as it is ready, and the order says ASAP.
    expect(reviewWhen({ ...answers, win: ASAP_WIN }, '2026-10-07')).toBe('Dinner today, as soon as it is ready, pick up at the Sequoia Dining basket.');
    expect(buildKioskOrder({ ...answers, win: ASAP_WIN }, ctx).readyAt).toBe('ASAP');
    expect(skips('time', { ...answers, win: ASAP_WIN }, null)).toBe(true);
    const o = buildKioskOrder(answers, ctx);
    const bill = dinerBilling(o.diners[0], o);
    expect(planSentence(eleanor, bill)).toBe("Included in your meal plan. You'll have 7 meals left.");
    expect(kioskTextBody(answers, o, eleanor, bill, {}, '2026-10-07')).toBe(
      'Valencia Terrace Dining: your dinner order for today, 6:30 to 6:45 PM, pick up at the Sequoia Dining basket.\n- Cheeseburger Soup\n- Veggie Pizza\n- Iced Tea\nChanges: No onions',
    );
  });
});

describe('the review', () => {
  const answers = state({
    resident: eleanor,
    type: 'delivery',
    meal: 'Dinner',
    date: '2026-10-07',
    win: 1110,
    entree: 'd_peach',
    side: 'keep',
    soup: null,
    drink: null,
    dessert: null,
    utensils: false,
  });

  it('names the sides a dish comes with, a swapped side, or none', () => {
    expect(mainWithSides(answers)).toBe('Peach Glazed Chicken Breast, with mashed potatoes and garlic green beans');
    expect(mainWithSides({ ...answers, side: 'none' })).toBe('Peach Glazed Chicken Breast, no side');
    expect(mainWithSides({ entree: 'd_pizza', version: 'Veggie', side: 'none' })).toBe('Veggie Pizza, no side');
    expect(mainWithSides({ ...answers, entree: null })).toBe('');
  });

  it('reads back one answer a line, each opening its question to change it', () => {
    const lines = reviewLines(answers, dinner, '2026-10-07');
    expect(lines.map((l) => [l.label, l.value])).toEqual([
      ['When', `Dinner today, 6:30 to 6:45 PM, delivered to Apt ${eleanor.apt}`],
      ['Main dish', 'Peach Glazed Chicken Breast, with mashed potatoes and garlic green beans'],
      ['Soup', 'No soup'],
      ['Drink', 'No drink'],
      ['Dessert', 'No dessert'],
      ['Changes', 'No changes'],
      ['Utensils', 'No utensils or napkin'],
    ]);
    expect(lines.find((l) => l.key === 'when')?.to).toBe('type');
    expect(lines.find((l) => l.key === 'main')?.patch).toEqual({ special: 0, others: false });
    expect(reviewLines(answers, { ...dinner, soups: [], desserts: [] }, '2026-10-07').map((l) => l.key)).not.toContain('soup');
  });
});

describe('kiosk unit', () => {
  it('sizes portrait from the short side, and lets landscape grow with the width a little', () => {
    expect(kioskUnitFor(1080, 1920)).toBeCloseTo(0.9);
    expect(kioskUnitFor(1024, 700)).toBeCloseTo(1024 / 1460);
    expect(kioskUnitFor(1280, 800)).toBeCloseTo(800 / 960);
    expect(kioskUnitFor(1024, 700)).toBeGreaterThan(700 / 1200);
  });
});
