/**
 * Back office resident records (meal plan, start days, kitchen notes),
 * editable on Dining Plans & Notes and read by Charge Approval.
 */
import { getResident, mealPlans } from '../../../data';
import type { MealPlan } from '../../../domain/types';
import { createSharedStore, useShared } from '../../../lib/sharedStore';
import type { BoMealPlan } from '../seed/billing';
import { seedBoResidents, withAllResidents, type BoResident } from '../seed/residents';
import { billingStore } from './billingStore';

export const residentRecordsStore = createSharedStore<BoResident[]>(seedBoResidents, {
  persistKey: 'kisco_backoffice_residents_v1',
  channel: 'kisco-backoffice-residents',
});
// A copy saved before every resident had a record (or with an old care level) is brought up to date.
{
  const saved = residentRecordsStore.get();
  const full = withAllResidents(saved);
  if (full !== saved) residentRecordsStore.set(full);
}

export function useResidentRecords(): BoResident[] {
  return useShared(residentRecordsStore);
}

export function updateResidentRecord(id: string, patch: Partial<BoResident>): void {
  residentRecordsStore.set((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

/**
 * A resident's kitchen notes from Dining Plans & Notes ("Cut sandwich in
 * quarters"), for the cook and expo tickets. Empty for a guest or associate.
 */
export function kitchenNoteFor(list: BoResident[], residentId: string | null | undefined): string {
  return (residentId && list.find((r) => r.id === residentId)?.kitchenNotes?.trim()) || '';
}

export function useKitchenNote(residentId: string | null | undefined): string {
  return useShared(residentRecordsStore, (list) => kitchenNoteFor(list, residentId));
}

/**
 * The tablets' plan for a Back Office plan. Meals a month or a day keep
 * their count (the matching tablet plan when there is one); a dollar
 * spend-down or a $0 plan pays item by item, so it is à la carte at close.
 */
export function tabletPlan(bo: Pick<BoMealPlan, 'id' | 'text' | 'amt' | 'type'>): MealPlan {
  if ((bo.type === 'Monthly' || bo.type === 'Daily') && bo.amt > 0) {
    const same = Object.values(mealPlans).find((p) => p.type === bo.type && p.amt === bo.amt);
    return same ?? { id: `bo:${bo.id}`, type: bo.type, label: `${bo.amt} meals / ${bo.type === 'Monthly' ? 'month' : 'day'}`, amt: bo.amt, unit: 'meals' };
  }
  if (bo.type === 'Monthly $') return { id: `bo:${bo.id}`, type: 'A la carte', label: `${bo.text} · $${bo.amt} spend-down`, amt: 0, unit: null };
  return mealPlans.alacarte;
}

/**
 * A resident's meal plan as close & charge, the server and the kiosk count
 * it: once the plan has been changed in Back Office (Dining Plans & Notes,
 * which logs every change), that plan with its amounts from Meal Plans;
 * until then the dining record's plan. The shipped back office records were
 * keyed in separately and disagree with the dining records for a few
 * residents, so they only take over once someone sets the plan here.
 */
export function residentPlan(
  residentId: string | null | undefined,
  records: readonly BoResident[] = residentRecordsStore.get(),
  plans: readonly BoMealPlan[] = billingStore.get().plans,
): MealPlan {
  const seed = mealPlans[getResident(residentId ?? '')?.plan ?? ''] ?? mealPlans.alacarte;
  const rec = residentId ? records.find((r) => r.id === residentId) : undefined;
  const bo = rec?.planLog?.length ? plans.find((p) => p.id === rec.planId) : undefined;
  return bo ? tabletPlan(bo) : seed;
}
