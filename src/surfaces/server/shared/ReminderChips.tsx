import { X } from 'lucide-react';
import type { Order, OrderLine } from '../../../domain/types';
import { useDiningActions } from '../../../store/dining';
import { remindersFor } from './lines';
import s from './ReminderChips.module.css';

/** The chef's "don't forget" reminders on a line; tap one to drop it (e.g. for a guest). */
export function ReminderChips({ order, line, who }: { order: Order; line: OrderLine; who?: string }) {
  const { dismissReminder } = useDiningActions();
  const list = remindersFor(line);
  if (!list.length) return null;
  return (
    <span className={s.chips}>
      {list.map((t) => (
        <button
          key={t}
          type="button"
          className={s.chip}
          title={'Not needed' + (who ? ' for ' + who : '') + '? Tap to remove'}
          onClick={(e) => {
            e.stopPropagation();
            dismissReminder(order.id, line.id, t);
          }}
        >
          {t}
          {who ? ' · ' + who : ''}
          <X size={13} strokeWidth={2.6} aria-hidden className={s.x} />
        </button>
      ))}
    </span>
  );
}
