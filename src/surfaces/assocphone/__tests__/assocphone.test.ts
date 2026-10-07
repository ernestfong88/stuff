import { describe, expect, it } from 'vitest';
import type { AssocMeal, Order } from '../../../domain/types';
import { cancelMeal, lastTexted, pastMeals, planMeal } from '../../../domain/assocMeals/meals';
import { closedReason, itemsLeft, menuFor, menuWeek, missingChoice, modsText, mondayOf, STANDING_CHOICES } from '../../../domain/assocMeals/menu';
import { nearestToBreak, upcomingShifts, withinShift } from '../../../domain/assocMeals/shifts';
import { assocWindows, rangeLabel, windowClosesAt, windowLoad, windowMinutes, windowStartsAt, windowTag } from '../../../domain/assocMeals/windows';

const meal = (p: Partial<AssocMeal>): AssocMeal => ({
  id: 'x',
  date: '2026-10-07',
  meal: 'Lunch',
  window: '11:00 AM',
  associate: 'Jordan Reyes',
  item: 'Entrée Salad',
  status: 'Planned',
  note: '',
  log: [],
  ...p,
});

describe('pickup windows', () => {
  it('reads labels as minutes, NOC after midnight counting on', () => {
    expect(windowMinutes('5:15 PM')).toBe(1035);
    expect(windowMinutes('2:00 AM')).toBe(1560);
    expect(windowMinutes('soon')).toBeNull();
    expect(rangeLabel(1035)).toBe('5:15 to 5:30 PM');
    expect(rangeLabel(705)).toBe('11:45 AM to 12:00 PM');
    expect(windowTag('11:00 PM')).toBe('NOC · 11:00 to 11:15 PM');
  });

  it('offers the default ranges plus any already booked that day', () => {
    const lunch = assocWindows(undefined, 'Lunch', '2026-10-07', [meal({ window: '1:30 PM' })]);
    expect(lunch[0]).toBe('11:00 AM');
    expect(lunch.at(-1)).toBe('1:30 PM');
    expect(lunch).toHaveLength(11);
    expect(assocWindows(undefined, 'NOC', '2026-10-07', [])).toEqual(['11:00 PM', '2:00 AM']);
    expect(assocWindows({ assoc: [990, 1005] }, 'Dinner', '2026-10-07', [])).toEqual(['4:30 PM', '4:45 PM']);
  });

  it('closes NOC orders before the dinner line closes', () => {
    const at = windowStartsAt('2026-10-09', '2:00 AM');
    expect(new Date(at).getDate()).toBe(10);
    const closes = windowClosesAt('2026-10-09', '2:00 AM', 45, 1200);
    expect(new Date(closes).getHours()).toBe(19);
    expect(new Date(closes).getMinutes()).toBe(15);
    expect(windowClosesAt('2026-10-09', '5:00 PM', 45, 1200)).toBe(windowStartsAt('2026-10-09', '5:00 PM') - 45 * 60_000);
  });

  it('counts every kind of order against a range cap', () => {
    const order = { id: 'o', room: 'sequoia', queueType: 'pickup', readyAt: '5:00 PM', forDate: '2026-10-07', openedAt: 0, diners: [{ items: [{ cancelled: false }] }] } as unknown as Order;
    const meals = [meal({ window: '5:00 PM' }), meal({ window: '5:00 PM', status: 'Cancelled' })];
    expect(windowLoad({ total: 2 }, 'sequoia', '5:00 PM', '2026-10-07', [order], meals)).toEqual({ left: 0, full: true });
    expect(windowLoad({ total: 4 }, 'sequoia', '5:00 PM', '2026-10-07', [order], meals)).toEqual({ left: 2, full: false });
    expect(windowLoad({}, 'sequoia', '5:00 PM', '2026-10-07', [order], meals)).toEqual({ left: null, full: false });
  });
});

describe('associate menu', () => {
  const today = '2026-10-07';

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-10-07')).toBe('2026-10-05');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
  });

  it('opens this week, keeps next week a draft until scheduled, and nothing past it', () => {
    expect(closedReason('2026-10-06', today, {})).toBe('past');
    expect(closedReason('2026-10-09', today, {})).toBeNull();
    expect(closedReason('2026-10-13', today, {})).toBe('draft');
    expect(closedReason('2026-10-13', today, { '2026-10-12': { sched: true } })).toBeNull();
    expect(closedReason('2026-10-20', today, {})).toBe('late');
    expect(menuWeek('2026-10-12', today, { '2026-10-12': { cap: 4 } })).toMatchObject({ special: 'BBQ Pulled Pork Sandwich', cap: 4, sched: false });
  });

  it('puts the special first and counts what is left', () => {
    const menu = menuFor('2026-10-08', today, {}, { am_soup: { sub: 'Chili this week' } })!;
    expect(menu[0]).toMatchObject({ name: 'Peach Glazed Chicken Breast', cap: 12, special: true });
    expect(menu.find((x) => x.id === 'am_soup')!.sub).toBe('Chili this week');
    const all = [meal({ date: '2026-10-08', item: 'Peach Glazed Chicken Breast' }), meal({ date: '2026-10-08', item: 'Peach Glazed Chicken Breast', status: 'Cancelled' })];
    expect(itemsLeft(all, '2026-10-08', menu[0])).toBe(11);
    expect(itemsLeft(all, '2026-10-08', menu[1])).toBeNull();
  });

  it('asks for every choice in order', () => {
    const salad = STANDING_CHOICES[0];
    expect(missingChoice(salad, {})?.group).toBe('Dressing');
    expect(missingChoice(salad, { Dressing: 'Ranch' })?.group).toBe('Protein');
    expect(modsText(salad, { Protein: 'No protein', Dressing: 'Ranch' })).toBe('Ranch, No protein');
  });
});

describe('shifts and meals', () => {
  it('schedules the later shifts on Tuesdays of the coming weeks', () => {
    const shifts = upcomingShifts('2026-10-07');
    expect(shifts.map((s) => s.date)).toEqual(['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-13', '2026-10-20']);
  });

  it('keeps ranges inside the shift, overnight too, and picks the one near the break', () => {
    expect(withinShift(['11:00 PM', '2:00 AM'], { start: '10:00 PM', end: '6:30 AM' })).toEqual(['11:00 PM', '2:00 AM']);
    expect(withinShift(['11:00 AM', '4:30 PM'], { start: '10:30 AM', end: '3:00 PM' })).toEqual(['11:00 AM']);
    expect(nearestToBreak(['11:00 AM', '1:00 PM', '1:30 PM'], '1:15 PM')).toBe('1:00 PM');
    expect(nearestToBreak([], '1:15 PM')).toBeNull();
  });

  it('plans and cancels with a log line, and lists the history newest first', () => {
    let all = planMeal([], { date: '2026-10-08', meal: 'Dinner', item: 'Entrée Salad', window: '5:00 PM', mods: { Dressing: 'Ranch' }, note: 'Ranch' }, 'Jordan Reyes', 1000);
    expect(all[0]).toMatchObject({ status: 'Planned', mods: { Dressing: 'Ranch' }, log: [{ text: 'Planned in the Associate App' }] });
    all = cancelMeal(all, all[0].id, 'Jordan Reyes', 2000);
    expect(all[0].status).toBe('Cancelled');
    expect(all[0].log).toHaveLength(2);
    expect(pastMeals([meal({ id: 'a', date: '2026-10-05', status: 'Picked up' }), meal({ id: 'b', date: '2026-10-06', status: 'Picked up' })]).map((m) => m.id)).toEqual(['b', 'a']);
    expect(lastTexted(meal({ log: [{ by: 'M', at: 1, text: 'Moved to 5:30', texted: true }] }))).toBe('Moved to 5:30');
  });
});
