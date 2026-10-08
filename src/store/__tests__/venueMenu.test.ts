import { afterEach, describe, expect, it } from 'vitest';
import { SEED_GRID, SEED_MENU_DAY } from '../../data';
import { DAY_MS, weekStart } from '../../domain/menuCycle';
import { now } from '../../lib/clock';
import { PRODUCTION_VENUES, getProductionVenue, productionDay, productionWeeks, specialsFor, productionStore } from '../production';
import { activeMenuRecipes, activeRooms, menuLength, menusNow, roomVenue, venueServing, type VenueLike } from '../venueMenu';
import { patchVenue, venueSettingsStore } from '../venueSettings';
import { menuEditsStore } from '../menuEdits';

const menus = menusNow();
const at = now();
const v1 = (): VenueLike => venueSettingsStore.get().venues.find((v) => v.id === 'v1')!;

afterEach(() => {
  venueSettingsStore.reset();
  menuEditsStore.reset();
});

describe("a venue's day on its menu cycle", () => {
  it('lands the seeded specials on today by default (the tablet seed and the venue agree)', () => {
    const s = venueServing(v1(), at, menus, SEED_GRID);
    expect(s).toMatchObject({ cycleId: 'm1', alcId: 'm1:everyday', len: 35, day: SEED_MENU_DAY });
  });

  it('follows "Week 1 started": a week earlier is 7 cycle days later', () => {
    const start = v1().menuStartDt! - 7 * DAY_MS;
    expect(venueServing({ ...v1(), menuStartDt: start }, at, menus, SEED_GRID).day).toBe(((SEED_MENU_DAY + 7 - 1) % 35) + 1);
  });

  it('serves no specials with no cycle, and an à la carte menu saved as the cycle counts as à la carte', () => {
    expect(venueServing({ ...v1(), menuId: null, menuStartDt: null }, at, menus, SEED_GRID)).toMatchObject({ cycleId: null, day: 0 });
    expect(venueServing({ ...v1(), menuId: 'm2', alcMenuId: null }, at, menus, SEED_GRID)).toMatchObject({ cycleId: null, alcId: 'm2', day: 0 });
  });

  it('starts a scheduled menu on its day', () => {
    const v = { ...v1(), upcoming: [{ menuId: 'm5', startDt: weekStart(at).getTime() }] };
    expect(venueServing(v, at, menus, SEED_GRID)).toMatchObject({ cycleId: 'm5', day: Math.floor((at - weekStart(at).getTime()) / DAY_MS) + 1 });
  });

  it("counts a cycle's length from the menu, or the last placed day when later", () => {
    expect(menuLength('m1', menus, SEED_GRID)).toBe(35);
    expect(menuLength('m1', [{ id: 'm1', kind: 'cycle', cycleLen: 28 }], SEED_GRID)).toBe(35);
    expect(menuLength('m2', menus, SEED_GRID)).toBe(0);
  });
});

describe('rooms and their venues', () => {
  it("orders from the room's first active venue, and a room with none can't be picked", () => {
    const venues = venueSettingsStore.get().venues;
    expect(roomVenue('sequoia', venues)?.id).toBe('v1');
    expect(roomVenue('bistro', venues)?.id).toBe('v3');
    const retired = venues.map((v) => (v.id === 'v3' ? { ...v, active: false } : v));
    expect(roomVenue('bistro', retired)).toBeNull();
    expect(activeRooms(['sequoia', 'bistro'], retired)).toEqual(['sequoia']);
    expect(roomVenue('sequoia', venues.map((v) => (v.id === 'v1' ? { ...v, active: false } : v)))?.id).toBe('v2');
  });

  it('routes and prints every dish on the active cycles, not just this week', () => {
    const ids = new Set(activeMenuRecipes().map((r) => r.recipeId));
    const days = new Set(SEED_GRID.filter((g) => g.menuId === 'm1' && ids.has(g.recipeId)).map((g) => g.day));
    expect(days.size).toBe(36);
  });
});

describe('Production follows the venue by id', () => {
  it('keeps the plan when a venue is renamed, and shows the new name', () => {
    const before = productionDay('sequoia', 0);
    patchVenue('v1', { name: 'Sequoia Room' });
    const after = productionDay('sequoia', 0);
    expect(after.cycleDay).toBe(before.cycleDay);
    expect(after.rows.filter((r) => r.kind === 'special').length).toBeGreaterThan(0);
    expect(getProductionVenue('sequoia').fullName).toBe('Sequoia Room');
    expect(PRODUCTION_VENUES.every((v) => v.venueId)).toBe(true);
  });

  it("moves with the venue's week 1, the same day the tablets serve", () => {
    patchVenue('v1', { menuStartDt: v1().menuStartDt! - 7 * DAY_MS });
    expect(productionDay('sequoia', 0).cycleDay).toBe(((SEED_MENU_DAY + 7 - 1) % 35) + 1);
  });

  it("gives Prep the cycle's specials, so a Menu Cycle edit reaches the prep tablet", () => {
    const peach = SEED_GRID.find((g) => g.menuId === 'm1' && g.day === SEED_MENU_DAY && g.meal === 'Dinner' && g.recipeId.includes('peach'));
    expect(peach).toBeDefined();
    expect(specialsFor(productionStore.get(), 'sequoia', 0, 'Dinner').map((x) => x.name)).toContain('Peach Glazed Chicken Breast');
    menuEditsStore.set((s) => ({ ...s, grid: SEED_GRID.filter((g) => g !== peach) }));
    expect(specialsFor(productionStore.get(), 'sequoia', 0, 'Dinner').map((x) => x.name)).not.toContain('Peach Glazed Chicken Breast');
  });

  it('plans weeks Sunday to Saturday: this week runs to Saturday, next week is a full week', () => {
    const wed = new Date(2026, 9, 7, 12).getTime();
    expect(productionWeeks(wed)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7, 8, 9, 10],
    ]);
    const sun = new Date(2026, 9, 4, 12).getTime();
    expect(productionWeeks(sun)[0]).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
