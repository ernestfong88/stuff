/**
 * Back office billing state: meal plans, meal count options, delivery
 * options and the apartment charges awaiting approval. Persisted and synced
 * across tabs; several pages read it (the dashboard counts charges to review).
 */
import { useEffect } from 'react';
import { getResident, getTable } from '../../../data';
import { dinerBilling } from '../../../domain/billing';
import { DEFAULT_CONFIG, type DiningConfig } from '../../../domain/config';
import { dinerName } from '../../../domain/orders';
import type { Diner, Order } from '../../../domain/types';
import { useShared } from '../../../lib/sharedStore';
import { useConfig } from '../../../store/config';
import { useDining } from '../../../store/dining';
import type { Charge } from '../seed/billing';
import { billingStore, type BillingState } from './billingStore';

export { billingStore, type BillingState } from './billingStore';

/** Charges and settings; apartment charges closed on the floor are pulled in for approval and kept in step with corrections. */
export function useBilling(): BillingState {
  const { history, orders } = useDining();
  const cfg = useConfig();
  useEffect(() => syncFloorCharges(history, orders, cfg), [history, orders, cfg]);
  return useShared(billingStore);
}

/** A diner's payment drop split up: "apt:20" → kind "apt", amount 20; "comp:Sick:9" → kind "comp". */
export function dropKind(drop: string | null | undefined): string {
  return String(drop || 'plan').split(':')[0];
}

/**
 * What a closed diner put on their apartment: the amount in the drop
 * ("apt:20"), else the amount stored on the diner, else what billing says is
 * out of plan (a bare "apt" from a delivery hand-off or a correction).
 * Nothing when the check is comped or the diner paid another way.
 */
export function apartmentAmount(d: Diner, o: Order, cfg: DiningConfig = DEFAULT_CONFIG): number {
  if (o.comp || dropKind(d.chargeDrop) !== 'apt') return 0;
  const fromDrop = Number(String(d.chargeDrop).split(':')[1]);
  if (fromDrop > 0) return fromDrop;
  if (typeof d.chargeAmt === 'number') return d.chargeAmt;
  return dinerBilling(d, o, cfg).outOfPlan;
}

/**
 * Apartment charges made when a check closes (a diner's payment recorded as
 * "apt:<amount>"). Each diner of each closed check is one charge, with a
 * stable id, so pulling them in again changes nothing.
 */
export function floorCharges(history: readonly Order[], cfg: DiningConfig = DEFAULT_CONFIG): Charge[] {
  return history.flatMap((o) =>
    o.diners.flatMap((d): Charge[] => {
      const amount = o.closedAt ? apartmentAmount(d, o, cfg) : 0;
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
          amount: Math.round(amount * 100) / 100,
          active: true,
          approvedAt: null,
          approvedBy: null,
          importedAt: null,
          source: 'meal',
          floorSig: String(Math.round(amount * 100) / 100),
        },
      ];
    }),
  );
}

/** The check a floor charge came from: "floor:o12:d1" → "o12" (separate checks keep their "o12:d1" id). */
const floorOrderId = (chargeId: string) => chargeId.slice('floor:'.length, chargeId.lastIndexOf(':'));

/**
 * Keep floor charges in step with the checks they came from. New ones are
 * added. When a check is comped, paid another way, reopened or closed again
 * for a different amount, its charge is voided or updated and goes back to
 * review. A charge already sent to billing is never touched, and an edit or
 * void made in Charge Approval stays until the check itself changes again.
 */
export function reconcileFloorCharges(
  charges: Charge[],
  history: readonly Order[],
  open: readonly Pick<Order, 'id'>[] = [],
  cfg: DiningConfig = DEFAULT_CONFIG,
): Charge[] {
  const incoming = new Map(floorCharges(history, cfg).map((c) => [c.id, c]));
  const closed = new Map(history.map((o) => [o.id, o]));
  const openIds = new Set(open.map((o) => o.id));
  let changed = false;
  const next = charges.map((c) => {
    if (!c.id.startsWith('floor:') || c.importedAt) return c;
    const want = incoming.get(c.id);
    const oid = floorOrderId(c.id);
    const order = closed.get(oid);
    if (!want && !order && !openIds.has(oid)) return c;
    const sig = want ? want.floorSig! : 'none';
    const last = c.floorSig ?? (c.active ? String(c.amount) : 'none');
    if (sig === last) return c;
    changed = true;
    if (want) return { ...c, amount: want.amount, desc: want.desc, date: want.date, active: true, approvedAt: null, approvedBy: null, floorSig: sig };
    const why = !order ? 'check reopened on the floor' : order.comp ? 'check comped' : 'paid another way';
    return { ...c, active: false, approvedAt: null, approvedBy: null, floorSig: sig, desc: `${c.desc.split(' · voided:')[0]} · voided: ${why}` };
  });
  const known = new Set(charges.map((c) => c.id));
  const fresh = [...incoming.values()].filter((c) => !known.has(c.id));
  return changed || fresh.length ? [...fresh, ...next] : charges;
}

/** Pull floor charges into the store, adding new ones and following corrections. */
export function syncFloorCharges(history: readonly Order[], open: readonly Pick<Order, 'id'>[] = [], cfg: DiningConfig = DEFAULT_CONFIG): void {
  billingStore.set((st) => {
    const charges = reconcileFloorCharges(st.charges, history, open, cfg);
    return charges === st.charges ? st : { ...st, charges };
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
