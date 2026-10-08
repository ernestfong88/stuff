import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, isoOf } from '../../domain/cleaning';
import { TEMP_MEALS, tempTotals } from '../../domain/tempLog';
import { now, setClockOffset } from '../../lib/clock';
import { addExtraTemp, addTempDish, mealLog, menuDishesAround, recordTemp, setDishHold, tempDishes, tempLogStore } from '../tempLog';

/** Pin the demo clock to Thursday Oct 8 2026 at h:m. */
function clockAt(h: number, m = 0) {
  setClockOffset(0);
  setClockOffset(new Date(2026, 9, 8, h, m).getTime() - Date.now());
}

const todayIso = () => isoOf(new Date(now()));

describe('temperature log store', () => {
  beforeEach(() => {
    clockAt(17, 45);
    tempLogStore.reset();
  });

  it('logs the menu’s hot and cold dishes for a meal, hot first, and leaves bread out', () => {
    const dishes = tempDishes(tempLogStore.get(), 'sequoia', todayIso(), 'Dinner');
    const names = dishes.map((d) => d.name);
    expect(names).toEqual(expect.arrayContaining(['Cheeseburger Soup', 'Peach Glazed Chicken Breast', 'Mashed Potatoes', 'Pineapple Trifle']));
    expect(names).not.toContain('Garlic Knot');
    const firstCold = dishes.findIndex((d) => d.hold === 'cold');
    expect(dishes.slice(firstCold).every((d) => d.hold === 'cold')).toBe(true);
  });

  it('seeds the past week up to now, never later, with readings out of range that have an action', () => {
    const s = tempLogStore.get();
    let count = 0;
    const outs: string[] = [];
    for (let d = -6; d <= 1; d++) {
      for (const meal of TEMP_MEALS) {
        for (const { dish, cells } of mealLog(s, 'sequoia', addDays(todayIso(), d), meal).dishes) {
          for (const c of cells) {
            if (!c.reading) continue;
            count++;
            expect(c.reading.at).toBeLessThanOrEqual(now());
            if (c.status === 'out') {
              expect(c.reading.action).toBeTruthy();
              outs.push(`${d} ${meal} ${dish.name} ${c.reading.tempF} ${c.reading.action}`);
            }
          }
        }
      }
    }
    expect(count).toBeGreaterThan(150);
    expect(outs.length).toBeGreaterThanOrEqual(2);
    expect(outs.length).toBeLessThanOrEqual(4);
    expect(outs.some((o) => o.startsWith('-1 Dinner') && o.endsWith('128 reheat'))).toBe(true);
    // Dinner is on: every dish but one went on the line, and the mid-service check is still ahead.
    const dinner = mealLog(s, 'sequoia', todayIso(), 'Dinner');
    expect(dinner.dishes.filter((d) => d.cells[0].status === 'overdue')).toHaveLength(1);
    expect(dinner.dishes.every((d) => d.cells[1].status === 'upcoming')).toBe(true);
    // Some past checks were missed.
    const missed = [-1, -2, -3, -4, -5, -6].flatMap((d) =>
      TEMP_MEALS.flatMap((m) => mealLog(s, 'sequoia', addDays(todayIso(), d), m).dishes.flatMap((x) => x.cells)),
    );
    expect(missed.some((c) => c.status === 'missed')).toBe(true);
  });

  it('records a reading out of range with its corrective action, recheck and who took it', () => {
    const iso = todayIso();
    const dish = tempDishes(tempLogStore.get(), 'sequoia', iso, 'Dinner').find((d) => d.hold === 'hot')!;
    recordTemp('sequoia', iso, 'Dinner', dish.key, 'mid1', { tempF: 126, action: 'reheat', recheckF: 170 }, 'GK', 'Grace Kim');
    const cell = mealLog(tempLogStore.get(), 'sequoia', iso, 'Dinner').dishes.find((d) => d.dish.key === dish.key)!.cells[1];
    expect(cell.reading?.at).toBeLessThanOrEqual(now());
    expect(cell.reading).toEqual({ tempF: 126, at: expect.any(Number), staffId: 'GK', by: 'G. Kim', action: 'reheat', recheckF: 170 });
    expect(cell.status).toBe('out');
  });

  it('adds a dish to one meal, and Back Office can change how a dish is held', () => {
    const iso = todayIso();
    addTempDish('bistro', iso, 'Lunch', 'Beef Stew', 'hot');
    const added = tempDishes(tempLogStore.get(), 'bistro', iso, 'Lunch').find((d) => d.name === 'Beef Stew');
    expect(added).toMatchObject({ hold: 'hot', added: true, cook: 'reheat' });
    expect(tempDishes(tempLogStore.get(), 'bistro', iso, 'Dinner').some((d) => d.name === 'Beef Stew')).toBe(false);

    setDishHold('sequoia', 'Garlic Knot', 'hot');
    expect(tempDishes(tempLogStore.get(), 'sequoia', iso, 'Dinner').map((d) => d.name)).toContain('Garlic Knot');
    setDishHold('sequoia', 'Pineapple Trifle', 'none');
    expect(tempDishes(tempLogStore.get(), 'sequoia', iso, 'Dinner').map((d) => d.name)).not.toContain('Pineapple Trifle');
    const trifle = menuDishesAround(tempLogStore.get(), 'sequoia', iso, 1).find((d) => d.name === 'Pineapple Trifle');
    expect(trifle).toMatchObject({ hold: 'none', inferred: 'cold' });
    setDishHold('sequoia', 'Pineapple Trifle', null);
    expect(tempDishes(tempLogStore.get(), 'sequoia', iso, 'Dinner').map((d) => d.name)).toContain('Pineapple Trifle');
  });

  it('adds extra checks on a dish, any number, judged against the holding target, in order after the seed’s and counted in the totals', () => {
    const iso = todayIso();
    const dish = tempDishes(tempLogStore.get(), 'sequoia', iso, 'Dinner').find((d) => d.hold === 'hot' && d.cook === 'poultry')!;
    const before = mealLog(tempLogStore.get(), 'sequoia', iso, 'Dinner');
    const totalsBefore = tempTotals(before.dishes.flatMap((d) => d.cells), before.dishes.flatMap((d) => d.extras));
    const id = addExtraTemp('sequoia', iso, 'Dinner', dish.key, { tempF: 150, reason: 'batch' }, 'GK', 'Grace Kim');
    addExtraTemp('sequoia', iso, 'Dinner', dish.key, { tempF: 128, reason: 'spot', action: 'reheat', recheckF: 168 }, 'GK', 'Grace Kim');
    const after = mealLog(tempLogStore.get(), 'sequoia', iso, 'Dinner');
    const dl = after.dishes.find((d) => d.dish.key === dish.key)!;
    expect(dl.extras.map((x) => [x.reading.tempF, x.reading.reason, x.status])).toEqual([
      [150, 'batch', 'ok'],
      [128, 'spot', 'out'],
    ]);
    expect(dl.extras[0].reading).toMatchObject({ id, by: 'G. Kim', staffId: 'GK' });
    expect(dl.extras[1].reading).toMatchObject({ action: 'reheat', recheckF: 168 });
    expect(dl.extras[0].target.label).toBe('≥ 135°F');
    // The scheduled checks are unchanged; the totals gain two readings and one out of range, nothing due or missed.
    expect(dl.cells.map((c) => c.status)).toEqual(before.dishes.find((d) => d.dish.key === dish.key)!.cells.map((c) => c.status));
    const totalsAfter = tempTotals(after.dishes.flatMap((d) => d.cells), after.dishes.flatMap((d) => d.extras));
    expect(totalsAfter).toEqual({ ...totalsBefore, taken: totalsBefore.taken + 2, out: totalsBefore.out + 1 });
    // Only that dish, at that meal and kitchen.
    expect(after.dishes.filter((d) => d.extras.length)).toHaveLength(1);
    expect(mealLog(tempLogStore.get(), 'bistro', iso, 'Dinner').dishes.every((d) => d.extras.length === 0)).toBe(true);
  });

  it('seeds an extra re-check after yesterday’s reheat and a new batch at lunch today, never later than now', () => {
    const s = tempLogStore.get();
    const yday = mealLog(s, 'sequoia', addDays(todayIso(), -1), 'Dinner').dishes.flatMap((d) => d.extras);
    expect(yday.map((x) => [x.reading.reason, x.status])).toEqual([['recheck', 'ok']]);
    const lunch = mealLog(s, 'sequoia', todayIso(), 'Lunch').dishes.flatMap((d) => d.extras);
    expect(lunch.map((x) => x.reading.reason)).toEqual(['batch']);
    for (const x of [...yday, ...lunch]) expect(x.reading.at).toBeLessThanOrEqual(now());
    // Before lunch's new batch came out, there is none.
    clockAt(12, 0);
    expect(mealLog(tempLogStore.get(), 'sequoia', todayIso(), 'Lunch').dishes.flatMap((d) => d.extras)).toHaveLength(0);
  });

  it('loads state saved before extra checks', () => {
    const iso = todayIso();
    const dish = tempDishes(tempLogStore.get(), 'sequoia', iso, 'Dinner')[0];
    tempLogStore.set({ readings: {}, added: {}, holds: {} });
    expect(mealLog(tempLogStore.get(), 'sequoia', iso, 'Dinner').dishes.every((d) => d.extras.length === 0)).toBe(true);
    addExtraTemp('sequoia', iso, 'Dinner', dish.key, { tempF: 38 }, 'GK', 'Grace Kim');
    expect(tempLogStore.get().extras?.[`sequoia|${iso}|Dinner|${dish.key}`]).toHaveLength(1);
  });
});
