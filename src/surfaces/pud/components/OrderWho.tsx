import { pickupApt, pickupItems, pickupWho } from '../../../domain/pickup';
import type { Order, QueueType } from '../../../domain/types';
import { useConfig } from '../../../store/config';
import type { MobileOverrides } from '../service/phones';
import { OrderTags, utensilsText } from './OrderTags';
import s from './OrderWho.module.css';

/** Where the order goes: " · Apt 128", " · Delivery" or " · Pick up". */
export function placeText(type: QueueType | undefined, apt: string): string {
  if (type === 'delivery') return apt ? ` · Apt ${apt}` : ' · Delivery';
  return ' · Pick up';
}

/** Who the order is for, where it goes, its tags, and what is on it. */
export function OrderWho({ order, mobile }: { order: Order; mobile: MobileOverrides }) {
  const cfg = useConfig();
  const type = order.queueType ?? 'pickup';
  return (
    <div className={s.main}>
      <div className={s.who}>
        <span className={s.name}>{pickupWho(order)}</span>
        <span className={s[type]}>{placeText(type, pickupApt(order))}</span>
        <OrderTags order={order} mobile={mobile} />
      </div>
      <div className={s.items}>{(pickupItems(order, cfg) || 'No items yet') + utensilsText(order)}</div>
    </div>
  );
}
