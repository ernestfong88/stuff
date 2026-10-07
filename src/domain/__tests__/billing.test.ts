import { describe, expect, it } from 'vitest';
import { seedHistory, seedOrders } from '../../data';
import { DEFAULT_CONFIG } from '../config';
import { alaCarteTotal, corkageAmount, dinerBilling, linePrice, queueFee } from '../billing';
import { upcharge, upchargeLines } from '../menu';
import { diner, line, order, prototype } from './helpers';

describe('dinerBilling (dd)', () => {
  it('matches the prototype for every seeded open and closed check', () => {
    for (const o of [...seedOrders(), ...seedHistory()]) {
      const expected = (prototype.billing as Record<string, Record<string, unknown>>)[o.id];
      if (!expected) continue;
      for (const d of o.diners) expect(dinerBilling(d, o), `${o.id}/${d.id}`).toEqual(expected[d.id]);
    }
  });

  it('a resident on a plan with meals left is covered', () => {
    const d = diner([line('d_peach')], { refId: 'r1' });
    expect(dinerBilling(d, order([d]))).toEqual({
      planLabel: '30 meals / month',
      planType: 'Monthly',
      remainText: '12 of 30 meals left · this meal uses 1 → 11 left after',
      itemsTotal: 0,
      delivery: 0,
      outOfPlan: 0,
      needsDrop: false,
      covered: true,
    });
  });

  it('a guest pays the guest price à la carte', () => {
    const d = diner([line('d_peach'), line('d_trifle')], { refId: 'r1', isGuest: true, guestName: 'Amy' });
    expect(dinerBilling(d, order([d]))).toMatchObject({
      planLabel: 'Guest',
      planType: 'A la carte',
      itemsTotal: 22,
      outOfPlan: 22,
      needsDrop: true,
      covered: false,
    });
  });

  it('a resident with no plan pays à la carte at resident prices', () => {
    const d = diner([line('d_beer805')], { refId: 'r5' });
    expect(dinerBilling(d, order([d]))).toMatchObject({
      planLabel: 'No plan — à la carte',
      remainText: 'No plan — à la carte',
      itemsTotal: 2,
      outOfPlan: 2,
      covered: false,
    });
  });

  it('an associate pays à la carte', () => {
    const d = diner([line('d_peach')], { kind: 'associate', refId: 'a1' });
    expect(dinerBilling(d, order([d]))).toMatchObject({ planLabel: 'Associate', outOfPlan: 16, needsDrop: true });
  });

  it('a resident on hospice is comped with no meal credit used', () => {
    const d = diner([line('d_peach')], { refId: 'r7' });
    expect(dinerBilling(d, order([d]))).toMatchObject({ planType: 'Comp', comped: true, covered: true, outOfPlan: 0 });
    expect(dinerBilling(d, order([d]), { ...DEFAULT_CONFIG, flow: { hospiceAuto: false } }).planType).toBe('Monthly');
  });

  it('puts the delivery fee and corkage on seat 1 only', () => {
    const seat1 = diner([line('d_peach')], { refId: 'r1', seat: 1 });
    const seat2 = diner([line('d_peach')], { refId: 'r1', seat: 2 });
    const o = order([seat1, seat2], { tableId: undefined, queueType: 'delivery', room: 'sequoia', corkage: 2 });
    expect(dinerBilling(seat1, o)).toMatchObject({ delivery: 3 + 20, outOfPlan: 23, needsDrop: true, covered: true });
    expect(dinerBilling(seat2, o).delivery).toBe(0);
    expect(dinerBilling(seat1, { ...o, feeComped: true, comp: { reason: 'x' } }).delivery).toBe(0);
  });
});

describe('fees', () => {
  it('queueFee matches the prototype for every seeded order', () => {
    const got = Object.fromEntries(seedOrders().map((o) => [o.id, queueFee(o)]));
    expect(got).toEqual(prototype.queueFee);
  });

  it('pick up fee by venue; no fee dine-in', () => {
    expect(queueFee(order([], { queueType: 'pickup', room: 'bistro' }))).toEqual({ kind: 'Pick up fee', amt: 2 });
    expect(queueFee(order([]))).toEqual({ kind: null, amt: 0 });
  });

  it('corkage is per bottle and can be switched off per venue', () => {
    const o = order([], { corkage: 3 });
    expect(corkageAmount(o)).toBe(30);
    expect(corkageAmount(o, { ...DEFAULT_CONFIG, corkage: { sequoia: { on: false } } })).toBe(0);
    expect(corkageAmount(o, { ...DEFAULT_CONFIG, corkage: { sequoia: { amt: 15 } } })).toBe(45);
  });
});

describe('prices', () => {
  it('linePrice by diner kind, and à la carte', () => {
    const l = line('d_peach');
    expect(linePrice(l, { kind: 'resident', isGuest: false })).toBe(0);
    expect(linePrice(l, { kind: 'resident', isGuest: true })).toBe(16);
    expect(linePrice(l, { kind: 'resident', isGuest: false }, 'ala')).toBe(18);
  });

  it('alaCarteTotal skips comped lines', () => {
    expect(alaCarteTotal(diner([line('d_peach'), line('d_trifle', { comped: true })]))).toBe(18);
  });

  it('modifier upcharges: priced options and picks past the included ones', () => {
    expect(upcharge(line('d_toast', { mods: { Bread: 'Gluten-Free Bread' } }))).toBe(1.5);
    // Three toppings are included, then $1 each; "No" picks don't count and prefixes are stripped.
    const pizza = line('d_pizza', {
      mods: { Toppings: ['Pepperoni', 'Xtra Mushrooms', 'Onions', 'Pineapple', 'No Spinach'] },
    });
    expect(upchargeLines(pizza)).toEqual([{ text: '1 extra topping', amt: 1 }]);
    expect(upcharge(line('d_peach'))).toBe(0);
  });
});
