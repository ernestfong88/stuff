import { afterEach, describe, expect, it } from 'vitest';
import { uniqueMenuName } from '../../../../domain/menuCycle';
import { linePrice } from '../../../../domain/billing';
import { now } from '../../../../lib/clock';
import { getBo, placementSides, resetMenuEdits, updateBo } from '../data';
import { blankMenu, setCycleLength } from '../menuActions';
import { menuHtml, printContext, printedRecipes, printMeals } from '../model/menuPrint';
import { venueServing } from '../../../../store/venueMenu';
import { addDays, dayStart, isoDay, weekStart } from '../../../../domain/menuCycle';

afterEach(() => resetMenuEdits());

describe('cycle length', () => {
  it('drops the days past a shorter cycle, with what is on them, and Undo puts them back', () => {
    const before = getBo().grid.filter((g) => g.menuId === 'm1');
    const week5 = before.filter((g) => g.day > 28);
    expect(week5.length).toBeGreaterThan(0);
    const undo = setCycleLength('m1', 28);
    const bo = getBo();
    expect(bo.menus.find((m) => m.id === 'm1')?.cycleLen).toBe(28);
    expect(bo.grid.filter((g) => g.menuId === 'm1' && g.day > 28)).toEqual([]);
    undo();
    expect(getBo().menus.find((m) => m.id === 'm1')?.cycleLen).toBe(35);
    expect(getBo().grid.filter((g) => g.menuId === 'm1').length).toBe(before.length);
  });
});

describe('new menus', () => {
  it("never take another menu's name", () => {
    expect(uniqueMenuName('VT Fall 2026', [{ name: 'VT Winter 2027' }])).toBe('VT Fall 2026');
    expect(uniqueMenuName('VT Fall 2026', [{ name: 'VT Fall 2026' }])).toBe('VT Fall 2026 (draft)');
    expect(uniqueMenuName('VT Fall 2026', [{ name: 'VT Fall 2026' }, { name: 'VT Fall 2026 (draft)' }])).toBe('VT Fall 2026 (draft 2)');
    const live = getBo().menus.find((m) => m.id === 'm1')!;
    const id = blankMenu(live.quarter, 'cycle');
    expect(getBo().menus.find((m) => m.id === id)?.name).toBe(`${live.name} (draft)`);
  });
});

describe('menu export', () => {
  const ctx = (venueId: string, at = now()) => printContext(getBo(), { venueId, at }, (m, d, r) => placementSides(getBo(), m, d, r).sides);

  it("counts what the printout lists: today's specials on the daily menu", () => {
    const c = ctx('v1');
    const daily = printedRecipes('daily', c);
    const html = menuHtml('daily', c);
    for (const id of daily) {
      const r = getBo().recipes.find((x) => x.id === id)!;
      expect(html).toContain(r.name.replace(/&/g, '&amp;').replace(/'/g, '&#39;'));
    }
    expect(daily.size).toBeLessThan(30);
  });

  it('prints every dish of an à la carte only venue on its daily menu, without saying it twice', () => {
    const c = ctx('v3');
    const html = menuHtml('daily', c);
    for (const name of ['Classic Terrace Burger', 'Build Your Own Deli Sandwich', 'French Fries', 'Vanilla Ice Cream Cup']) expect(html).toContain(name);
    expect(html).not.toContain('also available at every meal');
    expect(printedRecipes('daily', c).size).toBe(4);
  });

  it('prints the cycle day the floor serves on a chosen date', () => {
    const bo = getBo();
    const v1 = bo.venues.find((v) => v.id === 'v1')!;
    for (const n of [-9, 0, 3, 40]) {
      const at = addDays(dayStart(now()), n).getTime();
      const c = ctx('v1', at);
      expect(c.today).toBe(venueServing(v1, at, bo.menus, bo.grid).day);
      expect(isoDay(c.dateOf(c.today))).toBe(isoDay(new Date(at)));
    }
  });

  it('starts a week printout on the Sunday picked', () => {
    const sunday = addDays(weekStart(now()), 14);
    const c = ctx('v1', sunday.getTime());
    expect(c.today % 7).toBe(1);
    expect(menuHtml('week', c)).toContain(`${sunday.getMonth() + 1}/${sunday.getDate()} to `);
    expect(menuHtml('alacarte', c, { weekOf: sunday })).toContain(`À la carte · ${sunday.getMonth() + 1}/${sunday.getDate()} to `);
  });

  it('prints chosen meals a page each', () => {
    const c = ctx('v1');
    expect(printMeals(c).slice(0, 3)).toEqual(['Breakfast', 'Lunch', 'Dinner']);
    const html = menuHtml('daily', c, { meals: ['Dinner', 'Lunch'] });
    expect(html.match(/class="sheet"/g)).toHaveLength(2);
    expect(html.indexOf('Lunch · ')).toBeLessThan(html.indexOf('Dinner · '));
    expect(html).not.toContain('<h2>Breakfast</h2>');
    const lunch = printedRecipes('daily', c, { meals: ['Lunch'] });
    const all = printedRecipes('daily', c);
    expect(lunch.size).toBeGreaterThan(0);
    expect(lunch.size).toBeLessThan(all.size);
    for (const id of lunch) expect(all.has(id)).toBe(true);
  });
});

describe('room prices on a check', () => {
  it("rings a line ordered in another room at that room's venue prices", () => {
    updateBo(() => ({ prices: [{ recipeId: 'l_burger', venueId: 'v3', res: null, guest: 77, ala: 79 }] }));
    const guest = { kind: 'resident' as const, isGuest: true };
    const line = { id: 'x', itemId: 'l_burger', mods: {}, note: '', sent: false, kitchenState: null };
    expect(linePrice({ ...line, room: 'bistro' }, guest)).toBe(77);
    expect(linePrice({ ...line, room: 'bistro' }, guest, 'ala')).toBe(79);
    expect(linePrice(line, guest)).not.toBe(77);
  });
});
