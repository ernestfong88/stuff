import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../domain/config';
import { T0, diner, freezeClock, line, order } from '../../../../domain/__tests__/helpers';
import { cardActions, type CardContext } from '../cardActions';
import { stageSince, tableStage } from '../../../../domain/tableStage';

const MIN = 60_000;

beforeEach(() => freezeClock());
afterEach(() => vi.useRealTimers());

const ctx = (extra: Partial<CardContext> = {}): CardContext => ({
  stage: 'seat',
  covered: false,
  hasExpo: false,
  checkInWakeMin: 2,
  now: T0,
  ...extra,
});

describe('tableStage', () => {
  it('reads an empty check as just seated, and a drink as ordering', () => {
    expect(tableStage(order([diner([])])).key).toBe('seat');
    expect(tableStage(order([diner([line('d_coffee')])]))).toMatchObject({ key: 'order', label: 'Drinks in' });
  });

  it('is ordering until food is sent, then cooking', () => {
    const o = order([diner([line('d_peach')])]);
    expect(tableStage(o).key).toBe('order');
    const fired = order([diner([line('d_peach', { sent: true, kitchenState: 'cooking', course: 2, firedAt: T0 - 5 * MIN })])]);
    expect(tableStage(fired)).toMatchObject({ key: 'cook', label: 'Cooking · C2', since: T0 - 5 * MIN });
  });

  it('is ready to run when the lowest course is all up at the pass', () => {
    const o = order([
      diner([
        line('d_cbsoup', { sent: true, kitchenState: 'ready', course: 1 }),
        line('d_peach', { sent: true, kitchenState: 'scheduled', course: 2 }),
      ]),
    ]);
    expect(tableStage(o)).toMatchObject({ key: 'run', label: 'Ready at Expo · C1' });
  });

  it('asks for a check-in after the entrée, then dessert, then is ready to close', () => {
    const ran = T0 - 4 * MIN;
    const served = [line('d_peach', { sent: true, kitchenState: 'cleared', course: 2, firedAt: T0 - 20 * MIN, clearedAt: ran })];
    const o = order([diner(served)], { openedAt: T0 - 30 * MIN });
    expect(tableStage(o)).toMatchObject({ key: 'eat', label: 'Eating · C2', since: ran });
    const checked = { ...o, checkIns: [{ course: 2, at: T0, by: 'AA' }] };
    expect(tableStage(checked).label).toBe('Dessert?');
    expect(tableStage({ ...checked, noDessert: true }).key).toBe('check');
    expect(tableStage(o, { ...DEFAULT_CONFIG, flow: { checkIn: false } }).key).toBe('check');
  });

  it('remembers when a ready course without a stamp was first seen', () => {
    const o = order([diner([line('d_cbsoup', { sent: true, kitchenState: 'ready', course: 1 })])]);
    const first = stageSince(o, tableStage(o, DEFAULT_CONFIG, T0));
    expect(stageSince(o, tableStage(o, DEFAULT_CONFIG, T0 + 3 * MIN))).toBe(first);
  });
});

describe('cardActions', () => {
  it('offers to take the order on a just seated table', () => {
    expect(cardActions(order([diner([])]), ctx()).map((a) => a.kind)).toEqual(['takeOrder']);
  });

  it('lets the server mark a course they made served (nothing from the cook)', () => {
    const o = order([diner([line('d_cbsoup', { sent: true, kitchenState: 'ready', course: 1 })])]);
    expect(cardActions(o, ctx({ stage: 'run' }))).toEqual([
      { kind: 'grab', course: 1 },
      { kind: 'markServed', course: 1 },
    ]);
  });

  it('with printers, offers only closing once the order is in, never runs or fires', () => {
    const o = order([diner([line('d_peach', { sent: true, kitchenState: 'ready', course: 2 })])]);
    const cfg = { ...DEFAULT_CONFIG, kitchenMode: 'printers' as const };
    expect(cardActions(o, ctx({ stage: tableStage(o, cfg).key, cfg })).map((a) => a.kind)).toEqual(['trivia', 'confirmPayment']);
  });

  it('sends the server to the pass when Expo runs a cooked course', () => {
    const o = order([diner([line('d_peach', { sent: true, kitchenState: 'ready', course: 2 })])]);
    expect(cardActions(o, ctx({ stage: 'run', hasExpo: true })).map((a) => a.kind)).toEqual(['readyAtPass']);
    expect(cardActions(o, ctx({ stage: 'run', hasExpo: false }))).toEqual([{ kind: 'run', course: 2 }]);
  });

  it('wakes Check in after the wait and offers to fire the held dessert', () => {
    const ran = T0 - MIN;
    const o = order([
      diner([
        line('d_peach', { sent: true, kitchenState: 'cleared', course: 2, clearedAt: ran }),
        line('d_trifle', { sent: true, kitchenState: 'scheduled', course: 3 }),
      ]),
    ]);
    const acts = cardActions(o, ctx({ stage: 'eat', now: T0 }));
    expect(acts[0]).toEqual({ kind: 'checkIn', course: 2, awake: false });
    expect(acts[1]).toMatchObject({ kind: 'fire', course: 3, label: 'Fire C3' });
    expect(cardActions(o, ctx({ stage: 'eat', now: T0 + 2 * MIN }))[0]).toMatchObject({ awake: true });
    const checked = { ...o, checkIns: [{ course: 2, at: T0, by: 'AA' }] };
    expect(cardActions(checked, ctx({ stage: 'eat' }))).toEqual([{ kind: 'fire', course: 3, fireAs: [3], label: 'Fire dessert' }]);
  });

  it('closes with one tap when everyone is on plan', () => {
    const o = order([diner([line('d_peach', { sent: true, kitchenState: 'cleared', course: 2 })])], { noDessert: true });
    expect(cardActions(o, ctx({ stage: 'check', covered: true })).map((a) => a.kind)).toEqual(['trivia', 'quickClose']);
    expect(cardActions(o, ctx({ stage: 'check', covered: false })).map((a) => a.kind)).toEqual(['trivia', 'confirmPayment']);
  });

  it('puts drinks to get first, and shows drinks at the bar only when there is room', () => {
    const poured = order([diner([line('d_coffee', { sent: true, drink: true, kitchenState: 'pour' })])]);
    expect(cardActions(poured, ctx({ stage: 'order' }))[0]).toEqual({ kind: 'drinks', pour: true, upCount: 0 });
    const atBar = order([diner([line('d_beer805', { sent: true, drink: true, kitchenState: 'bar' })])]);
    expect(cardActions(atBar, ctx({ stage: 'order' })).map((a) => a.kind)).toEqual(['finishOrder', 'atBar']);
  });
});
