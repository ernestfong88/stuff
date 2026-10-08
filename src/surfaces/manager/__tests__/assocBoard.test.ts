import { describe, expect, it } from 'vitest';
import type { AssocMeal } from '../../../domain/types';
import { mealNow, orderStatus, pickupBoard, windowMinutes, type AssocWindow } from '../associates/assocProgram';

const MIN = 60_000;
/** Minutes from midnight as a stand-in clock: a range ends 15 minutes after it starts. */
const endOf = (w: string) => ((windowMinutes(w) ?? 0) + 15) * MIN;
const at = (h: number, m = 0) => (h * 60 + m) * MIN;

const meal = (id: string, window: string, extra: Partial<AssocMeal> = {}): AssocMeal => ({
  id,
  date: '2026-10-08',
  meal: 'Dinner',
  window,
  associate: id,
  item: 'Turkey Club',
  status: 'Planned',
  note: '',
  log: [],
  ...extra,
});

describe('associate pick up board', () => {
  const windows: AssocWindow[] = [
    { meal: 'Lunch', w: '11:00 AM' },
    { meal: 'Lunch', w: '1:30 PM' },
    { meal: 'Dinner', w: '5:00 PM' },
    { meal: 'Dinner', w: '7:00 PM' },
    { meal: 'NOC', w: '11:00 PM' },
  ];

  it('opens on the meal whose pick ups are still to come', () => {
    expect(mealNow(windows, at(9), endOf)).toBe('Lunch');
    expect(mealNow(windows, at(13, 40), endOf)).toBe('Lunch');
    expect(mealNow(windows, at(14), endOf)).toBe('Dinner');
    expect(mealNow(windows, at(19, 30), endOf)).toBe('NOC');
    expect(mealNow(windows, at(23, 30), endOf)).toBe('NOC');
    expect(mealNow([], at(12), endOf)).toBe('Lunch');
  });

  it('reads planned, in kitchen, ready, picked up and cancelled', () => {
    expect(orderStatus(meal('a', '5:00 PM'))).toBe('planned');
    expect(orderStatus({ ...meal('a', '5:00 PM'), firedAt: 1 } as AssocMeal)).toBe('kitchen');
    expect(orderStatus(meal('a', '5:00 PM', { readyAt: 2 }))).toBe('ready');
    expect(orderStatus(meal('a', '5:00 PM', { readyAt: 2, status: 'Picked up' }))).toBe('picked');
    expect(orderStatus(meal('a', '5:00 PM', { status: 'Cancelled' }))).toBe('cancelled');
  });

  it('groups one meal by pick up time, names in order, and sets the rest aside', () => {
    const orders = [
      meal('Zoe', '7:00 PM'),
      meal('Amy', '7:00 PM'),
      meal('Bea', '5:30 PM'),
      meal('Cal', '5:00 PM'),
      meal('Dan', '5:00 PM', { readyAt: 1 }),
      meal('Eve', '7:00 PM', { status: 'Cancelled' }),
      meal('Fay', '5:30 PM', { status: 'Picked up' }),
      meal('Gus', '11:45 AM'),
      meal('Hal', '11:00 PM'),
    ];
    const board = pickupBoard(orders, 'Dinner', at(17, 20), endOf, true);
    expect(board.now.map((g) => [g.w, g.orders.map((o) => o.associate)])).toEqual([
      // 5:00 has ended: the ready meal still waits at the pass, the planned one is earlier.
      ['5:00 PM', ['Dan']],
      ['5:30 PM', ['Bea']],
      ['7:00 PM', ['Amy', 'Zoe']],
    ]);
    expect(board.earlier.map((o) => o.associate)).toEqual(['Cal', 'Fay', 'Eve']);
  });

  it('lets a ready meal go once its range ends when pick ups are not tracked', () => {
    const board = pickupBoard([meal('Dan', '5:00 PM', { readyAt: 1 })], 'Dinner', at(17, 20), endOf, false);
    expect(board.now).toEqual([]);
    expect(board.earlier.map((o) => o.associate)).toEqual(['Dan']);
  });
});
