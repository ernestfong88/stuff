/**
 * Apartment charges move unapproved → approved → imported to billing.
 * Voiding is separate and can be undone at any step before import.
 */
import { DAY } from '../../../../lib/clock';
import type { Charge } from '../../seed/billing';

export type ChargeTab = 'review' | 'final' | 'recent';

/** The charges each tab lists. */
export function chargesFor(tab: ChargeTab, charges: Charge[], at: number): Charge[] {
  if (tab === 'review') return charges.filter((c) => !c.importedAt && !c.approvedAt);
  if (tab === 'final') return charges.filter((c) => !c.importedAt && c.approvedAt && c.active);
  return charges.filter((c) => c.date >= at - 60 * DAY);
}

/** Approve (or take back the approval of) one charge. */
export function toggleApproval(c: Charge, by: string, at: number): Charge {
  return c.approvedAt ? { ...c, approvedAt: null, approvedBy: null } : { ...c, approvedAt: at, approvedBy: by };
}

/** Approve every live charge still waiting for review. */
export function approveAll(charges: Charge[], by: string, at: number): Charge[] {
  return charges.map((c) => (!c.importedAt && !c.approvedAt && c.active ? { ...c, approvedAt: at, approvedBy: by } : c));
}
