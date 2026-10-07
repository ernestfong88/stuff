/**
 * The checks a server closed this shift, and how each diner paid, for the
 * end of shift review.
 */
import { dinerBilling } from '../../../../domain/billing';
import type { DiningConfig } from '../../../../domain/config';
import { dinerName, tableName } from '../../../../domain/orders';
import type { Diner, Order } from '../../../../domain/types';

export type Payment =
  | { kind: 'plan' }
  | { kind: 'card' | 'apt'; amt: number; who: string; ref?: string }
  | { kind: 'comp'; reason: string; amt: number; who: string };

/**
 * How one diner paid. The close screen stores "kind[:amount[:reference]]"
 * ("card:34:sq_7F3K2", "apt:18", "comp:Sick:22"); a bare kind takes the
 * amount from the bill, and no choice at all means the meal plan covered it
 * (or, for a meal the plan does not cover, the apartment was charged).
 */
export function paymentOf(d: Diner, o: Order, cfg?: DiningConfig): Payment {
  const [kind = '', a, b] = String(d.chargeDrop ?? '').split(':');
  const who = dinerName(d);
  const bill = () => dinerBilling(d, o, cfg);
  if (kind === 'comp') {
    const amt = Number(b);
    return { kind: 'comp', reason: a || 'Comp', amt: b != null && !Number.isNaN(amt) ? amt : bill().itemsTotal, who };
  }
  if (kind === 'card' || kind === 'apt') {
    const amt = a != null && a !== '' ? Number(a) || 0 : bill().outOfPlan;
    return amt > 0 ? { kind, amt, who, ref: b } : { kind: 'plan' };
  }
  if (kind === 'plan') return { kind: 'plan' };
  const billing = bill();
  return billing.needsDrop && billing.outOfPlan > 0 ? { kind: 'apt', amt: billing.outOfPlan, who } : { kind: 'plan' };
}

export interface ClosedCheckRow {
  id: string;
  order: Order;
  table: string;
  closedAt: number;
  covers: number;
  /** Diners covered by their meal plan. */
  plan: number;
  charges: Array<Extract<Payment, { kind: 'card' | 'apt' }>>;
  comps: Array<Extract<Payment, { kind: 'comp' }>>;
}

export function closedCheckRow(o: Order, cfg?: DiningConfig): ClosedCheckRow {
  const row: ClosedCheckRow = {
    id: o.id,
    order: o,
    table: o.queueType ? tableName(o) : `Table ${tableName(o)}`,
    closedAt: o.closedAt ?? o.openedAt,
    covers: o.diners.length,
    plan: 0,
    charges: [],
    comps: [],
  };
  for (const d of o.diners) {
    const p = paymentOf(d, o, cfg);
    if (p.kind === 'plan') row.plan += 1;
    else if (p.kind === 'comp') row.comps.push(p);
    else row.charges.push(p);
  }
  return row;
}

/** A server's checks closed since `since`, newest first. */
export function closedThisShift(history: Order[], who: string, since: number, cfg?: DiningConfig): ClosedCheckRow[] {
  return history
    .filter((o) => o.server === who && (o.closedAt ?? 0) >= since)
    .map((o) => closedCheckRow(o, cfg))
    .sort((a, b) => b.closedAt - a.closedAt);
}

export interface ShiftTotals {
  checks: number;
  covers: number;
  card: { sum: number; count: number };
  apt: { sum: number; count: number };
  comps: { sum: number; count: number };
}

export function shiftTotals(rows: ClosedCheckRow[]): ShiftTotals {
  const charges = rows.flatMap((r) => r.charges);
  const comps = rows.flatMap((r) => r.comps);
  const total = (list: Array<{ amt: number }>) => list.reduce((a, c) => a + c.amt, 0);
  const card = charges.filter((c) => c.kind === 'card');
  const apt = charges.filter((c) => c.kind === 'apt');
  return {
    checks: rows.length,
    covers: rows.reduce((a, r) => a + r.covers, 0),
    card: { sum: total(card), count: card.length },
    apt: { sum: total(apt), count: apt.length },
    comps: { sum: total(comps), count: comps.length },
  };
}

/** Check-ins at the tables of a server's open and closed checks. */
export function checkInCount(checks: Order[], who: string): number {
  return checks.filter((o) => o.server === who).reduce((a, o) => a + (o.checkIns?.length ?? 0), 0);
}
