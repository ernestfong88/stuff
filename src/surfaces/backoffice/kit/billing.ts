/**
 * Back office billing state: meal plans, meal count options, delivery
 * options and the apartment charges awaiting approval. Persisted and synced
 * across tabs; several pages read it (the dashboard counts charges to review).
 */
import { createSharedStore, useShared } from '../../../lib/sharedStore';
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
  deliveryOptions: DeliveryOption[];
  charges: Charge[];
}

export const billingStore = createSharedStore<BillingState>(
  () => ({ plans: seedPlans(), mealCounts: seedMealCounts(), deliveryOptions: seedDeliveryOptions(), charges: seedCharges() }),
  { persistKey: 'kisco_backoffice_billing_v1', channel: 'kisco-backoffice-billing' },
);

export function useBilling(): BillingState {
  return useShared(billingStore);
}

export function setBillingList<K extends keyof BillingState>(key: K, next: BillingState[K] | ((list: BillingState[K]) => BillingState[K])): void {
  billingStore.set((st) => ({ ...st, [key]: typeof next === 'function' ? next(st[key]) : next }));
}

/** Charges nobody has approved or imported yet. */
export function chargesToReview(charges: Charge[]): Charge[] {
  return charges.filter((c) => !c.importedAt && !c.approvedAt);
}

/** Dollars waiting for approval (voided charges don't count). */
export function amountToReview(charges: Charge[]): number {
  return chargesToReview(charges)
    .filter((c) => c.active)
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}
