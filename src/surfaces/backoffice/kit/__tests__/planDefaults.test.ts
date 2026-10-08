import { describe, expect, it } from 'vitest';
import { mealPlans, residents } from '../../../../data';
import type { Resident } from '../../../../domain/types';
import { seedDefaultPlans, seedPlans, type BoMealPlan } from '../../seed/billing';
import { fromDining, seedBoResidents } from '../../seed/residents';
import { careLevelsOf, defaultPlanFor, migrateDefaultPlans } from '../../../../store/planDefaults';
import { residentPlan } from '../../../../store/residentRecords';

const plans = seedPlans();

describe('default plan by care level', () => {
  it('lists care levels in the usual order', () => {
    expect(careLevelsOf(['AL', 'IL', 'AL', undefined, 'SNF', 'MC', 'Respite'])).toEqual(['IL', 'AL', 'MC', 'SNF', 'Respite']);
    expect(careLevelsOf(residents.map((r) => r.level))).toEqual(['IL', 'AL']);
  });

  it('ships IL on the 30 meal plan and AL on 2 meals a day', () => {
    expect(defaultPlanFor('IL', seedDefaultPlans(), plans)?.text).toBe('IL Resident Meal Plan');
    expect(defaultPlanFor('AL', seedDefaultPlans(), plans)?.text).toBe('AL 2x Meals a Day');
    expect(defaultPlanFor('MC', seedDefaultPlans(), plans)).toBeUndefined();
    expect(defaultPlanFor(undefined, seedDefaultPlans(), plans)).toBeUndefined();
  });

  it('has no default once its plan is retired', () => {
    const retired = plans.map((p) => (p.id === 'pl8' ? { ...p, active: false } : p));
    expect(defaultPlanFor('AL', seedDefaultPlans(), retired)).toBeUndefined();
  });

  it('carries over a copy saved with the single default tick', () => {
    // The shipped list ticks two IL plans; the first named for IL wins, and AL takes the shipped default.
    expect(migrateDefaultPlans(undefined, plans, seedDefaultPlans())).toEqual({ IL: 'pl1', AL: 'pl8' });
    const ticked: BoMealPlan[] = plans.map((p) => ({ ...p, isDefault: p.id === 'pl3' || p.id === 'pl2' }));
    expect(migrateDefaultPlans(undefined, ticked, seedDefaultPlans())).toEqual({ IL: 'pl3', AL: 'pl2' });
    // A ticked plan named for no level is not guessed onto one; a retired shipped default is not used.
    const odd: BoMealPlan[] = plans.map((p) => ({ ...p, isDefault: p.id === 'pl6', active: p.id !== 'pl8' }));
    expect(migrateDefaultPlans(undefined, odd, seedDefaultPlans())).toEqual({ IL: 'pl1' });
  });

  it('keeps a saved choice, including "no default", and only adds levels it never had', () => {
    expect(migrateDefaultPlans({ IL: 'pl3', AL: '' }, plans, seedDefaultPlans())).toEqual({ IL: 'pl3', AL: '' });
    expect(migrateDefaultPlans({ IL: 'pl3' }, plans, seedDefaultPlans())).toEqual({ IL: 'pl3', AL: 'pl8' });
  });

  it('gives a new resident their care level default when the tablets plan has no match', () => {
    const d = { ...residents[0], id: 'new1', name: 'New Person', level: 'AL', plan: 'mystery' } as Resident;
    const levelDefault = (level: string) => defaultPlanFor(level, seedDefaultPlans(), plans)?.id;
    expect(fromDining(d, levelDefault).planId).toBe('pl8');
    expect(fromDining({ ...d, level: 'IL' }, levelDefault).planId).toBe('pl1');
    expect(fromDining({ ...d, plan: 'daily2', level: 'IL' }, levelDefault).planId).toBe('pl8');
    expect(fromDining({ ...d, level: 'MC' }, levelDefault).planId).toBe('pl1');
  });

  it('counts a resident whose plan is gone, and the tablets do not know, on their care level default', () => {
    const rec = { ...seedBoResidents()[0], id: 'bo-only', name: 'Only In Billing', level: 'AL', planId: 'gone' };
    expect(residentPlan('bo-only', [rec], plans, seedDefaultPlans())).toBe(mealPlans.daily2);
    expect(residentPlan('bo-only', [{ ...rec, level: 'IL' }], plans, seedDefaultPlans())).toBe(mealPlans.monthly30);
    expect(residentPlan('bo-only', [rec], plans, {})).toBe(mealPlans.alacarte);
  });

  it('leaves every seed resident on the plan they ship with', () => {
    const levelDefault = (level: string) => (level === 'AL' ? 'pl2' : 'pl3');
    expect(seedBoResidents(levelDefault).map((r) => r.planId)).toEqual(seedBoResidents().map((r) => r.planId));
  });
});
