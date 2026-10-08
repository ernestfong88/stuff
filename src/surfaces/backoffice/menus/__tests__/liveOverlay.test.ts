import { describe, expect, it } from 'vitest';
import modifierRulesSeed from '../../../../data/seed/modifierRules.json';
import { catalog, getItem, itemIn, menuDayOf, menuFor, menuVersion, pinSeq, SEED_MENU_DAY } from '../../../../data';
import { resetMenuEdits, RULE_DEFAULTS, SEED, updateBo } from '../data';
import { computeLive, liveModifiers } from '../model/liveOverlay';
import { tabletIndex } from '../model/tablet';
import type { BoState } from '../model/types';

const idx = tabletIndex();
const at = Date.now();
const live = (state: BoState) => computeLive({ state, seed: SEED, idx, ruleDefaults: RULE_DEFAULTS, pinSeq, at });

describe('computeLive', () => {
  it('leaves the tablet menu alone when nothing was edited', () => {
    const o = live(SEED);
    expect(o.items).toEqual({});
    expect(o.added).toEqual([]);
    expect(o.removed).toEqual([]);
    expect(o.modifierRules).toBeUndefined();
  });

  it('renames every meal copy of a dish', () => {
    const state = { ...SEED, recipes: SEED.recipes.map((r) => (r.id === 'l_burger' ? { ...r, name: 'Terrace Burger' } : r)) };
    const o = live(state);
    const ids = idx.idsOf.get('l_burger')!;
    expect(ids.length).toBeGreaterThan(1);
    for (const id of ids) expect(o.items[id]?.name).toBe('Terrace Burger');
  });

  it('hides a dish taken off a meal and adds one put on it', () => {
    const lunchBurger = SEED.grid.find((g) => g.menuId === 'm1' && g.day === 0 && g.meal === 'Lunch' && g.recipeId === 'l_burger')!;
    const newRecipe = { id: 'x_new', name: 'Harvest Chili', cat: 'Starters' as const, desc: 'Beans and squash', price: 6 };
    const state: BoState = {
      ...SEED,
      recipes: [...SEED.recipes, newRecipe],
      grid: [...SEED.grid.filter((g) => g !== lunchBurger), { id: 'gx', menuId: 'm1', recipeId: 'x_new', day: 0, meal: 'Lunch', cat: 'Starters', sort: 1 }],
    };
    const o = live(state);
    expect(o.items['l_burger']?.day).toBe(-1);
    expect(o.items['d_burger']).toBeUndefined();
    expect(o.added).toHaveLength(1);
    expect(o.added[0]).toMatchObject({ meal: 'Lunch', category: 'Starters', item: { id: 'x_new', name: 'Harvest Chili', guestPrice: 6, day: 0 } });
  });

  it('applies dining room prices', () => {
    const o = live({ ...SEED, prices: [{ recipeId: 'l_burger', venueId: 'v1', res: null, guest: 15, ala: null }] });
    expect(o.items['l_burger']).toEqual({ guestPrice: 15 });
  });

  it('removes a dish moved to Snacks', () => {
    const o = live({ ...SEED, recipes: SEED.recipes.map((r) => (r.id === 'l_burger' ? { ...r, cat: 'Snacks' as const } : r)) });
    expect(o.removed).toEqual(expect.arrayContaining(idx.idsOf.get('l_burger')!));
  });
});

describe('each room orders from its own venue', () => {
  const v = (id: string) => SEED.venues.find((x) => x.id === id)!;
  const withVenue = (id: string, patch: Partial<BoState['venues'][number]>): BoState => ({ ...SEED, venues: SEED.venues.map((x) => (x.id === id ? { ...x, ...patch } : x)) });

  it("puts today's specials on the venue's cycle day, which follows its week 1", () => {
    expect(live(SEED).day).toBe(SEED_MENU_DAY);
    const o = live(withVenue('v1', { menuStartDt: v('v1').menuStartDt! - 7 * 86_400_000 }));
    const day = ((SEED_MENU_DAY + 7 - 1) % 35) + 1;
    expect(o.day).toBe(day);
    const want = SEED.grid.filter((g) => g.menuId === 'm1' && g.day === day && g.meal === 'Dinner' && g.cat === 'Entrees').map((g) => g.recipeId);
    const today = o.added.filter((a) => a.meal === 'Dinner' && a.item.day === day).map((a) => a.item.id);
    for (const id of want) expect(today.some((x) => x === id || idx.canonOf.get(x) === id)).toBe(true);
  });

  it('serves no specials with "No cycle menu" (no quiet fallback to another cycle)', () => {
    const o = live(withVenue('v1', { menuId: null, menuStartDt: null }));
    expect(o.day).toBe(0);
    expect(o.added.filter((a) => a.item.day > 0)).toEqual([]);
  });

  it("honours the à la carte choice: none hides the every-day dishes, another menu shows its own", () => {
    const none = live(withVenue('v1', { alcMenuId: null }));
    expect(none.items['l_burger']?.day).toBe(-1);
    const bistro = live(withVenue('v1', { alcMenuId: 'm2' }));
    expect(bistro.items['l_burger']).toBeUndefined();
    expect(bistro.items['l_wings']?.day).toBe(-1);
  });

  it("gives The Bistro its own menu and prices, and the dining room keeps Sequoia's", () => {
    const o = live({ ...SEED, prices: [{ recipeId: 'l_burger', venueId: 'v3', res: null, guest: 77, ala: null }] });
    expect(o.items['l_burger']).toBeUndefined();
    const b = o.rooms!.bistro;
    expect(b).toMatchObject({ venueId: 'v3', day: 0 });
    expect(b.items['l_burger']).toEqual({ guestPrice: 77 });
    expect(b.items['l_wings']?.day).toBe(-1);
  });
});

describe('liveModifiers', () => {
  it('reproduces the shipped modifier rules from the seed groups', () => {
    const m = liveModifiers(SEED, idx, RULE_DEFAULTS, pinSeq);
    expect(m.modifierRules).toEqual(modifierRulesSeed);
  });
});

describe('the floor sees Back Office edits', () => {
  it('renames, reprices and restores tablet items through src/data', () => {
    const v0 = menuVersion();
    updateBo((s) => ({
      recipes: s.recipes.map((r) => (r.id === 'l_burger' ? { ...r, name: 'Terrace Burger' } : r)),
      prices: [{ recipeId: 'l_burger', venueId: 'v1', res: null, guest: 15, ala: null }],
    }));
    expect(menuVersion()).toBeGreaterThan(v0);
    expect(getItem('d_burger')?.name).toBe('Terrace Burger');
    expect(getItem('l_burger')?.guestPrice).toBe(15);
    expect(catalog.filter((i) => i.name === 'Terrace Burger').length).toBeGreaterThan(1);
    resetMenuEdits();
    expect(getItem('d_burger')?.name).not.toBe('Terrace Burger');
  });

  it("lists each room's menu at its own prices, and only today's dishes", () => {
    updateBo(() => ({ prices: [{ recipeId: 'l_burger', venueId: 'v3', res: null, guest: 77, ala: null }] }));
    expect(itemIn('l_burger', 'bistro')?.guestPrice).toBe(77);
    expect(itemIn('l_burger', 'sequoia')?.guestPrice).not.toBe(77);
    expect(getItem('l_burger')?.guestPrice).not.toBe(77);
    const bistroLunch = Object.values(menuFor('bistro').Lunch).flat().map((i) => i.id);
    expect(bistroLunch).toContain('l_burger');
    expect(bistroLunch).not.toContain('l_wings');
    expect(menuDayOf('bistro')).toBe(0);
    expect(menuDayOf()).toBe(SEED_MENU_DAY);
    // Nothing from another cycle day is on the dining room's menu.
    for (const it of Object.values(menuFor('sequoia').Dinner).flat()) expect([0, SEED_MENU_DAY]).toContain(it.day);
    resetMenuEdits();
  });
});
