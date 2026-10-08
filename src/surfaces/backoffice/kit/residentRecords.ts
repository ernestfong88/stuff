/**
 * Back office resident records (meal plan, start days, kitchen notes),
 * editable on Dining Plans & Notes and read by Charge Approval.
 */
import { getResident, mealPlans } from '../../../data';
import type { MealPlan } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { createSharedStore, useShared } from '../../../lib/sharedStore';
import type { BoMealPlan } from '../seed/billing';
import { seedBoResidents, withAllResidents, type BoResident } from '../seed/residents';
import { billingStore } from './billingStore';
import { defaultPlanFor, type DefaultPlans } from './planDefaults';

/** The plan id a care level starts on, from Meal Plans (Default plan by care level). */
export function levelDefaultPlan(level: string): string | undefined {
  const { defaultPlans, plans } = billingStore.get();
  return defaultPlanFor(level, defaultPlans, plans)?.id;
}

export const residentRecordsStore = createSharedStore<BoResident[]>(() => seedBoResidents(levelDefaultPlan), {
  persistKey: 'kisco_backoffice_residents_v1',
  channel: 'kisco-backoffice-residents',
});
// A copy saved before every resident had a record (or with an old care level) is brought up to date,
// and a plan nobody has changed here follows the shipped one.
{
  const saved = residentRecordsStore.get();
  const seed = seedBoResidents(levelDefaultPlan);
  const full = withAllResidents(saved, levelDefaultPlan).map((r) => {
    const planId = !r.planLog?.length && seed.find((x) => x.id === r.id && x.name === r.name)?.planId;
    return planId && planId !== r.planId ? { ...r, planId } : r;
  });
  if (full.some((r, i) => r !== saved[i]) || full.length !== saved.length) residentRecordsStore.set(full);
}

export function useResidentRecords(): BoResident[] {
  return useShared(residentRecordsStore);
}

export function updateResidentRecord(id: string, patch: Partial<BoResident>): void {
  residentRecordsStore.set((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

/** A plan change just made: the plan names either side, and how to take it back. */
export interface PlanChange {
  from: string;
  to: string;
  undo: () => void;
}

/**
 * Change a resident's meal plan. Plan changes drive billing, so each is
 * logged (newest first, the latest 10 kept). Undo puts back the plan and the
 * log exactly as they were. Null when the resident is unknown or already on
 * that plan.
 */
export function changeResidentPlan(
  id: string,
  planId: string,
  by: string,
  plans: readonly BoMealPlan[] = billingStore.get().plans,
): PlanChange | null {
  const r = residentRecordsStore.get().find((x) => x.id === id);
  if (!r || r.planId === planId) return null;
  const from = plans.find((p) => p.id === r.planId)?.text ?? 'No plan';
  const to = plans.find((p) => p.id === planId)?.text ?? planId;
  const before: Partial<BoResident> = { planId: r.planId, planLog: r.planLog };
  updateResidentRecord(id, { planId, planLog: [{ at: now(), by, from, to }, ...(r.planLog ?? [])].slice(0, 10) });
  return { from, to, undo: () => updateResidentRecord(id, before) };
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
    return (
      same ?? { id: `bo:${bo.id}`, type: bo.type, label: `${bo.amt} meals / ${bo.type === 'Monthly' ? 'month' : 'day'}`, amt: bo.amt, unit: 'meals' }
    );
  }
  if (bo.type === 'Monthly $') return { id: `bo:${bo.id}`, type: 'A la carte', label: `${bo.text} · $${bo.amt} spend-down`, amt: 0, unit: null };
  return mealPlans.alacarte;
}

/**
 * A resident's meal plan as close & charge, the server and the kiosk count
 * it: the Back Office plan (Dining Plans & Notes) with its amounts from Meal
 * Plans. The dining record's plan is only a fallback, for a resident with no
 * Back Office record or a plan that no longer exists; then their care
 * level's default plan; then à la carte.
 */
export function residentPlan(
  residentId: string | null | undefined,
  records: readonly BoResident[] = residentRecordsStore.get(),
  plans: readonly BoMealPlan[] = billingStore.get().plans,
  defaultPlans: DefaultPlans | undefined = billingStore.get().defaultPlans,
): MealPlan {
  const dining = getResident(residentId ?? '');
  const rec = residentId ? records.find((r) => r.id === residentId) : undefined;
  const bo = rec ? plans.find((p) => p.id === rec.planId) : undefined;
  if (bo) return tabletPlan(bo);
  const seed = mealPlans[dining?.plan ?? ''];
  if (seed) return seed;
  const byLevel = defaultPlanFor(rec?.level ?? dining?.level, defaultPlans, plans);
  return byLevel ? tabletPlan(byLevel) : mealPlans.alacarte;
}
