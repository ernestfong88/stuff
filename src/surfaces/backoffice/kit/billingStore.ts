/**
 * The back office billing store on its own, with no React or dining imports,
 * so domain code (close & charge) can read the meal plans without an import
 * cycle. kit/billing re-exports it with the hooks and the charge sync.
 */
import { createSharedStore } from '../../../lib/sharedStore';
import {
  seedCharges,
  seedDefaultPlans,
  seedDeliveryOptions,
  seedMealCounts,
  seedPlans,
  type BoMealPlan,
  type Charge,
  type DeliveryOption,
  type MealCountOption,
} from '../seed/billing';
import { migrateDefaultPlans, type DefaultPlans } from './planDefaults';

export interface BillingState {
  plans: BoMealPlan[];
  /** The plan each care level starts on (care level → plan id). */
  defaultPlans: DefaultPlans;
  mealCounts: MealCountOption[];
  /** Retired: the old delivery option list. The fee now lives per venue in the dining config (`venueFee`). Kept so saved copies load. */
  deliveryOptions: DeliveryOption[];
  charges: Charge[];
}

export const billingStore = createSharedStore<BillingState>(
  () => ({
    plans: seedPlans(),
    defaultPlans: seedDefaultPlans(),
    mealCounts: seedMealCounts(),
    deliveryOptions: seedDeliveryOptions(),
    charges: seedCharges(),
  }),
  { persistKey: 'kisco_backoffice_billing_v1', channel: 'kisco-backoffice-billing' },
);

// A copy saved before a shipped plan existed gets it, so residents on that plan keep their count.
{
  const saved = billingStore.get();
  const missing = seedPlans().filter((p) => !saved.plans.some((x) => x.id === p.id));
  if (missing.length) billingStore.set({ ...saved, plans: [...saved.plans, ...missing] });
}
// A copy saved with the single default tick gets a default for each care level.
{
  const saved = billingStore.get();
  const defaultPlans = migrateDefaultPlans(saved.defaultPlans as DefaultPlans | undefined, saved.plans, seedDefaultPlans());
  if (JSON.stringify(defaultPlans) !== JSON.stringify(saved.defaultPlans)) billingStore.set({ ...saved, defaultPlans });
}

/** Set (or, with a blank id, clear) the plan a care level starts on. */
export function setDefaultPlan(level: string, planId: string): void {
  billingStore.set((s) => ({ ...s, defaultPlans: { ...s.defaultPlans, [level]: planId } }));
}
