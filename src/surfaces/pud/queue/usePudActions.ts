import { useCallback, useEffect } from 'react';
import type { Order } from '../../../domain/types';
import { useDiningActions } from '../../../store/dining';
import { useQueueHandOff, useTextContext } from '../../../store/queueHandOff';
import { toast } from '../../../ui';
import { tracksPickups, useServiceSettings } from '../../../domain/pickupService/settings';
import { handOffMessage, undoPatch, type QueueActionKind, type QueueRow } from './queue';

export { useTextContext };

/**
 * What the PU & Delivery buttons do. Handing an order on (packed and set
 * out, or out the door) sends its one text through the outbox; Expo uses the
 * same actions (store/queueHandOff), so both screens move the same order
 * state. Each hand-off shows a toast with Undo, since one tap moves or
 * closes the order.
 */
export function usePudActions(rows: QueueRow[], onOpen: (orderId: string) => void) {
  const dining = useDiningActions();
  const cfg = useServiceSettings();
  const { setOut, leave } = useQueueHandOff();
  const { markDelivered, patchOrder, reopenOrder } = dining;

  /** Put an order back the way it was before `kind`; a closed one is reopened first. */
  const undo = useCallback(
    (kind: QueueActionKind, o: Order, closed: boolean) => {
      if (closed) reopenOrder(o.id);
      patchOrder(o.id, undoPatch(kind));
    },
    [reopenOrder, patchOrder],
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
