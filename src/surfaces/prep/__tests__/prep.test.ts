import { beforeEach, describe, expect, it } from 'vitest';
import { isoDate } from '../../../domain/pickup';
import { setClockOffset } from '../../../lib/clock';
import {
  checkMark,
  checklistForMeal,
  productionCount,
  productionDay,
  productionStore,
  setSpecialAmount,
  setSpecialSwap,
  specialAmount,
  specialsFor,
  starterChecklist,
  updateProductionCounts,
} from '../../../store/production';
import { formatQuantity, formatScale, mealAt, noteWhen, signature } from '../logic';

/** Pin the demo clock to a time of day today. */
function clockAt(h: number, m = 0) {
  setClockOffset(0);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  setClockOffset(d.getTime() - Date.now());
}

describe('prep helpers', () => {
  it('opens on the meal being served', () => {
    expect(mealAt(7)).toBe('Breakfast');
    expect(mealAt(10)).toBe('Lunch');
    expect(mealAt(14)).toBe('Lunch');
    expect(mealAt(15)).toBe('Dinner');
  });

  it('writes scaled amounts in quarters, never zero', () => {
    expect(formatQuantity(3)).toBe('3');
    expect(formatQuantity(1.5)).toBe('1½');
    expect(formatQuantity(0.74)).toBe('¾');
    expect(formatQuantity(2.26)).toBe('2¼');
    expect(formatQuantity(0.01)).toBe('¼');
    expect(formatScale(40, 8)).toBe('×5');
  });

  it('says when a note was left', () => {
    const now = new Date(2026, 9, 7, 18, 0).getTime();
    expect(noteWhen(new Date(2026, 9, 7, 14, 45).getTime(), now)).toBe('Today 2:45 PM');
    expect(noteWhen(new Date(2026, 9, 6, 7, 5).getTime(), now)).toBe('Yesterday 7:05 AM');
    expect(noteWhen(new Date(2026, 9, 4, 9, 0).getTime(), now)).toBe('Sun Oct 4 9:00 AM');
  });

  it('signs work as initial and last name', () => {
    expect(signature('Adriana Alvarado')).toBe('A. Alvarado');
    expect(signature('Cher')).toBe('Cher');
  });
});

describe('production store', () => {
  beforeEach(() => {
    clockAt(17, 45);
    productionStore.reset();
  });

  it("lists a cycle venue's specials entrées first, none at a fixed-menu venue", () => {
    const s = productionStore.get();
    const dinner = specialsFor(s, 'sequoia', 0, 'Dinner');
    expect(dinner.map((x) => x.kind)).toEqual(['entree', 'entree', 'soup', 'dessert']);
    expect(dinner[0].recipe?.base).toBe(8);
    expect(specialsFor(s, 'bistro', 0, 'Dinner')).toEqual([]);
    expect(specialsFor(s, 'sequoia', 1, 'Breakfast')).toEqual([]);
  });

  it('forecasts from covers until the director sets an amount; the latest word wins', () => {
    const iso = isoDate(0);
    const trifle = specialsFor(productionStore.get(), 'sequoia', 0, 'Dinner').find((x) => x.kind === 'dessert')!;
    expect(specialAmount(productionStore.get(), 'sequoia', iso, 'Dinner', trifle)).toEqual({ n: 32, set: false });
    setSpecialAmount('sequoia', iso, 'Dinner', trifle.slot, 20, 'E. Fong');
    expect(specialAmount(productionStore.get(), 'sequoia', iso, 'Dinner', trifle)).toMatchObject({ n: 20, set: true, by: 'E. Fong' });
    // Confirming the Back Office count later takes over.
    const row = productionDay('sequoia', 0).rows.find((r) => r.name === trifle.slot && r.meal === 'Dinner')!;
    clockAt(17, 50);
    updateProductionCounts('sequoia', iso, [row], { make: 25, ok: true, by: 'J. Doe' });
    expect(specialAmount(productionStore.get(), 'sequoia', iso, 'Dinner', trifle)).toMatchObject({ n: 25, by: 'J. Doe' });
  });

  it('keeps the slot when a special is swapped', () => {
    const iso = isoDate(0);
    setSpecialSwap('sequoia', iso, 'Dinner', 'Pineapple Trifle', 'Chocolate Pudding', 'E. Fong');
    const dessert = specialsFor(productionStore.get(), 'sequoia', 0, 'Dinner').find((x) => x.kind === 'dessert')!;
    expect(dessert).toMatchObject({ name: 'Chocolate Pudding', slot: 'Pineapple Trifle', from: 'Pineapple Trifle', swapBy: 'E. Fong' });
  });

  it('shows only the meal’s checklist items', () => {
    const groups = checklistForMeal(productionStore.get(), 'sequoia', 'Breakfast');
    expect(groups.map((g) => g.name)).toEqual(['Reach-ins']);
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(5);
  });

  it('keeps cleaning out of the starter checklist (it is in the Cleaning Log)', () => {
    expect(starterChecklist().map((g) => g.name)).toEqual(['Deli line', 'Reach-ins']);
  });

  it('never seeds a check later than now', () => {
    clockAt(6, 30);
    const item = starterChecklist()[1].items[0];
    const iso = isoDate(0);
    // Breakfast Reach-ins start at 6:20 AM + 9 min per group.
    expect(checkMark(productionStore.get(), 'sequoia', iso, 'Breakfast', item)).toMatchObject({ by: 'J. Rivera' });
    const later = starterChecklist()[1].items[4];
    expect(checkMark(productionStore.get(), 'sequoia', iso, 'Breakfast', later)).toBeNull();
  });

  it('weights always-available counts by weekday', () => {
    const day = productionDay('sequoia', 0);
    const any = day.rows.find((r) => r.kind === 'anyDay')!;
    expect(any.basis).toMatch(/^avg \w{3} breakfast, last 4 weeks: [\d.]+$/);
    expect(productionCount(productionStore.get(), 'sequoia', day.iso, any).ok).toBe(true);
  });
});
