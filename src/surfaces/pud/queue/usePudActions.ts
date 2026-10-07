import { useCallback, useEffect, useMemo } from 'react';
import { dinerName } from '../../../domain/orders';
import type { Order } from '../../../domain/types';
import { useDining } from '../../../store/dining';
import { sendText } from '../../../store/textOutbox';
import { mobileOverrides, textSettings, tracksPickups, useServiceSettings } from '../../../domain/pickupService/settings';
import { queueTextKey, textFor, textMessage, textNumber, textRecipient, type TextContext } from '../../../domain/pickupService/texts';
import type { QueueActionKind, QueueRow } from './queue';

/** The text settings PU & Delivery reads, re-read when Back Office changes them. */
export function useTextContext(): TextContext {
  const cfg = useServiceSettings();
  return useMemo(() => ({ texts: textSettings(cfg), mobile: mobileOverrides(cfg) }), [cfg]);
}

/**
 * What the PU & Delivery buttons do. Handing an order on (packed and set
 * out, or out the door) sends its one text through the outbox.
 */
export function usePudActions(rows: QueueRow[], onOpen: (orderId: string) => void) {
  const dining = useDining();
  const cfg = useServiceSettings();
  const ctx = useTextContext();
  const { notifyOrder, markPickedUp, markDelivered, patchOrder } = dining;

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

  /** Packed and set out; at a venue that doesn't track collection, that finishes it. */
  const setOut = useCallback(
    (o: Order) => {
      notifyOrder(o.id);
      text(o);
      if (!tracksPickups(cfg, o.room)) {
        patchOrder(o.id, { setOut: true });
        markDelivered(o.id);
      }
    },
    [cfg, notifyOrder, text, patchOrder, markDelivered],
  );

  /** The runner leaves with a delivery. */
  const leave = useCallback(
    (o: Order) => {
      notifyOrder(o.id);
      markPickedUp(o.id);
      text(o);
    },
    [notifyOrder, markPickedUp, text],
  );

  const run = useCallback(
    (kind: QueueActionKind, o: Order) => {
      if (kind === 'finish') onOpen(o.id);
      else if (kind === 'packed') setOut(o);
      else if (kind === 'onMyWay') leave(o);
      else markDelivered(o.id);
    },
    [onOpen, setOut, leave, markDelivered],
  );

  // A pick up that was set out before its venue stopped tracking collection
  // has no Picked up step left, so it finishes here.
  useEffect(() => {
    for (const r of rows) {
      if (r.stage === 'waiting' && r.order.queueType === 'pickup' && !tracksPickups(cfg, r.order.room)) {
        patchOrder(r.order.id, { setOut: true });
        markDelivered(r.order.id);
      }
    }
  }, [rows, cfg, patchOrder, markDelivered]);

  /** Bring a handed-off order back to the list to correct it. */
  const reopen = useCallback(
    (o: Order) => {
      dining.reopenOrder(o.id);
      dining.patchOrder(o.id, { deliveredAt: undefined, setOut: undefined });
    },
    [dining],
  );

  return { run, leave, reopen };
}
