/**
 * When a table put its order in, for the card on My Tables: the first time
 * anything went to the kitchen (the time on the kitchen ticket), or, before
 * anything is sent, when the check was opened.
 */
import { firstSend } from '../../../domain/courses';
import type { Order } from '../../../domain/types';
import { formatTime } from '../../../lib/format';

export interface OrderTime {
  /** Ordered: something has been sent. Opened: nothing sent yet. */
  kind: 'ordered' | 'opened';
  at: number;
}

export function orderTime(o: Order): OrderTime {
  const sent = firstSend(o);
  return sent != null ? { kind: 'ordered', at: sent } : { kind: 'opened', at: o.openedAt };
}

/** "Ordered 5:32 PM" or "Opened 5:30 PM". */
export function orderTimeLabel(t: OrderTime): string {
  return `${t.kind === 'ordered' ? 'Ordered' : 'Opened'} ${formatTime(t.at)}`;
}
