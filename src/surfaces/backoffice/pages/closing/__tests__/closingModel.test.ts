import { describe, expect, it } from 'vitest';
import { diner, order } from '../../../../../domain/__tests__/helpers';
import type { ResidentNote } from '../../../../../domain/types';
import {
  closedOn,
  dayBounds,
  defaultMeal,
  deltaText,
  exportText,
  mealCounts,
  reportHtml,
  shiftReport,
  signOffLine,
  type ShiftInput,
} from '../closingModel';

const DAY0 = new Date(2026, 9, 7).getTime();
const at = (h: number, m = 0, dayOff = 0) => new Date(2026, 9, 7 + dayOff, h, m).getTime();

const dinner1 = order([diner([], { chargeDrop: 'card:30' }), diner([], { chargeDrop: 'comp:Sick:22' })], {
  id: 'c1',
  server: 'AA',
  meal: 'Dinner',
  openedAt: at(17, 30),
  closedAt: at(18, 40),
});
const dinner2 = order([diner([], { chargeDrop: 'apt:12' })], { id: 'c2', server: 'RJ', meal: 'Dinner', openedAt: at(18), closedAt: at(19) });
const pickup = order([diner([], { chargeDrop: 'apt:9' })], {
  id: 'c3',
  server: 'RJ',
  meal: 'Dinner',
  queueType: 'pickup',
  openedAt: at(17),
  closedAt: at(17, 30),
});
const lunch = order([diner([])], { id: 'c4', server: 'AA', meal: 'Lunch', openedAt: at(12), closedAt: at(12, 40) });
const yesterday = order([diner([])], { id: 'c5', server: 'AA', meal: 'Dinner', openedAt: at(18, 0, -1), closedAt: at(19, 0, -1) });
const nobody = order([], { id: 'c6', server: 'AA', meal: 'Dinner', openedAt: at(18), closedAt: at(18, 5) });
const history = [dinner1, dinner2, pickup, lunch, yesterday, nobody];

const note = (text: string, t: number): ResidentNote => ({ id: text, kind: 'fb', rid: 'r1', text, at: t });

const input = (extra: Partial<ShiftInput> = {}): ShiftInput => ({
  history,
  live: [],
  notes: [note('Loved the salmon burger', at(18, 30)), note('Soup was cold', at(12, 30)), note('Too salty', at(18, 0, -1))],
  start: DAY0,
  meal: 'Dinner',
  day: '2026-10-07',
  serverSignOffs: { 'AA|2026-10-07': at(20, 15), 'RJ|2026-10-06': at(20) },
  tableName: (o) => `T-${o.id}`,
  dayWord: 'on Wednesday',
  ...extra,
});

describe('closing report days', () => {
  it('bounds a day at local midnight', () => {
    const b = dayBounds(at(15));
    expect(b.start).toBe(DAY0);
    expect(b.end).toBe(new Date(2026, 9, 8).getTime());
  });

  it('keeps only checks closed that day with someone at them', () => {
    expect(closedOn(history, DAY0).map((o) => o.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  it('counts closed checks by meal and opens on the right meal', () => {
    const counts = mealCounts(history, DAY0);
    expect(counts).toEqual({ Breakfast: 0, Lunch: 1, Dinner: 3 });
    expect(defaultMeal(counts, null)).toBe('Dinner');
    expect(defaultMeal({ Breakfast: 2, Lunch: 0, Dinner: 0 }, null)).toBe('Breakfast');
    expect(defaultMeal(counts, 'Lunch')).toBe('Lunch');
    expect(defaultMeal({ Breakfast: 0, Lunch: 0, Dinner: 0 }, null)).toBe('Dinner');
  });
});

describe('shiftReport', () => {
  it('adds up the meal with the manager report math', () => {
    const r = shiftReport(input());
    expect(r.closed.map((o) => o.id)).toEqual(['c3', 'c1', 'c2']);
    expect(r.money).toEqual({ total: 51, card: 30, apt: 21, comps: 1, compTotal: 22, checks: 3, covers: 4 });
    expect(r.tickets.map((t) => t.key)).toEqual(['seat', 'main', 'close']);
    expect(r.tickets[0].week).toHaveLength(7);
  });

  it('lists servers with their totals and sign-offs, pick up apart', () => {
    const r = shiftReport(input());
    expect(r.servers.map((x) => [x.id, x.checks, x.covers, x.charges, x.comps, x.compTotal, x.signedAt])).toEqual([
      ['AA', 1, 2, 30, 1, 22, at(20, 15)],
      ['RJ', 1, 1, 12, 0, 0, undefined],
    ]);
    expect(r.queue).toMatchObject({ id: '', checks: 1, charges: 9 });
  });

  it('lists each comp with its table and server', () => {
    expect(shiftReport(input()).comps).toEqual([
      { key: 'c1:0', table: 'T-c1', server: expect.any(String), who: expect.any(String), reason: 'Sick', amt: 22, at: at(18, 40) },
    ]);
  });

  it("counts that day's feedback only, named for the day", () => {
    const r = shiftReport(input());
    expect(r.fbCount).toBe(2);
    expect(r.feedback?.head).toContain('on Wednesday:');
  });

  it('shows tables still open on the floor today', () => {
    const live = order([diner([])], { id: 'o1', server: 'MG', meal: 'Dinner', openedAt: at(19) });
    const r = shiftReport(input({ live: [live] }));
    expect(r.open.map((o) => o.id)).toEqual(['o1']);
    expect(r.servers.find((x) => x.id === 'MG')).toMatchObject({ checks: 0, open: 1 });
  });

  it('is empty for a meal with no checks', () => {
    const r = shiftReport(input({ meal: 'Breakfast' }));
    expect(r.closed).toEqual([]);
    expect(r.servers).toEqual([]);
    expect(r.queue).toBeNull();
    expect(r.money.checks).toBe(0);
    expect(r.tickets.every((t) => t.value == null && t.delta == null)).toBe(true);
  });
});

describe('closing report text', () => {
  it('says who signed off and when', () => {
    expect(signOffLine(null)).toBe('Not signed off yet');
    expect(signOffLine({ by: 'Dana Ruiz', at: at(20, 42) })).toMatch(/^Signed off by Dana Ruiz at 8:42\sPM$/);
  });

  it('words the change against the last meal', () => {
    expect(deltaText(null)).toBe('No checks yet');
    expect(deltaText(-1.25)).toBe('1.3 min faster');
    expect(deltaText(2)).toBe('2.0 min slower');
  });

  it('exports in the manager format with servers and comps', () => {
    const txt = exportText(shiftReport(input()), DAY0, null);
    expect(txt.split('\n')[0]).toBe('Closing report, Wednesday, Oct 7, Dinner');
    expect(txt).toContain('Total charges completed: $51 (card $30, apartment $21)');
    expect(txt).toContain('Comps: 1 ($22)');
    expect(txt).toContain('Checks closed: 3 (4 covers)');
    expect(txt).toContain('not signed off');
    expect(txt).toContain('Sick · $22');
    expect(txt.trim().endsWith('Not signed off yet')).toBe(true);
  });

  it('prints escaped html', () => {
    const html = reportHtml(shiftReport(input({ tableName: () => '<b>' })), DAY0, null, 'Valencia Terrace');
    expect(html).toContain('Closing report');
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<td><b></td>');
  });
});
