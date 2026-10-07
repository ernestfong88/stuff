import { useCallback, useEffect, useMemo } from 'react';
import { dinerName } from '../../../domain/orders';
import type { Order } from '../../../domain/types';
import { useDining } from '../../../store/dining';
import { sendText } from '../../../store/textOutbox';
import { toast } from '../../../ui';
import { mobileOverrides, textSettings, tracksPickups, useServiceSettings } from '../../../domain/pickupService/settings';
import { queueTextKey, textFor, textMessage, textNumber, textRecipient, type TextContext } from '../../../domain/pickupService/texts';
import { handOffMessage, undoPatch, type QueueActionKind, type QueueRow } from './queue';

/** The text settings PU & Delivery reads, re-read when Back Office changes them. */
export function useTextContext(): TextContext {
  const cfg = useServiceSettings();
  return useMemo(() => ({ texts: textSettings(cfg), mobile: mobileOverrides(cfg) }), [cfg]);
}

/**
 * What the PU & Delivery buttons do. Handing an order on (packed and set
 * out, or out the door) sends its one text through the outbox. Each hand-off
 * shows a toast with Undo, since one tap moves or closes the order.
 */
export function usePudActions(rows: QueueRow[], onOpen: (orderId: string) => void) {
  const dining = useDining();
  const cfg = useServiceSettings();
  const ctx = useTextContext();
  const { notifyOrder, markPickedUp, markDelivered, patchOrder, reopenOrder } = dining;

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

  /** Put an order back the way it was before `kind`; a closed one is reopened first. */
  const undo = useCallback(
    (kind: QueueActionKind, o: Order, closed: boolean) => {
      if (closed) reopenOrder(o.id);
      patchOrder(o.id, undoPatch(kind));
    },
    [reopenOrder, patchOrder],
  );

  /** Packed and set out; at a venue that doesn't track collection, that finishes it. Returns true when it finished. */
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
      if (kind === 'finish') return onOpen(o.id);
      let closed = false;
      if (kind === 'packed') closed = setOut(o);
      else if (kind === 'onMyWay') leave(o);
      else {
        markDelivered(o.id);
        closed = true;
      }
      toast(handOffMessage(kind, o, closed), { tone: 'success', action: { label: 'Undo', onClick: () => undo(kind, o, closed) } });
    },
    [onOpen, setOut, leave, markDelivered, undo],
  );

  /** Every ready delivery leaves in one trip, with one Undo for all of them. */
  const takeAll = useCallback(
    (list: QueueRow[]) => {
      list.forEach((r) => leave(r.order));
      toast(`${list.length} deliveries are on the way.`, {
        tone: 'success',
        action: { label: 'Undo', onClick: () => list.forEach((r) => undo('onMyWay', r.order, false)) },
      });
    },
    [leave, undo],
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
      reopenOrder(o.id);
      patchOrder(o.id, { deliveredAt: undefined, setOut: undefined });
    },
    [reopenOrder, patchOrder],
  );

  return { run, takeAll, reopen };
}
