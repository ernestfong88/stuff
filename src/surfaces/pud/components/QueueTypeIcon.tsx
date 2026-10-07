import { ShoppingBag, Truck } from 'lucide-react';
import type { QueueType } from '../../../domain/types';
import { cx } from '../../../ui';
import s from './QueueTypeIcon.module.css';

export const QUEUE_LABEL: Record<QueueType, string> = { pickup: 'Pick up', delivery: 'Delivery' };

/** Bag for a pick up, truck for a delivery, on a tint of the type's colour. */
export function QueueTypeIcon({ type }: { type: QueueType }) {
  const Icon = type === 'delivery' ? Truck : ShoppingBag;
  return (
    <span className={cx(s.icon, s[type])} title={QUEUE_LABEL[type]}>
      <Icon size={17} strokeWidth={2.25} aria-hidden />
    </span>
  );
}
