/**
 * Whether a pick up or delivery order gets a text when it is ready, and
 * who it goes to. A pick up gets one text when it is packed and set out, a
 * delivery one when it leaves.
 *
 * The Back Office can switch each text off (service setting
 * `texts.<key>.on`) and record whether a resident has a mobile
 * (`mobile.<residentId>`).
 */
import type { Diner, Order } from '../../domain/types';

/** Residents with no mobile number on file in the demo community. */
const NO_MOBILE = new Set(['r4', 'r6', 'r22', 'r24']);

export type OrderTextKey = 'pickupReady' | 'deliveryOut';

export interface TextSettings {
  texts?: Record<string, { on?: boolean } | undefined>;
  mobile?: Record<string, boolean | undefined>;
}

export type TextPlan = { sent: true; to?: Diner } | { sent: false; why: 'no text' | 'no mobile' };

export function hasMobile(residentId: string, settings: TextSettings): boolean {
  const v = settings.mobile?.[residentId];
  return v != null ? !!v : !NO_MOBILE.has(residentId);
}

export function textKeyFor(o: Pick<Order, 'queueType'>): OrderTextKey {
  return o.queueType === 'delivery' ? 'deliveryOut' : 'pickupReady';
}

/** Will the order's ready text go out, and to whom? An associate order always gets one. */
export function orderTextPlan(o: Order, settings: TextSettings): TextPlan {
  if (settings.texts?.[textKeyFor(o)]?.on === false) return { sent: false, why: 'no text' };
  if (o.assoc) return { sent: true };
  const to = o.diners.find((d) => d.kind === 'resident' && d.refId && hasMobile(d.refId, settings));
  return to ? { sent: true, to } : { sent: false, why: 'no mobile' };
}
