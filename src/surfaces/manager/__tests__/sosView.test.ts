import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Diner, Order } from '../../../domain/types';
import { atRisk, summarize } from '../../../domain/metrics/stepsOfService';
import { demoRow, isLate, nextStep, serverRows, sortRows, stepSummary, timedRow, worstStep, type TimedRow } from '../metrics/sosView';
import { tableTimeOf } from '../metrics/tableTime';

const T0 = new Date(2026, 9, 7, 18, 0, 0, 0).getTime();
const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

const row = (x: Partial<TimedRow>): TimedRow => ({
  app: null,
  ent: null,
  ok: true,
  server: 'AA',
  table: 'SQ 1',
  greet: null,
  greetGoal: null,
  seat: null,
  close: null,
  ...x,
});
const diner = (extra: Partial<Diner>): Diner => ({ id: 'd', kind: 'resident', refId: 'r1', isGuest: false, seat: 1, items: [], ...extra });
const check = (diners: Diner[], extra: Partial<Order> = {}): Order => ({ id: 'c', room: 'sequoia', server: 'AA', meal: 'Dinner', openedAt: T0 - 60 * MIN, diners, ...extra });

describe('Metrics: steps of service', () => {
  const rows = [
    row({ table: 'SQ 1', server: 'AA', app: 5, ent: 12, greet: 3, greetGoal: 5, seat: 4, close: 20 }),
    row({ table: 'SQ 2', server: 'AA', app: 9, ent: 13, ok: false, greet: 6, greetGoal: 5, seat: 6, close: 30 }),
    row({ table: 'EG 3', server: 'RJ', app: 6, ent: 18, ok: false, greet: 4, greetGoal: 5, seat: 5 }),
  ];

  it('averages each step in order, matching the table time headline', () => {
    const st = stepSummary(rows);
    expect(st.map((x) => x.key)).toEqual(['greet', 'order', 'app', 'ent', 'close']);
    const by = Object.fromEntries(st.map((x) => [x.key, x]));
    expect(by.app.avg! + by.ent.avg!).toBeCloseTo(tableTimeOf(summarize(rows))!);
    expect(by.greet).toMatchObject({ avg: 13 / 3, goal: 5, late: 1, n: 3, tone: 'good' });
    expect(by.order).toMatchObject({ avg: 5, goal: null, tone: 'plain', start: 0 });
    expect(by.app).toMatchObject({ late: 1, start: 5, tone: 'warn' });
    expect(by.ent).toMatchObject({ late: 1, start: 5 + 20 / 3, tone: 'warn', slowest: true });
    expect(by.close).toMatchObject({ avg: 25, n: 2 });
    expect(st.filter((x) => x.slowest)).toHaveLength(1);
  });

  it('marks no slowest step when every step is green, and says when a step has no times', () => {
    const st = stepSummary([row({ app: 4, ent: 10 })]);
    expect(st.some((x) => x.slowest)).toBe(false);
    expect(st.find((x) => x.key === 'greet')).toMatchObject({ avg: null, tone: 'none', goal: null });
    expect(stepSummary([demoRow({ app: 4, ent: 10, ok: true, server: 'AA', table: 'x' })])[2].avg).toBe(4);
  });

  it('finds how far past its goal a table went, and on which step', () => {
    expect(worstStep(rows[1])).toMatchObject({ key: 'app', mins: 9, goal: 7, over: 2 });
    expect(worstStep(rows[2])).toMatchObject({ key: 'ent', over: 3 });
    expect(worstStep(rows[0])).toBeNull();
    expect(isLate(rows[1], 'greet')).toBe(true);
    expect(isLate(rows[0], 'order')).toBe(false);
    expect(sortRows(rows).map((r) => r.table)).toEqual(['EG 3', 'SQ 2', 'SQ 1']);
  });

  it('gives one row per server, the biggest share of late tables first', () => {
    const sv = serverRows(rows);
    expect(sv.map((r) => r.server)).toEqual(['RJ', 'AA']);
    expect(sv[0]).toMatchObject({ n: 1, onTime: 0, avg: 24, slowest: { key: 'ent', avg: 18, goal: 15 }, worst: { table: 'EG 3', key: 'ent', mins: 18 } });
    expect(sv[1]).toMatchObject({ n: 2, onTime: 1, avg: 7 + 12.5, worst: { table: 'SQ 2', key: 'app' } });
  });

  it('says what to do next: an open table past its goal first, then a server, else keep the pace', () => {
    const fired = T0 - 9 * MIN;
    const o = check([diner({ items: [{ id: 'l1', itemId: 'd_cbsoup', mods: {}, note: '', sent: true, kitchenState: 'cooking', firedAt: fired, course: 1 }] })], { sentAt: fired });
    const name = () => 'SQ 4';
    const live = nextStep(atRisk([o]), serverRows(rows), 20, name);
    expect(live).toMatchObject({ tone: 'bad', act: 'Ask the kitchen to push SQ 4’s appetizer.', order: o, also: [] });
    expect(live.why).toContain('past the 7 min goal');

    const coach = nextStep([], serverRows(rows), 20, name);
    expect(coach.tone).toBe('warn');
    expect(coach.act).toMatch(/^Talk to .+ about entrée pacing\.$/);
    expect(coach.why).toMatch(/^All 1 of .+’s tables was late; entrée averages 18\.0 min against 15\.$/);

    expect(nextStep([], serverRows([rows[0]]), 17, name)).toMatchObject({ tone: 'good', act: 'Nothing to fix. Keep the pace.' });
  });

  it('times a live check from the order, and is null until it is sent', () => {
    expect(timedRow(check([]), 'SQ 1')).toBeNull();
    const fired = T0 - 9 * MIN;
    const o = check([diner({ items: [{ id: 'l1', itemId: 'd_cbsoup', mods: {}, note: '', sent: true, kitchenState: 'cooking', firedAt: fired, course: 1 }] })], { sentAt: fired });
    const r = timedRow(o, 'SQ 1')!;
    expect(r).toMatchObject({ table: 'SQ 1', server: 'AA', app: null, running: { key: 'app', goal: 7 } });
    expect(r.running!.elapsed).toBeCloseTo(9);
    expect(r.order).toBe(o);
  });
});
