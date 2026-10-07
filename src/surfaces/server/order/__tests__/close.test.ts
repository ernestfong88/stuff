import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diner, freezeClock, line, order } from '../../../../domain/__tests__/helpers';
import { isExtraSide, sendLabel, sentMessage, sortWithSides } from '../checkLines';
import {
  chargeDrop,
  closeButtonLabel,
  closeCharge,
  closeView,
  creditUse,
  defaultDrop,
  defaultPlanMode,
  type CloseInputs,
  type CloseRow,
} from '../close/closeMath';
import { labelMinutes, loadTag, rangeLabel, windowLoad, windowsFor } from '../queue/pickupWindows';
import { DEFAULT_CONFIG, DEFAULT_MEAL_CREDIT, mealCreditRules } from '../../../../domain/config';
import { dinerPerson } from '../../../../domain/orders';
import type { Diner, Order, Resident } from '../../../../domain/types';

beforeEach(() => freezeClock());
afterEach(() => vi.useRealTimers());

const inputs = (o: Order, extra: Partial<CloseInputs> = {}): CloseInputs => ({
  order: o,
  mode: {},
  drop: {},
  overflowChoice: {},
  guestOnHost: {},
  guestCreditOn: false,
  feeComped: false,
  ...extra,
});
const row = (d: Diner, x: CloseInputs): CloseRow => ({
  diner: d,
  person: dinerPerson(d) as Resident | undefined,
  charge: closeCharge(d, x),
});

describe('check lines', () => {
  it('tucks sides under their entrée and sorts by course', () => {
    const entree = line('d_peach');
    const side = line('d_mashed', { parentId: entree.id });
    const soup = line('d_cbsoup');
    expect(sortWithSides([entree, side, soup]).map((l) => l.id)).toEqual([soup.id, entree.id, side.id]);
  });

  it('charges a resident’s third side à la carte', () => {
    // The garlic knot is bread, which never counts on the credit.
    const sides = [line('d_mashed'), line('d_knot'), line('d_greenbeans'), line('d_applesauce')];
    const d = diner(sides);
    expect(sides.map((l) => isExtraSide(d, l))).toEqual([false, false, false, true]);
    expect(isExtraSide({ ...d, isGuest: true }, sides[3])).toBe(false);
  });

  it('says what Send will do', () => {
    const o = order([diner([])]);
    expect(sendLabel(o, [line('d_coffee')], 0)).toBe('Send drinks · 1 for you to get');
    expect(sendLabel(o, [line('d_coffee'), line('d_peach')], 1)).toBe('Send · drinks now, C2 fires now (1 held)');
    expect(sendLabel(o, [line('d_cbsoup')], 0)).toBe('Send to kitchen · C1 fires now');
    const sent = order([diner([line('d_coffee', { sent: true, drink: true, kitchenState: 'pour', firedAt: 1 })])]);
    expect(sentMessage(sent)).toBe('Drinks rung in · 1 drink is yours to get');
  });
});

describe('close math', () => {
  it('covers a resident on a monthly plan and counts one credit', () => {
    const d = diner([line('d_cbsoup'), line('d_peach'), line('d_mashed')], { refId: 'r1' });
    const o = order([d]);
    const x = inputs(o);
    const r = row(d, x);
    expect(r.charge).toMatchObject({ outOfPlan: 0, covered: true });
    expect(creditUse(d, {})).toMatchObject({ credits: 1, ala: 0 });
    const v = closeView(r, o, { mode: defaultPlanMode(d), noCharge: null, how: 'apt', tablePay: 'each' });
    expect(v).toMatchObject({ k: 'plan', title: 'Covered by meal plan', sub: 'This meal uses 1 meal · 11 meals left after this one' });
    expect(chargeDrop(r, 'apt', 'x', () => 'sq_1')).toBe('plan');
  });

  it('uses another credit for a second entrée unless it is moved to à la carte', () => {
    const d = diner([line('d_peach'), line('d_shells')], { refId: 'r1' });
    const second = d.items[1];
    expect(creditUse(d, {})).toMatchObject({ credits: 2, ala: 0 });
    expect(creditUse(d, { [second.id]: 'ala' })).toMatchObject({ credits: 1, ala: 1 });
    const o = order([d]);
    const r = row(d, inputs(o, { overflowChoice: { [second.id]: 'ala' } }));
    expect(r.charge.outOfPlan).toBe(16);
  });

  it('follows the meal credit rules set in HO Settings', () => {
    const d = diner([line('d_peach'), line('d_shells'), line('d_mashed'), line('d_greenbeans'), line('d_bakedpot')], { refId: 'r1' });
    const third = d.items[4];
    // Standard: a second entrée uses another credit, a third side is à la carte.
    expect(creditUse(d, {})).toMatchObject({ credits: 2, ala: 1 });
    // Two entrées and three sides per credit, extras start à la carte.
    const roomy = { ...DEFAULT_CONFIG, mealCredit: { ...DEFAULT_MEAL_CREDIT, entrees: 2, sides: 3, overflow: 'ala' as const } };
    expect(creditUse(d, {}, roomy)).toMatchObject({ credits: 1, ala: 0 });
    expect(isExtraSide(d, third, mealCreditRules(roomy))).toBe(false);
    // Extra sides allowed on another credit, and extras start à la carte.
    const lean = { ...DEFAULT_CONFIG, mealCredit: { ...DEFAULT_MEAL_CREDIT, extraSidesAla: false, overflow: 'ala' as const } };
    expect(creditUse(d, {}, lean)).toMatchObject({ credits: 1, ala: 2 });
    expect(creditUse(d, { [third.id]: 'credit' }, lean)).toMatchObject({ credits: 2, ala: 1 });
  });

  it('charges a guest à la carte to the host’s account', () => {
    const guest = diner([line('d_peach')], { refId: 'r1', isGuest: true, guestName: 'Joe Martin', seat: 2 });
    const o = order([diner([], { refId: 'r1' }), guest]);
    const r = row(guest, inputs(o));
    expect(r.charge.outOfPlan).toBe(16);
    const v = closeView(r, o, { mode: 'count', noCharge: null, how: 'apt', tablePay: 'each' });
    expect(v).toMatchObject({ k: 'charge', title: "Charged to Marty's resident account", sub: 'Guest pays à la carte' });
    expect(chargeDrop(r, 'card', 'x', () => 'sq_AB')).toBe('card:16:sq_AB');
    expect(closeButtonLabel([v], 16, 1, 2)).toBe('Charge $16.00 & close 1 of 2');
  });

  it('treats an associate as an associate meal with no charge, and a manager comp as comped', () => {
    const assoc = diner([line('d_peach')], { kind: 'associate', refId: 'a1' });
    const o = order([assoc]);
    expect(defaultDrop(assoc, o)).toBe('assoc');
    expect(row(assoc, inputs(o)).charge.comped).toBe(true);
    const d = diner([line('d_peach')], { refId: 'r5' });
    const comped = row(d, inputs(order([d]), { mode: { [d.id]: 'comp' } }));
    expect(comped.charge).toMatchObject({ comped: true, outOfPlan: 0 });
    expect(closeView(comped, order([d]), { mode: 'comp', noCharge: null, how: 'apt', tablePay: 'each', why: 'Sick' })).toMatchObject({
      title: 'Comped by the house, no charge',
      sub: 'Sick · manager approved',
    });
    expect(chargeDrop(comped, 'apt', 'Sick', () => '')).toBe('comp:Sick:18');
  });
});

describe('pick up windows', () => {
  it('labels 15 minute ranges', () => {
    expect(rangeLabel('5:00 PM')).toBe('5:00 to 5:15 PM');
    expect(rangeLabel('11:45 AM')).toBe('11:45 AM to 12:00 PM');
    expect(labelMinutes('5:15 PM')).toBe(1035);
  });

  it('offers dinner ranges and counts a venue’s capacity', () => {
    expect(windowsFor('pickup', 'sequoia', 'Dinner')[0]).toEqual({ s: 990, at: '4:30 PM' });
    const booked = (id: string) => order([diner([line('d_peach')])], { id, queueType: 'pickup', readyAt: '5:00 PM', tableId: undefined });
    const data = { orders: [booked('a'), booked('b'), booked('c')], history: [], assoc: [] };
    const date = windowLoad('pickup', 'sequoia', 1020, '2026-10-07', 'x', data);
    expect(date).toEqual({ left: 1, full: false });
    expect(loadTag(date)).toBe('1 left');
    expect(windowLoad('pickup', 'sequoia', 1020, '2026-10-07', 'x', { ...data, orders: [...data.orders, booked('d')] }).full).toBe(true);
  });
});
