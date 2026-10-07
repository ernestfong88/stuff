import { describe, expect, it } from 'vitest';
import modifierRulesSeed from '../../../../data/seed/modifierRules.json';
import { catalog, getItem, menuVersion, pinSeq } from '../../../../data';
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
});
