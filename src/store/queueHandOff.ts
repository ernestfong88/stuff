/**
 * Handing a pick up or delivery on, the same way from every screen (Expo and
 * PU & Delivery): one set of actions on one order state, so the two screens
 * never disagree about where an order is.
 *
 * - Set out: packed and on the counter. The resident gets the "ready" text
 *   (Messages wording, through the outbox). Where the venue doesn't track
 *   collection, that finishes the order.
 * - On my way: the runner leaves with a delivery; the "on its way" text goes
 *   now, never before.
 * - Picked up / Delivered: the resident has it; the order closes into history.
 *
 * Once set out or out the door, the order is off the pass (expoTickets.handedOn).
 */
import { useCallback, useMemo } from 'react';
import { dinerName } from '../domain/orders';
import { mobileOverrides, textSettings, tracksPickups, useServiceSettings } from '../domain/pickupService/settings';
import { queueTextKey, textFor, textMessage, textNumber, textRecipient, type TextContext } from '../domain/pickupService/texts';
import type { Order } from '../domain/types';
import { useDiningActions } from './dining';
import { sendText } from './textOutbox';

/** The text settings PU & Delivery and Expo read, re-read when Back Office changes them. */
export function useTextContext(): TextContext {
  const cfg = useServiceSettings();
  return useMemo(() => ({ texts: textSettings(cfg), mobile: mobileOverrides(cfg) }), [cfg]);
}

export interface QueueHandOff {
  /** Packed and set out; returns true when that finished the order (the venue doesn't track collection). */
  setOut: (o: Order) => boolean;
  /** The runner leaves with a delivery. */
  leave: (o: Order) => void;
  /** The resident has it: picked up at the counter, or delivered to the door. */
  done: (o: Order) => void;
}

export function useQueueHandOff(): QueueHandOff {
  const { notifyOrder, markPickedUp, markDelivered, patchOrder } = useDiningActions();
  const cfg = useServiceSettings();
  const ctx = useTextContext();

  /** The order's one text, in the community's wording, through the outbox. */
  const text = useCallback(
    (o: Order) => {
      const k = queueTextKey(o);
      const to = textNumber(o, ctx);
      if (!textFor(o, k, ctx).sent || !to) return;
      const d = textRecipient(o, ctx.mobile);
      sendText({ to, body: textMessage(o, k, ctx), kind: k, ref: o.id, name: d ? dinerName(d) : undefined });
    },
    [ctx],
  );

  const setOut = useCallback(
    (o: Order) => {
      notifyOrder(o.id);
      text(o);
      if (tracksPickups(cfg, o.room)) return false;
      patchOrder(o.id, { setOut: true });
      markDelivered(o.id);
      return true;
    },
    [cfg, notifyOrder, text, patchOrder, markDelivered],
  );

  const leave = useCallback(
    (o: Order) => {
      notifyOrder(o.id);
      markPickedUp(o.id);
      text(o);
    },
    [notifyOrder, markPickedUp, text],
  );

  const done = useCallback((o: Order) => markDelivered(o.id), [markDelivered]);

  return useMemo(() => ({ setOut, leave, done }), [setOut, leave, done]);
}
