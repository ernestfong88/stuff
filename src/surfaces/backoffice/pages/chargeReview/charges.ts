/**
 * Apartment charges move unapproved → approved → imported to billing.
 * Voiding is separate and can be undone at any step before import.
 */
import { DAY } from '../../../../lib/clock';
import { inRange, type DateRange } from '../../kit/dateRange';
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

/** Approve every live charge still waiting for review (only those in `only`, when given: the ones shown). */
export function approveAll(charges: Charge[], by: string, at: number, only?: ReadonlySet<string>): Charge[] {
  return charges.map((c) => (!c.importedAt && !c.approvedAt && c.active && (!only || only.has(c.id)) ? { ...c, approvedAt: at, approvedBy: by } : c));
}

/** Mark every approved, live charge waiting to import as sent to billing (only those in `only`, when given). */
export function sendToBilling(charges: Charge[], at: number, only?: ReadonlySet<string>): Charge[] {
  return charges.map((c) => (!c.importedAt && c.approvedAt && c.active && (!only || only.has(c.id)) ? { ...c, importedAt: at } : c));
}

/** What a charge is for, in words, from the old system's item codes. */
const ITEM_LABELS: Record<string, string> = { TRAY: 'Delivery', LIQUOR: 'Alcohol', GMEAL: 'Guest meal', MEAL: 'Meal', MANUAL: 'Added by hand' };
export const itemLabel = (item: string) => ITEM_LABELS[item] ?? item;

export type ChargeStep = 'voided' | 'waiting' | 'approved' | 'sent';

/** Where a charge is: voided, waiting for review, approved, or sent to billing. */
export function chargeStep(c: Charge): ChargeStep {
  if (c.importedAt) return 'sent';
  if (!c.active) return 'voided';
  return c.approvedAt ? 'approved' : 'waiting';
}

/** The category a charge is filtered by: its item code ("TRAY", "GMEAL"), else where it came from. */
export function chargeCategory(c: Pick<Charge, 'item' | 'source'>): string {
  return (c.item || c.source || 'OTHER').toUpperCase();
}

/** Known categories first, in this order; any other code follows by name. */
const CATEGORY_ORDER = ['MEAL', 'GMEAL', 'TRAY', 'LIQUOR', 'MANUAL'];

export interface ChargeCategory {
  id: string;
  label: string;
  count: number;
}

/** Each category among these charges, with how many there are. */
export function chargeCategories(charges: readonly Charge[]): ChargeCategory[] {
  const counts = new Map<string, number>();
  for (const c of charges) counts.set(chargeCategory(c), (counts.get(chargeCategory(c)) ?? 0) + 1);
  const rank = (id: string) => (CATEGORY_ORDER.includes(id) ? CATEGORY_ORDER.indexOf(id) : CATEGORY_ORDER.length);
  return [...counts]
    .map(([id, count]) => ({ id, label: itemLabel(id), count }))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.label.localeCompare(b.label));
}

export interface ChargeFilters {
  /** Categories to show; empty shows every one. */
  categories: readonly string[];
  range: DateRange;
}

/** The charges matching the category and date filters. */
export function filterCharges(charges: readonly Charge[], f: ChargeFilters, at: number): Charge[] {
  return charges.filter((c) => (!f.categories.length || f.categories.includes(chargeCategory(c))) && inRange(c.date, f.range, at));
}

/** Dollars across live charges (voided ones are not billed). */
export function chargeTotal(charges: readonly Charge[]): number {
  return Math.round(charges.reduce((sum, c) => sum + (c.active ? Number(c.amount) : 0), 0) * 100) / 100;
}
