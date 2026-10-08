import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, isoOf } from '../../domain/cleaning';
import { TEMP_MEALS } from '../../domain/tempLog';
import { now, setClockOffset } from '../../lib/clock';
import { addTempDish, mealLog, menuDishesAround, recordTemp, setDishHold, tempDishes, tempLogStore } from '../tempLog';

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
});
