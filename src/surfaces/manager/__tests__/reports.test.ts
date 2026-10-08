import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssocMeal, Diner, Order } from '../../../domain/types';
import { checkMoney, feedbackSummary, formatMinutes, shiftMoney, ticketWeek } from '../shift/closingReport';
import { atRisk, byServer, demoSosTables, missPercent, offGoal, shiftMeal, summarize, weekLabels } from '../../../domain/metrics/stepsOfService';
import { formatMetric, isScored, metricDefs } from '../../../domain/metrics/shiftMetrics';
import { assocWindows, isNoc, mealOfWindow, rangeLabel, windowMinutes } from '../associates/assocProgram';
import { menuForToday } from '../eightySix/menuToday';
import { mealAtHour } from '../../../domain/mealPeriods';
import { clampItem, freeSpot, nextTableLabel } from '../floor/planEdit';
import type { PlanItem } from '../../../store/floorLayout';

const T0 = new Date(2026, 9, 7, 18, 0, 0, 0).getTime();
const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

const diner = (extra: Partial<Diner>): Diner => ({ id: 'd', kind: 'resident', refId: 'r1', isGuest: false, seat: 1, items: [], ...extra });
const check = (diners: Diner[], extra: Partial<Order> = {}): Order => ({ id: 'c', room: 'sequoia', server: 'AA', meal: 'Dinner', openedAt: T0 - 60 * MIN, diners, ...extra });

describe('steps of service', () => {
  it('builds the same demo day every time, with a believable spread', () => {
    const a = demoSosTables(new Date(2026, 9, 6));
    expect(demoSosTables(new Date(2026, 9, 6))).toEqual(a);
    expect(a.filter((x) => x.meal === 'Dinner').length).toBeGreaterThanOrEqual(12);
    expect(a.every((x) => x.app >= 2.5 && x.ent >= 6)).toBe(true);
  });

  it('scores missed tables against the 10% goal', () => {
    const s = summarize([
      { app: 5, ent: 12, ok: true, server: 'AA', table: 'SQ 1' },
      { app: 9, ent: 12, ok: false, server: 'RJ', table: 'SQ 2' },
    ]);
    expect(s).toMatchObject({ n: 2, app: 7, ent: 12, lateApp: 1, lateEnt: 0, missed: 1 });
    expect(missPercent(1, 10)).toBe(10);
    expect(offGoal(1, 10)).toBe(false);
    expect(offGoal(2, 10)).toBe(true);
    expect(byServer([{ app: 9, ent: 12, ok: false, server: 'RJ', table: 'x' }])[0]).toMatchObject({ server: 'RJ', missed: 1 });
  });

  it('lists an open table whose starters are late, with who can fix it', () => {
    const fired = T0 - 9 * MIN;
    const o = check([diner({ items: [{ id: 'l1', itemId: 'd_cbsoup', mods: {}, note: '', sent: true, kitchenState: 'cooking', firedAt: fired, course: 1 }] })], { sentAt: fired });
    const [r] = atRisk([o]);
    expect(r).toMatchObject({ step: 'Appetizer', goal: 7 });
    expect(r.why).toEqual({ text: 'Still cooking, fired 9 min ago', who: 'Kitchen', kind: 'cook' });
  });

  it('picks the meal most open tables are on', () => {
    expect(shiftMeal([])).toBe('Dinner');
    expect(shiftMeal([check([], { meal: 'Lunch' }), check([], { meal: 'Lunch' }), check([])])).toBe('Lunch');
    expect(weekLabels()).toHaveLength(8);
  });
});

describe('closing report', () => {
  it('reads payments with amounts in the drop or on the diner', () => {
    const o = check([
      diner({ refId: 'r1', chargeDrop: 'card:34:sq_7F3K2' }),
      diner({ refId: 'r2', chargeDrop: 'apt', chargeAmt: 18 }),
      diner({ refId: 'r3', chargeDrop: 'comp:Sick:22' }),
      diner({ refId: 'r4', chargeDrop: 'plan' }),
    ]);
    const m = checkMoney(o);
    expect(m.charges.map((c) => [c.kind, c.amt])).toEqual([
      ['card', 34],
      ['apt', 18],
    ]);
    expect(m.comps).toEqual([{ who: 'Tom Beaumont', reason: 'Sick', amt: 22 }]);
    expect(shiftMoney([o])).toMatchObject({ total: 52, card: 34, apt: 18, comps: 1, compTotal: 22, checks: 1, covers: 4 });
  });

  it('summarises today’s feedback: standout, main concern and requests', () => {
    const f = feedbackSummary([
      { rid: 'r1', text: 'Loved the peach glazed chicken, so tender.' },
      { rid: 'r2', text: 'The cheeseburger soup was too salty.' },
      { rid: 'r3', text: 'The soup was salty again.' },
      { rid: 'r4', text: 'Wishes there was a lighter special.' },
    ]);
    expect(f?.liked[0]).toEqual(['Peach Glazed Chicken Breast', 1]);
    expect(f?.issues[0]).toMatchObject({ key: 'salt', n: 2, dishes: ['Cheeseburger Soup'] });
    expect(f?.head).toContain('4 comments from 4 residents today: 1 positive, 2 concerns, 1 request.');
    expect(feedbackSummary([])).toBeNull();
  });

  it('scales last week to the meal and formats minutes', () => {
    expect(ticketWeek('seat', 'Dinner')[0]).toBe(6.8);
    expect(ticketWeek('seat', 'Lunch')[0]).toBeCloseTo(5.848);
    expect(formatMinutes(null)).toBe('Not yet');
    expect(formatMinutes(6.84)).toBe('6.8 min');
    expect(formatMinutes(27.5)).toBe('28 min');
  });
});

describe('shift metrics', () => {
  it('scores table time only when Back Office says shorter is better', () => {
    expect(metricDefs(false).find((m) => m.k === 'table')?.better).toBeNull();
    expect(isScored(metricDefs(true).find((m) => m.k === 'table')!)).toBe(true);
    expect(metricDefs(false).filter(isScored)).toHaveLength(7);
    expect(formatMetric({ fmt: '%' }, 0.564)).toBe('56%');
    expect(formatMetric({ fmt: 'n' }, 46.71)).toBe('46.7');
  });
});

describe('associate meals', () => {
  it('reads windows as minutes, NOC after midnight on the same service day', () => {
    expect(windowMinutes('5:00 PM')).toBe(1020);
    expect(windowMinutes('2:00 AM')).toBe(1560);
    expect(isNoc('11:00 PM')).toBe(true);
    expect(isNoc('7:00 PM')).toBe(false);
    expect(mealOfWindow('11:30 AM')).toBe('Lunch');
    expect(rangeLabel('5:00 PM')).toBe('5:00 to 5:15 PM');
    expect(rangeLabel('11:45 AM')).toBe('11:45 AM to 12:00 PM');
  });

  it('offers the default ranges plus any booked today', () => {
    const booked: AssocMeal[] = [{ id: 'a', date: '2026-10-07', meal: 'Dinner', window: '7:30 PM', associate: 'X', item: 'Y', status: 'Planned', note: '', log: [] }];
    const w = assocWindows(booked, '2026-10-07');
    expect(w.filter((x) => x.meal === 'Lunch')[0]).toEqual({ meal: 'Lunch', w: '11:00 AM' });
    expect(w.some((x) => x.w === '7:30 PM' && x.meal === 'Dinner')).toBe(true);
    expect(w.filter((x) => x.meal === 'NOC')[0].w).toBe('11:00 PM');
  });
});

describe('86 list', () => {
  it('shows each of today’s items once and searches by name', () => {
    const all = menuForToday('Dinner', '');
    const ids = all.flatMap(([, items]) => items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(menuForToday('Dinner', 'peach').flatMap(([, i]) => i).every((i) => i.name.toLowerCase().includes('peach'))).toBe(true);
    expect([mealAtHour(8), mealAtHour(10.25), mealAtHour(10.5), mealAtHour(17)]).toEqual(['Breakfast', 'Breakfast', 'Lunch', 'Dinner']);
  });
});

describe('floor plan editing', () => {
  const t = (id: string, label: string, x: number, y: number): PlanItem => ({ id, label, section: 'Sequoia', type: 'seat', x, y, w: 10, h: 10 });

  it('names a new table after the room’s tables', () => {
    expect(nextTableLabel([t('a', 'SQ 1', 0, 0), t('b', 'SQ 16', 20, 0), t('c', 'EG 5', 40, 0)], 'XX')).toBe('SQ 17');
    expect(nextTableLabel([], 'OB')).toBe('OB 1');
  });

  it('finds a free spot and keeps items on the plan', () => {
    const spot = freeSpot([t('a', 'A', 4, 8)], 10, 10);
    expect(spot.x).toBeGreaterThanOrEqual(15);
    expect(clampItem({ ...t('a', 'A', 97.3, -4), w: 10 })).toMatchObject({ x: 90, y: 0 });
  });
});
