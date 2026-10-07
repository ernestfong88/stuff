import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../domain/config';
import { diner, line, order } from '../../../domain/__tests__/helpers';
import { assocNext, assocState, assocTickets, dishTitle, plannedToday } from '../assocTickets';
import { buildExpoTickets, expoAction, filterTickets, isLate, printCourse, ticketCourses, ticketState } from '../expoTickets';
import { runnerCopyHtml } from '../runnerCopy';

const TH = { cookLate: 10, expoPass: 5, fireLate: 5 };
const MIN = 60_000;
const at = 100 * MIN;
const l = (itemId: string, state: string, course = 2, extra = {}) =>
  line(itemId, { sent: true, kitchenState: state as never, course, firedAt: at - MIN, ...extra });

describe('expo tickets', () => {
  it('builds one ticket per check from fired plates, in promise order', () => {
    const table = order([diner([l('d_peach', 'cooking')])], { openedAt: at - 5 * MIN });
    const pu = order([diner([l('d_peach', 'cooking')])], { queueType: 'pickup', tableId: undefined, readyAt: '5:00 PM' });
    const done = order([diner([l('d_peach', 'cleared')])]);
    const t = buildExpoTickets([table, pu, done]);
    expect(t.map((x) => x.id)).toEqual([pu.id, table.id]);
    expect(t[0].lines[0].course).toBe(1);
  });

  it('offers the one next step', () => {
    const cooking = buildExpoTickets([order([diner([l('d_peach', 'cooking')])])])[0];
    expect(expoAction(cooking)).toMatchObject({ kind: 'ready', course: 2 });
    const ready = buildExpoTickets([order([diner([l('d_cbsoup', 'ready', 1), l('d_peach', 'scheduled', 2)])])])[0];
    expect(expoAction(ready)).toEqual({ kind: 'run', course: 1 });
    const last = buildExpoTickets([order([diner([l('d_peach', 'ready')])])])[0];
    expect(expoAction(last)).toEqual({ kind: 'bump' });
    const held = buildExpoTickets([order([diner([l('d_cbsoup', 'cleared', 1), l('d_trifle', 'scheduled', 3)])])])[0];
    expect(expoAction(held)).toEqual({ kind: 'fire', course: 3 });
    const pu = buildExpoTickets([order([diner([l('d_peach', 'ready')])], { queueType: 'pickup', notified: true })])[0];
    expect(expoAction(pu)).toEqual({ kind: 'handOff', notified: true });
  });

  it('marks late: too long on the fire, at the pass, or held unfired', () => {
    const fire = buildExpoTickets([order([diner([l('d_peach', 'cooking', 2, { firedAt: at - 11 * MIN })])])])[0];
    expect(isLate(fire, at, TH)).toBe(true);
    const pass = buildExpoTickets([order([diner([l('d_peach', 'ready')])], { readyStampAt: at - 6 * MIN })])[0];
    expect(ticketState(pass, at, TH)).toBe('late');
    const held = buildExpoTickets([order([diner([l('d_cbsoup', 'cleared', 1, { clearedAt: at - 2 * MIN }), l('d_trifle', 'scheduled', 3)])])])[0];
    expect(ticketState(held, at, TH)).toBe('holding');
    expect(ticketState(held, at + 4 * MIN, TH)).toBe('late');
  });

  it('files tickets under the filters', () => {
    const ready = order([diner([l('d_peach', 'ready')])]);
    const unfired = order([diner([l('d_peach', 'scheduled')])], { queueType: 'delivery', fireAtTs: at + 10 * MIN });
    const lists = filterTickets(buildExpoTickets([ready, unfired]), at);
    expect(lists.tables.map((t) => t.id)).toEqual([ready.id]);
    expect(lists.unfired.map((t) => t.id)).toEqual([unfired.id]);
    // Scheduled for later: only under Not fired.
    expect(lists.all.map((t) => t.id)).toEqual([ready.id]);
  });

  it('lists every course with its state and prints the one going out', () => {
    const t = buildExpoTickets([order([diner([l('d_cbsoup', 'cleared', 1), l('d_peach', 'cooking', 2), l('d_trifle', 'scheduled', 3)])])])[0];
    expect(ticketCourses(t).map((c) => c.state)).toEqual(['done', 'fired', 'holding']);
    expect(printCourse(t)).toBe(2);
  });

  it('prints a runner copy of the course, escaped', () => {
    const o = order([diner([l('d_peach', 'ready', 2, { note: '<no sauce>' })], { seat: 2 })]);
    const html = runnerCopyHtml({ ticket: buildExpoTickets([o])[0], course: 2, label: 'SQ 3', printedAt: at, cfg: DEFAULT_CONFIG });
    expect(html).toContain('<h1>SQ 3</h1>');
    expect(html).toContain('seat 2');
    expect(html).toContain('&lt;no sauce&gt;');
    expect(html).toContain('Course 2 · Entrees');
  });
});

describe('associate meals', () => {
  const meal = (extra = {}) => ({ id: 'a', date: '2026-10-07', meal: 'Dinner', window: '5:00 PM', associate: 'Grace Kim', item: 'PEACH CHICKEN WITH RICE', status: 'Planned', note: '', log: [], ...extra });
  it('lists today’s live meals, dropping handed-over ones', () => {
    const list = [meal(), meal({ id: 'b', status: 'Cancelled' }), meal({ id: 'c', status: 'Picked up' }), meal({ id: 'd', readyAt: 1 })];
    expect(assocTickets(list, '2026-10-07', true).map((t) => t.meal.id)).toEqual(['a', 'd']);
    expect(assocTickets(list, '2026-10-07', false).map((t) => t.meal.id)).toEqual(['a']);
    expect(plannedToday(list, '2026-10-07')).toBe(2);
  });
  it('steps from fire to ready to picked up, late after the window', () => {
    const t = { meal: meal(), at, noc: false };
    expect(assocState(t, at - MIN)).toBe('holding');
    expect(assocState(t, at + MIN)).toBe('late');
    expect(assocState({ ...t, meal: meal({ firedAt: at }) }, at + MIN)).toBe('fired');
    expect(assocNext({ readyAt: 1 })).toEqual({ kind: 'pickedUp' });
    expect(dishTitle('PEACH CHICKEN WITH RICE')).toBe('Peach Chicken with Rice');
  });
});
