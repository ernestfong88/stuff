/**
 * Back office billing state: meal plans, meal count options, delivery
 * options and the apartment charges awaiting approval. Persisted and synced
 * across tabs; several pages read it (the dashboard counts charges to review).
 */
import { useEffect } from 'react';
import { getResident, getTable } from '../../../data';
import { dinerName } from '../../../domain/orders';
import type { Order } from '../../../domain/types';
import { createSharedStore, useShared } from '../../../lib/sharedStore';
import { useDining } from '../../../store/dining';
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

/** Charges and settings; apartment charges closed on the floor are pulled in for approval. */
export function useBilling(): BillingState {
  const { history } = useDining();
  useEffect(() => syncFloorCharges(history), [history]);
  return useShared(billingStore);
}

/**
 * Apartment charges made when a server closes a check (a diner's payment
 * recorded as "apt:<amount>"). Each diner of each closed check is one
 * charge, with a stable id, so pulling them in again changes nothing.
 */
export function floorCharges(history: readonly Order[]): Charge[] {
  return history.flatMap((o) =>
    o.diners.flatMap((d): Charge[] => {
      const m = /^apt:([\d.]+)/.exec(d.chargeDrop ?? '');
      const amount = m ? Number(m[1]) : 0;
      if (!amount || !o.closedAt) return [];
      const resident = d.kind === 'resident' ? getResident(d.refId) : undefined;
      const where = getTable(o.tableId)?.label ?? (o.queueType === 'delivery' ? 'Delivery' : o.queueType === 'pickup' ? 'Pick up' : '');
      return [
        {
          id: `floor:${o.id}:${d.id}`,
          residentId: d.refId,
          level: resident?.level ?? '',
          date: o.closedAt,
          item: d.isGuest ? 'GMEAL' : 'MEAL',
          desc: [o.meal, where, d.isGuest ? `guest ${dinerName(d)}` : ''].filter(Boolean).join(' · '),
          amount,
          active: true,
          approvedAt: null,
          approvedBy: null,
          importedAt: null,
          source: 'meal',
        },
      ];
    }),
  );
}

/** Add floor charges the back office hasn't seen yet. */
export function syncFloorCharges(history: readonly Order[]): void {
  const incoming = floorCharges(history);
  if (!incoming.length) return;
  billingStore.set((st) => {
    const known = new Set(st.charges.map((c) => c.id));
    const fresh = incoming.filter((c) => !known.has(c.id));
    return fresh.length ? { ...st, charges: [...fresh, ...st.charges] } : st;
  });
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
