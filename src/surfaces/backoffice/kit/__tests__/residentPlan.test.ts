import { describe, expect, it } from 'vitest';
import { mealPlans, residents } from '../../../../data';
import { diner, line, order } from '../../../../domain/__tests__/helpers';
import { dinerBilling } from '../../../../domain/billing';
import { seedPlans, type BoMealPlan } from '../../seed/billing';
import { seedBoResidents, type BoResident } from '../../seed/residents';
import { residentPlan, residentRecordsStore, tabletPlan, updateResidentRecord } from '../../../../store/residentRecords';

const plans = seedPlans();
const rec = (planId: string, changed = true): BoResident[] => [
  {
    id: 'r1',
    name: 'Marty',
    apt: '1',
    level: 'IL',
    planId,
    startDay: 1,
    coupleStartDay: null,
    spouseId: null,
    prefs: '',
    kitchenNotes: '',
    diet: [],
    allergies: [],
    planLog: changed ? [{ at: 1, by: 'EF', from: 'a', to: 'b' }] : undefined,
  },
];

describe('residentPlan', () => {
  it('maps Back Office plans to what the tablets count', () => {
    expect(tabletPlan(plans.find((p) => p.id === 'pl1')!)).toBe(mealPlans.monthly30);
    expect(tabletPlan({ id: 'x', text: 'AL 3x', amt: 3, type: 'Daily' })).toMatchObject({ type: 'Daily', amt: 3, label: '3 meals / day' });
    expect(tabletPlan({ id: 'pl3', text: 'IL Spenddown', amt: 400, type: 'Monthly $' })).toMatchObject({ type: 'A la carte', amt: 0 });
    expect(tabletPlan({ id: 'pl4', text: 'À la carte (no plan)', amt: 0, type: 'Monthly' } as BoMealPlan)).toBe(mealPlans.alacarte);
  });

  it('always uses the Back Office plan; the dining record only when there is no Back Office plan', () => {
    expect(residentPlan('r1', rec('pl3', false), plans)).toMatchObject({ type: 'A la carte' });
    expect(residentPlan('r1', rec('pl3'), plans)).toMatchObject({ type: 'A la carte' });
    expect(residentPlan('r1', rec('gone', false), plans)).toBe(mealPlans.monthly30);
    expect(residentPlan('r1', rec('pl2'), [...plans.filter((p) => p.id !== 'pl2'), { ...plans.find((p) => p.id === 'pl2')!, amt: 4 }])).toMatchObject(
      { amt: 4 },
    );
    expect(residentPlan('nobody', [], plans)).toBe(mealPlans.alacarte);
  });

  it('ships every resident on the same plan in Back Office and on the tablets', () => {
    for (const r of residents) expect(residentPlan(r.id, seedBoResidents(), plans), r.name).toBe(mealPlans[r.plan]);
  });

  it('reaches close & charge: a plan changed to a spend-down is no longer covered by meal credits', () => {
    const d = diner([line('d_peach')], { refId: 'r1' });
    expect(dinerBilling(d, order([d])).covered).toBe(true);
    const before = residentRecordsStore.get();
    updateResidentRecord('r1', { planId: 'pl3', planLog: [{ at: 1, by: 'EF', from: 'IL Resident Meal Plan', to: 'IL Spenddown' }] });
    try {
      expect(dinerBilling(d, order([d]))).toMatchObject({
        covered: false,
        planType: 'A la carte',
        planLabel: 'IL Spenddown · $400 spend-down',
        remainText: 'Spend-down plan — à la carte',
      });
    } finally {
      residentRecordsStore.set(before);
    }
  });
});
