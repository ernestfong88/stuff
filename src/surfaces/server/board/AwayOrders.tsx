import { BadgeCheck, ShoppingBag, Truck } from 'lucide-react';
import { pickupStage, pickupWho, type PickupStage } from '../../../domain/pickup';
import { printerMode } from '../../../domain/config';
import { tableName } from '../../../domain/orders';
import type { Order } from '../../../domain/types';
import { formatElapsed } from '../../../lib/format';
import { useConfig } from '../../../store/config';
import { cx, EmptyState, useNow } from '../../../ui';
import { pickupWindow } from '../../kitchen/kitchenTime';
import s from './AwayOrders.module.css';

const STAGE_WORDS: Record<PickupStage, string> = {
  draft: 'Not sent yet',
  scheduled: 'Scheduled',
  cooking: 'Cooking',
  ready: 'Ready',
  waiting: 'Waiting for pick up',
  out: 'On its way',
  done: 'Done',
};

/**
 * My pick up, delivery and associate meal orders, the other half of My
 * Tables. With printers nothing is tracked after the send, so an order
 * reads Sent or Not sent yet.
 */
export function AwayOrders({ orders, onOpen }: { orders: Order[]; onOpen: (orderId: string) => void }) {
  const printers = printerMode(useConfig());
  const at = useNow(5000);
  if (!orders.length)
    return (
      <EmptyState icon={<ShoppingBag size={28} />} title="No pick up or delivery orders">
        Start one with + New check, then Pick up, Delivery or Associate meal.
      </EmptyState>
    );
  const list = [...orders].sort((a, b) => a.openedAt - b.openedAt);
  return (
    <div className={s.list}>
      {list.map((o) => {
        const stage = pickupStage(o, printers ? 'printers' : undefined);
        const items = o.diners.reduce((n, d) => n + d.items.filter((i) => !i.cancelled && !i.parentId).length, 0);
        const Icon = o.assoc ? BadgeCheck : o.queueType === 'delivery' ? Truck : ShoppingBag;
        const word = printers ? (stage === 'draft' ? 'Not sent yet' : 'Sent') : STAGE_WORDS[stage];
        return (
          <button key={o.id} className={s.row} onClick={() => onOpen(o.id)}>
            <Icon size={18} className={s.icon} aria-hidden />
            <span className={s.main}>
              <span className={s.type}>{tableName(o)}</span>
              <span className={s.who}>{pickupWho(o)}</span>
            </span>
            {o.readyAt && <span className={s.window}>{o.readyAt === 'ASAP' ? 'ASAP' : pickupWindow(o.readyAt)}</span>}
            <span className={s.items}>
              {items} {items === 1 ? 'item' : 'items'}
            </span>
            <span className={cx(s.stage, stage === 'draft' && s.draft)}>{word}</span>
            <span className={s.timer}>{formatElapsed(at - o.openedAt)}</span>
          </button>
        );
      })}
    </div>
  );
}
