/**
 * The back office billing store on its own, with no React or dining imports,
 * so domain code (close & charge) can read the meal plans without an import
 * cycle. kit/billing re-exports it with the hooks and the charge sync.
 */
import { createSharedStore } from '../../../lib/sharedStore';
import {
  seedCharges,
  seedDeliveryOptions,
  seedMealCounts,
  seedPlans,
  type BoMealPlan,
  type Charge,
  type DeliveryOption,
  type MealCountOption,
} from '../seed/billing';

export interface BillingState {
  plans: BoMealPlan[];
  mealCounts: MealCountOption[];
  /** Retired: the old delivery option list. The fee now lives per venue in the dining config (`venueFee`). Kept so saved copies load. */
  deliveryOptions: DeliveryOption[];
  charges: Charge[];
}

export const billingStore = createSharedStore<BillingState>(
  () => ({ plans: seedPlans(), mealCounts: seedMealCounts(), deliveryOptions: seedDeliveryOptions(), charges: seedCharges() }),
  { persistKey: 'kisco_backoffice_billing_v1', channel: 'kisco-backoffice-billing' },
);

// A copy saved before a shipped plan existed gets it, so residents on that plan keep their count.
{
  const saved = billingStore.get();
  const missing = seedPlans().filter((p) => !saved.plans.some((x) => x.id === p.id));
  if (missing.length) billingStore.set({ ...saved, plans: [...saved.plans, ...missing] });
}
