import { describe, expect, it } from 'vitest';
import {
  COOK_MIN_F,
  actionsFor,
  clockLabel,
  cookKind,
  dishKey,
  extraCell,
  extraTarget,
  inRange,
  inferHold,
  mealChecks,
  plausibleTemp,
  targetFor,
  tempStatus,
  tempTotals,
  type TempReading,
} from '../tempLog';

/** Thursday Oct 8 2026 at h:m. */
const thu = (h: number, m = 0) => new Date(2026, 9, 8, h, m).getTime();
const reading = (tempF: number): TempReading => ({ tempF, at: thu(16, 20), staffId: 'TR', by: 'T. Reyes' });

describe('how a dish is held', () => {
  it('holds soups, entrées and hot sides hot; salads, cold starters and desserts like pudding cold', () => {
    expect(inferHold('Cheeseburger Soup', 'Starters')).toBe('hot');
    expect(inferHold('Peach Glazed Chicken Breast', 'Entrees')).toBe('hot');
    expect(inferHold('Mashed Potatoes', 'Sides')).toBe('hot');
    expect(inferHold('Vegetable Egg Roll', 'Sides')).toBe('hot');
    expect(inferHold('BBQ Chopped Chicken Salad', 'Entrees')).toBe('cold');
    expect(inferHold('Creamy Potato Salad', 'Sides')).toBe('cold');
    expect(inferHold('Vanilla Pudding', 'Desserts')).toBe('cold');
    expect(inferHold('Greek Yogurt Parfait', 'Any Day')).toBe('cold');
    expect(inferHold('Pineapple Trifle', 'Desserts')).toBe('cold');
    expect(inferHold('Build Your Own Deli Sandwich', 'Any Day')).toBe('cold');
  });

  it('says hot when the name does, and leaves bread and bakery out', () => {
    expect(inferHold('Warm Bread Pudding with Caramel', 'Desserts')).toBe('hot');
    expect(inferHold('Herb Bread Stuffing', 'Sides')).toBe('hot');
    expect(inferHold('Baked Roll', 'Sides')).toBe('none');
    expect(inferHold('Garlic Knot', 'Sides')).toBe('none');
    expect(inferHold('Carrot Cake Cupcake', 'Desserts')).toBe('none');
    expect(inferHold('PB & Jelly Sandwich', 'Any Day')).toBe('none');
  });

  it('knows the cooking temperature each hot dish must reach', () => {
    expect(cookKind('Minestrone')).toBe('reheat');
    expect(cookKind('Cheeseburger Soup')).toBe('reheat');
    expect(cookKind('Roast Turkey with Cranberry Sauce')).toBe('poultry');
    expect(cookKind('Salmon Burger')).toBe('ground');
    expect(cookKind('Patty Melt')).toBe('ground');
    expect(cookKind('Build Your Own Omelet')).toBe('egg');
    expect(cookKind('Buttered Egg Noodles')).toBe('other');
    expect(cookKind('Teriyaki Salmon')).toBe('whole');
    expect(cookKind('Ham Steak Plate')).toBe('whole');
    expect(cookKind('Ratatouille')).toBe('other');
    expect([COOK_MIN_F.reheat, COOK_MIN_F.poultry, COOK_MIN_F.ground, COOK_MIN_F.whole, COOK_MIN_F.other]).toEqual([165, 165, 155, 145, 135]);
  });

  it('keys a dish by its name', () => {
    expect(dishKey('  Peach Glazed Chicken!  ')).toBe('peach-glazed-chicken');
  });
});

describe('targets and actions', () => {
  it('a hot dish reaches its cooking temperature on the line and stays at 135°F or above; a cold one at 41°F or below', () => {
    expect(targetFor('hot', 'line', 'poultry')).toEqual({ min: 165, label: '≥ 165°F' });
    expect(targetFor('hot', 'hold', 'poultry')).toEqual({ min: 135, label: '≥ 135°F' });
    expect(targetFor('cold', 'line')).toEqual({ max: 41, label: '≤ 41°F' });
    expect(inRange(targetFor('hot', 'hold'), 135)).toBe(true);
    expect(inRange(targetFor('hot', 'hold'), 134.9)).toBe(false);
    expect(inRange(targetFor('cold', 'hold'), 41)).toBe(true);
    expect(inRange(targetFor('cold', 'hold'), 42)).toBe(false);
    expect(inRange(targetFor('hot', 'line', 'ground'), 150)).toBe(false);
  });

  it('offers reheat for hot food, chill for cold, and discard or recheck for both', () => {
    expect(actionsFor('hot')).toEqual(['reheat', 'discard', 'recheck']);
    expect(actionsFor('cold')).toEqual(['chill', 'discard', 'recheck']);
  });

  it('takes only temperatures a probe reads', () => {
    expect(plausibleTemp(38)).toBe(true);
    expect(plausibleTemp(251)).toBe(false);
    expect(plausibleTemp(NaN)).toBe(false);
  });
});

describe('checks due', () => {
  it('checks each meal on the line and once mid-service', () => {
    expect(mealChecks('Dinner').map((c) => [c.id, c.label, clockLabel(c.due)])).toEqual([
      ['line', 'On the line', '4:30 PM'],
      ['mid1', 'Mid-service', '6:30 PM'],
    ]);
    expect(mealChecks('Breakfast').map((c) => clockLabel(c.due))).toEqual(['7:00 AM', '9:00 AM']);
  });

  it('a check is upcoming, then due, then overdue, and missed once the meal is over', () => {
    const [line, mid] = mealChecks('Dinner');
    const hold = targetFor('hot', 'hold');
    expect(tempStatus('Dinner', line, '2026-10-08', null, hold, thu(15, 50))).toBe('upcoming');
    expect(tempStatus('Dinner', line, '2026-10-08', null, hold, thu(16, 10))).toBe('due');
    expect(tempStatus('Dinner', line, '2026-10-08', null, hold, thu(17, 45))).toBe('overdue');
    expect(tempStatus('Dinner', mid, '2026-10-08', null, hold, thu(17, 45))).toBe('upcoming');
    expect(tempStatus('Dinner', mid, '2026-10-08', null, hold, thu(18, 10))).toBe('due');
    expect(tempStatus('Dinner', mid, '2026-10-08', null, hold, thu(19, 0))).toBe('missed');
    expect(tempStatus('Dinner', mid, '2026-10-07', null, hold, thu(8))).toBe('missed');
    expect(tempStatus('Dinner', mid, '2026-10-09', null, hold, thu(8))).toBe('upcoming');
  });

  it('a reading is ok in range and out of range otherwise, and the totals count both and what was missed', () => {
    const [line, mid] = mealChecks('Lunch');
    const hold = targetFor('hot', 'hold');
    const ok = { check: mid, target: hold, reading: reading(150), status: tempStatus('Lunch', mid, '2026-10-08', reading(150), hold, thu(17)) };
    const out = { check: mid, target: hold, reading: reading(128), status: tempStatus('Lunch', mid, '2026-10-08', reading(128), hold, thu(17)) };
    const missed = { check: line, target: hold, reading: null, status: tempStatus('Lunch', line, '2026-10-08', null, hold, thu(17)) };
    expect([ok.status, out.status, missed.status]).toEqual(['ok', 'out', 'missed']);
    expect(tempTotals([ok, out, missed])).toEqual({ taken: 2, out: 1, missed: 1, overdue: 0, open: 0 });
  });

  it('an extra check is judged against the holding target, not the cook temperature, and adds to readings taken and out of range only', () => {
    expect(extraTarget('hot')).toEqual(targetFor('hot', 'hold'));
    expect(extraTarget('cold')).toEqual({ max: 41, label: '≤ 41°F' });
    // 150°F would fail a poultry dish on the line (165°F) but is fine as an extra check.
    expect(extraCell('hot', { ...reading(150), id: 'x1', reason: 'recheck' }).status).toBe('ok');
    expect(extraCell('hot', { ...reading(130), id: 'x2' }).status).toBe('out');
    expect(extraCell('cold', { ...reading(45), id: 'x3', reason: 'spot' }).status).toBe('out');
    const [, mid] = mealChecks('Lunch');
    const hold = targetFor('hot', 'hold');
    const missed = { check: mid, target: hold, reading: null, status: tempStatus('Lunch', mid, '2026-10-08', null, hold, thu(17)) };
    const extras = [extraCell('hot', { ...reading(150), id: 'a' }), extraCell('hot', { ...reading(130), id: 'b', action: 'reheat', recheckF: 170 })];
    expect(tempTotals([missed], extras)).toEqual({ taken: 2, out: 1, missed: 1, overdue: 0, open: 0 });
  });
});
