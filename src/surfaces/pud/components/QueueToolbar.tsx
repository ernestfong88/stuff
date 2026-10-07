import { History, Plus } from 'lucide-react';
import { Tabs, cx } from '../../../ui';
import type { QueueFilter } from '../queue/queue';
import s from './QueueToolbar.module.css';

export interface QueueToolbarProps {
  filter: QueueFilter;
  onFilter: (f: QueueFilter) => void;
  counts: Record<QueueFilter, number>;
  completed: boolean;
  completedCount: number;
  onToggleCompleted: () => void;
  onNew: (type: 'pickup' | 'delivery') => void;
}

/** All / Pick up / Delivery, Completed today, and the two New buttons. */
export function QueueToolbar({ filter, onFilter, counts, completed, completedCount, onToggleCompleted, onNew }: QueueToolbarProps) {
  return (
    <div className={s.bar}>
      <Tabs<QueueFilter>
        aria-label="Show"
        size="lg"
        value={filter}
        onChange={onFilter}
        options={[
          { id: 'all', label: 'All', count: counts.all },
          { id: 'pickup', label: 'Pick up', count: counts.pickup },
          { id: 'delivery', label: 'Delivery', count: counts.delivery },
        ]}
      />
      <span className={s.divider} aria-hidden />
      <button className={cx(s.completed, completed && s.on)} aria-pressed={completed} onClick={onToggleCompleted}>
        <History size={15} strokeWidth={2.25} aria-hidden />
        {completed ? 'Back to open orders' : 'Completed today'}
        {!completed && <span className={s.count}>{completedCount}</span>}
      </button>
      <span className={s.grow} />
      <button className={cx(s.add, s.addPickup)} onClick={() => onNew('pickup')} aria-label="New pick up order">
        <Plus size={16} strokeWidth={2.5} aria-hidden />
        Pick up
      </button>
      <button className={cx(s.add, s.addDelivery)} onClick={() => onNew('delivery')} aria-label="New delivery order">
        <Plus size={16} strokeWidth={2.5} aria-hidden />
        Delivery
      </button>
    </div>
  );
}
