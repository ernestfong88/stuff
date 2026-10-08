/**
 * Order History rows: every check from the dining store, with what was
 * charged outside the meal plan and how.
 */
import { payMethods } from '../../../../data';
import { dinerBilling } from '../../../../domain/billing';
import type { DiningConfig } from '../../../../domain/config';
import { dinerName } from '../../../../domain/orders';
import type { Diner, Order } from '../../../../domain/types';
import { now } from '../../../../lib/clock';
import { apartmentAmount, dropKind } from '../../kit/billing';
import { inRange, type DateRange } from '../../kit/dateRange';

/** How a diner's meal was settled at close. */
export const PAYMENT_LABELS: Record<string, string> = {
  plan: 'Meal plan',
  ...Object.fromEntries(payMethods.map((p) => [p.id, p.id === 'card' ? 'Credit card' : p.label])),
  comp: 'Comped',
};

/** Choices for correcting a payment. */
export const PAYMENT_CHOICES = Object.entries(PAYMENT_LABELS).map(([id, label]) => ({ id, label }));

export type ChargeFilter = 'All' | 'apt' | 'other';
export type StatusFilter = 'all' | 'open' | 'closed';

export interface OrderRow {
  order: Order;
  open: boolean;
  /** First resident (else the first diner) for the row title. */
  lead: Diner | undefined;
  leadName: string;
  /** Every diner's name, for search. */
  names: string;
  /** Dollars charged outside the meal plan. */
  charged: number;
  /** Some of it went on the apartment. */
  apartment: boolean;
  feedback: FeedbackTag | null;
}

export interface FeedbackTag {
  text: string;
  tone: 'success' | 'danger' | 'neutral';
}

/** Feedback saved on a diner: "Liked", "Disliked · Temp", "Okay". */
export function feedbackTag(f: unknown): FeedbackTag | null {
  if (!f) return null;
  const verdict = typeof f === 'string' ? f : typeof f === 'object' && f && 'verdict' in f ? String((f as { verdict: unknown }).verdict) : '';
  if (!verdict) return null;
  const sub = typeof f === 'object' && f && 'sub' in f && (f as { sub: unknown }).sub ? ` · ${String((f as { sub: unknown }).sub)}` : '';
  return { text: verdict + sub, tone: /^liked/i.test(verdict) ? 'success' : /^disliked/i.test(verdict) ? 'danger' : 'neutral' };
}

/** What a closed diner was charged: the amount in the drop or stored at close, else what billing says is out of plan. Nothing once the check is comped. */
export function dinerCharge(d: Diner, o: Order, cfg: DiningConfig): number {
  const kind = dropKind(d.chargeDrop);
  if (o.comp || kind === 'plan' || kind === 'comp') return 0;
  if (kind === 'apt') return apartmentAmount(d, o, cfg);
  const fromDrop = Number(String(d.chargeDrop).split(':')[1]);
  if (fromDrop > 0) return fromDrop;
  if (typeof d.chargeAmt === 'number') return d.chargeAmt;
  return dinerBilling(d, o, cfg).outOfPlan;
}

export function buildRows(open: Order[], closed: Order[], cfg: DiningConfig): OrderRow[] {
  const row = (order: Order, isOpen: boolean): OrderRow => {
    const lead = order.diners.find((d) => d.kind === 'resident' && !d.isGuest) ?? order.diners[0];
    const charged = isOpen || order.comp ? 0 : order.diners.reduce((sum, d) => sum + dinerCharge(d, order, cfg), 0);
    const fb = order.diners.map((d) => feedbackTag(d.feedback)).find(Boolean) ?? null;
    return {
      order,
      open: isOpen,
      lead,
      leadName: lead ? dinerName(lead) : 'No one seated',
      names: order.diners.map((d) => dinerName(d)).join(' '),
      charged,
      apartment: !isOpen && !order.comp && order.diners.some((d) => dropKind(d.chargeDrop) === 'apt'),
      feedback: fb,
    };
  };
  const recent = (o: Order) => o.closedAt ?? o.openedAt;
  return [...closed.map((o) => row(o, false)), ...open.filter((o) => o.diners.length > 0).map((o) => row(o, true))].sort((a, b) => recent(b.order) - recent(a.order));
}

/** When a check counts for the date filter: when it closed, or opened if still open. */
export const rowTime = (r: OrderRow): number => r.order.closedAt ?? r.order.openedAt;

export function filterRows(
  rows: OrderRow[],
  f: { query: string; server: string; charge: ChargeFilter; status?: StatusFilter; range?: DateRange; at?: number },
): OrderRow[] {
  const q = f.query.trim().toLowerCase();
  const status = f.status ?? 'all';
  return rows.filter(
    (r) =>
      (status === 'all' || r.open === (status === 'open')) &&
      (!f.range || inRange(rowTime(r), f.range, f.at ?? now())) &&
      (f.server === 'All' || r.order.server === f.server) &&
      (f.charge === 'All' || (f.charge === 'apt' ? r.apartment : r.charged > 0 && !r.apartment)) &&
      (!q || r.names.toLowerCase().includes(q)),
  );
}
