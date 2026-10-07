import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diner, freezeClock, line, order } from '../../../../domain/__tests__/helpers';
import { afterPick, needsSide } from '../menu/afterPick';
import { boozeType, drinkSubcategory, entreeType, menuSections, menuTabs } from '../menu/menuCatalog';
import { groupFull, missingRequired, modsFromPicks, parsePick, picksFromMods, ruleText, togglePick } from '../menu/modifiers';
import { getItem } from '../../../../data';

beforeEach(() => freezeClock());
afterEach(() => vi.useRealTimers());

describe('menu catalog', () => {
  it('lists the dinner tabs in service order', () => {
    expect(menuTabs('Dinner')).toEqual(['Drinks', 'Specials', 'Starters', 'Entrees', 'Sides', 'Desserts']);
    expect(menuTabs('Breakfast')).not.toContain('Starters');
  });

  it('reads entrée types and drink subcategories off the name', () => {
    expect(entreeType({ name: 'Build Your Own Salad' })).toBe('byo');
    expect(entreeType({ name: 'Chicken Salad Sandwich' })).toBe('sandwich');
    expect(entreeType({ name: 'Spaghetti Bolognese' })).toBe('pasta');
    expect(entreeType({ name: 'Peach Glazed Chicken Breast' })).toBe('plate');
    expect(drinkSubcategory(getItem('d_coffee')!)).toBe('Coffee & Tea');
    expect(boozeType({ id: 'x', name: 'Mondavi Merlot' })).toBe('wine');
  });

  it('puts today’s specials first on Entrees, then the everyday menu by type', () => {
    const secs = menuSections('Dinner', 'Entrees', { drinkGroup: 'Non-Alcoholic', room: 'sequoia' });
    expect(secs[0]).toMatchObject({ kind: 'specials', label: "Today's specials" });
    expect(secs[0].items.every((i) => i.special)).toBe(true);
    const types = secs.slice(1).map((s) => s.key);
    expect(types).toEqual(
      [...types].sort(
        (a, b) => ['salad', 'sandwich', 'plate', 'pasta', 'byo'].indexOf(a) - ['salad', 'sandwich', 'plate', 'pasta', 'byo'].indexOf(b),
      ),
    );
  });

  it('groups drinks by subcategory and keeps cocktails to venues with a bar', () => {
    const soft = menuSections('Dinner', 'Drinks', { drinkGroup: 'Non-Alcoholic', room: 'sequoia' });
    expect(soft[0].label).toBe('Soft Drinks');
    const bar = menuSections('Dinner', 'Drinks', { drinkGroup: 'Alcoholic', room: 'sequoia' }).flatMap((s) => s.items);
    expect(bar.some((i) => getItem(i.id)?.category === 'Cocktails')).toBe(false);
  });

  it('searches the whole meal without headers', () => {
    const hits = menuSections('Dinner', 'Drinks', { drinkGroup: 'Non-Alcoholic', room: 'sequoia', search: 'peach' });
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toBeUndefined();
    expect(hits[0].items.map((i) => i.id)).toContain('d_peach');
    expect(menuSections('Dinner', 'Drinks', { drinkGroup: 'Non-Alcoholic', room: 'sequoia', search: 'zzz' })).toEqual([]);
  });
});

describe('modifiers', () => {
  it('parses action prefixes', () => {
    expect(parsePick('Xtra Bacon')).toMatchObject({ type: 'Xtra', name: 'Bacon', label: 'Xtra Bacon' });
    expect(parsePick('Medium Rare')).toMatchObject({ type: 'Add', name: 'Medium Rare', group: 'g_temp' });
  });

  it('swaps a one-pick group and stops at a group limit', () => {
    let picks = togglePick([], 'g_temp', 'Medium', 'Add');
    picks = togglePick(picks, 'g_temp', 'Well Done', 'Add');
    expect(picks.map((p) => p.name)).toEqual(['Well Done']);
    let cheese = togglePick([], 'g_cheese', 'Cheddar', 'Add');
    cheese = togglePick(cheese, 'g_cheese', 'Swiss', 'Add');
    expect(groupFull(cheese, 'g_cheese', 'Add')).toBe(true);
    expect(togglePick(cheese, 'g_cheese', 'American', 'Add')).toBe(cheese);
    expect(togglePick(cheese, 'g_cheese', 'Cheddar', 'Add').map((p) => p.name)).toEqual(['Swiss']);
  });

  it('asks for required pinned groups', () => {
    expect(missingRequired('d_deli', [])).toBe('Choose your bread before adding it.');
    expect(ruleText('g_pizza')).toBe('Optional · up to 4 · 3 included, then $1.00 each');
  });

  it('keeps the item’s own choices under their key so unchanged defaults stay hidden', () => {
    const picks = picksFromMods({ Temp: 'Medium Well', Cheese: 'American' });
    const changed = togglePick(picks, 'g_temp', 'Medium Rare', 'Add');
    const mods = modsFromPicks('d_burger', [...changed, parsePick('No Onions'), parsePick('Lite Mystery')]);
    expect(mods).toMatchObject({ Cheese: 'American', Temp: 'Medium Rare', Mods: ['Lite Mystery'] });
    expect(Object.values(mods).flat()).toContain('No Onions');
  });
});

describe('afterPick', () => {
  it('opens Sides for an entrée without a side, then moves on once a side is picked', () => {
    const a = diner([], { refId: 'r1' });
    const b = diner([], { refId: 'r2', seat: 2 });
    const o = order([a, b]);
    expect(needsSide('d_deli')).toBe(true);
    const tabs = menuTabs('Dinner');
    expect(afterPick(o, a.id, 'd_deli', null, tabs)).toEqual({ sideWait: a.id, tab: 'Sides' });
    expect(afterPick(o, a.id, 'd_mashed', a.id, tabs)).toEqual({ sideWait: null, diner: b.id, tab: 'Starters' });
  });

  it('moves to the next diner after an entrée, and stays on the last diner', () => {
    const a = diner([]);
    const b = diner([], { seat: 2 });
    const o = order([a, b]);
    const tabs = menuTabs('Dinner');
    expect(afterPick(o, a.id, 'd_peach', null, tabs)).toMatchObject({ diner: b.id, tab: 'Starters' });
    expect(afterPick(o, b.id, 'd_peach', null, tabs)).toEqual({ sideWait: null });
  });

  it('moves on after dessert only once the table has eaten', () => {
    const a = diner([line('d_peach', { sent: true })]);
    const b = diner([], { seat: 2 });
    expect(afterPick(order([a, b]), a.id, 'd_trifle', null, menuTabs('Dinner'))).toMatchObject({ diner: b.id });
    const fresh = order([diner([]), b]);
    expect(afterPick(fresh, fresh.diners[0].id, 'd_trifle', null, menuTabs('Dinner')).diner).toBeUndefined();
  });
});
