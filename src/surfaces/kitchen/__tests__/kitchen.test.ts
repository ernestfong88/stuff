import { describe, expect, it } from 'vitest';
import { order, diner } from '../../../domain/__tests__/helpers';
import { cycleDay, cycleWeekLabel, menuQuarter, quarterStyle } from '../admin/menuCycle';
import { routableItems, routingView } from '../admin/routingList';
import { actionForKey, barKeyName, bumpHit, DEFAULT_BUMP_KEYS, keyName, resolveBumpKeys } from '../bumpKeys';
import { looseSubcategories, resizeScreens, screensForItem, toggleSubcategory, type KdsScreen } from '../../../domain/kdsScreens';
import { courseWord, pickupWindow } from '../kitchenTime';
import { orderTextPlan } from '../orderTexts';
import { canonicalItemId, entreeTypeOf, kdsKeyOf, recipeItemIds, subcategoryOf, suggestedEntreeType } from '../../../domain/subcategories';
import seed from '../../../data/seed/venueSettings.json';
import { DEFAULT_CONFIG } from '../../../domain/config';

const SEQUOIA = (seed as unknown as { kds: { sequoia: KdsScreen[] } }).kds.sequoia;

describe('subcategories', () => {
  it('files dishes by group and subcategory', () => {
    expect(kdsKeyOf('d_peach', {})).toBe('Entrees|Plates');
    expect(kdsKeyOf('d_shells', {})).toBe('Entrees|Pasta');
    expect(kdsKeyOf('l_burger', {})).toBe('Entrees|Sandwiches');
    expect(kdsKeyOf('d_cbsoup', {})).toBe('Starters|Soup');
    expect(kdsKeyOf('d_mashed', {})).toBe('Sides|Potato');
    expect(kdsKeyOf('d_sidesalad', {})).toBe('Sides|Side Salad');
    expect(kdsKeyOf('d_icecream', {})).toBe('Desserts|Ice Cream / Frozen');
    expect(kdsKeyOf('d_trifle', {})).toBe('Desserts|Pudding / Custard');
  });

  it('lets a Back Office choice win, by recipe across meals', () => {
    const canon = canonicalItemId('d_peach');
    expect(entreeTypeOf('d_peach', { [canon]: 'Pasta' })).toBe('pasta');
    expect(subcategoryOf('d_mashed', 'Sides', { [canonicalItemId('d_mashed')]: 'Vegetable' })).toBe('Vegetable');
    // A choice that is not a subcategory of the group is ignored.
    expect(subcategoryOf('d_mashed', 'Sides', { [canonicalItemId('d_mashed')]: 'Plates' })).toBe('Potato');
  });

  it('suggests entree types from the name', () => {
    expect(suggestedEntreeType('Build Your Own Salad')).toBe('byo');
    expect(suggestedEntreeType('Chicken Salad Sandwich')).toBe('sandwich');
    expect(suggestedEntreeType('Caesar Salad')).toBe('salad');
    expect(suggestedEntreeType('Penne Alfredo')).toBe('pasta');
    expect(suggestedEntreeType('Pot Roast')).toBe('plate');
  });

  it('treats each meal’s copy of a dish as one recipe', () => {
    expect(canonicalItemId('d_cbsoup')).toBe(canonicalItemId('l_cbsoup'));
    expect(recipeItemIds('d_cbsoup')).toEqual(expect.arrayContaining(['l_cbsoup', 'd_cbsoup']));
  });
});

describe('KDS screens', () => {
  it('sends a dish to the screens that tick its subcategory, else the first', () => {
    expect(screensForItem('d_peach', 'sequoia', SEQUOIA, {})).toEqual(['sequoia:0']);
    expect(screensForItem('d_sidesalad', 'sequoia', SEQUOIA, {})).toEqual(['sequoia:1']);
    // Starters|Bread is ticked nowhere: it lands on the first screen.
    expect(looseSubcategories(SEQUOIA)).toContain('Starters|Bread');
    expect(screensForItem('d_peach', 'bistro', [{ name: 'Kitchen', subs: [] }], {})).toEqual(['bistro:0']);
  });

  it('shows a subcategory ticked twice on both screens', () => {
    const both = toggleSubcategory(SEQUOIA, 1, 'Entrees|Plates');
    expect(screensForItem('d_peach', 'sequoia', both, {})).toEqual(['sequoia:0', 'sequoia:1']);
  });

  it('keeps everything when screens are removed, and gives desserts their own third screen', () => {
    const one = resizeScreens(SEQUOIA, 1);
    expect(one).toHaveLength(1);
    expect(one[0].subs).toEqual(expect.arrayContaining([...SEQUOIA[0].subs, ...SEQUOIA[1].subs]));
    const three = resizeScreens(SEQUOIA, 3);
    expect(three[2].name).toBe('Dessert');
    expect(three[1].subs.some((k) => k.startsWith('Desserts|'))).toBe(false);
    expect(resizeScreens(one, 2)[1]).toEqual({ name: 'Cold', subs: [] });
  });
});

describe('bump keys', () => {
  it('matches on key or code, so the numpad minus works', () => {
    expect(bumpHit(DEFAULT_BUMP_KEYS, 'left', { key: '-', code: 'NumpadSubtract' })).toBe(true);
    expect(actionForKey(DEFAULT_BUMP_KEYS, { key: 'Enter', code: 'Enter' })).toBe('bumpTicket');
  });

  it('moves a key from its default to its assignment, or switches it off', () => {
    const map = resolveBumpKeys({ Enter: 'bumpItem', ArrowUp: 'none' });
    expect(map.bumpTicket).toEqual([]);
    expect(map.bumpItem).toContain('Enter');
    expect(map.left).toEqual(['NumpadSubtract']);
  });

  it('names keys the way the bar is labelled', () => {
    expect(keyName(' ')).toBe('Space');
    expect(keyName('m')).toBe('M');
    expect(barKeyName('ArrowDown')).toBe('→ on the bar');
  });
});

describe('time labels', () => {
  it('turns a promise into its 15 minute window', () => {
    expect(pickupWindow('4:45 PM')).toBe('4:45 to 5:00 PM');
    expect(pickupWindow('11:50 AM')).toBe('11:50 AM to 12:05 PM');
    expect(pickupWindow('ASAP')).toBe('ASAP');
    expect(courseWord(3)).toBe('Desserts');
  });
});

describe('order texts', () => {
  it('texts a resident with a mobile, unless the text is off', () => {
    const o = order([diner([], { refId: 'r1' })], { queueType: 'pickup' });
    expect(orderTextPlan(o, {}).sent).toBe(true);
    expect(orderTextPlan(o, { texts: { pickupReady: { on: false } } })).toEqual({ sent: false, why: 'no text' });
    expect(orderTextPlan({ ...o, diners: [diner([], { refId: 'r4' })] }, {})).toEqual({ sent: false, why: 'no mobile' });
    expect(orderTextPlan({ ...o, diners: [diner([], { refId: 'r4' })] }, { mobile: { r4: true } }).sent).toBe(true);
  });
});

describe('menu cycle', () => {
  const day = (d: number) => new Date(2026, 9, d, 12).getTime();
  it('counts the cycle day from the Sunday of the start week and wraps', () => {
    // Oct 4, 2026 is a Sunday.
    expect(cycleDay(day(4), 35, day(4))).toBe(1);
    expect(cycleDay(day(4), 7, day(11))).toBe(1);
    expect(cycleDay(day(4), 7, day(10))).toBe(7);
    // A start mid-week counts from that week's Sunday: Wednesday is day 4.
    expect(cycleDay(day(7), 35, day(7))).toBe(4);
    expect(cycleDay(null, 7, day(7))).toBeNull();
    const m = { id: 'm', name: 'M', season: 'Fall 2026', quarter: '', kind: 'cycle', status: 'active', cycleLen: 35 };
    expect(cycleWeekLabel(day(4), m, day(18))).toBe('Week 3 of 5');
    expect(menuQuarter(m)).toBe('Q4 2026');
    expect(quarterStyle('Q4 2026').season).toBe('Fall');
  });
});

describe('kitchen routing list', () => {
  it('lists each recipe once and, without a search, only what skips the cook', () => {
    const items = routableItems();
    const ids = items.map((i) => canonicalItemId(i.item.id));
    expect(new Set(ids).size).toBe(ids.length);
    const view = routingView(items, 'sequoia', DEFAULT_CONFIG, '');
    expect(view[0].title).toBe('Server makes it');
    expect(view[0].items.map((i) => i.item.name)).toContain('Cheeseburger Soup');
    expect(routingView(items, 'sequoia', DEFAULT_CONFIG, 'peach')[0].title).toBe('Entrées');
  });
});
