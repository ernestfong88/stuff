import { dinerName } from '../../../domain/orders';
import type { Order } from '../../../domain/types';
import { reminderLines } from '../shared/lines';
import { ReminderChips } from '../shared/ReminderChips';
import s from './ReminderRow.module.css';

/** "Don't forget" chips for the course that is ready, on the table card. */
export function ReminderRow({ order, course }: { order: Order; course: number }) {
  const lines = reminderLines(order, course);
  if (!lines.length) return null;
  return (
    <div className={s.row} onClick={(e) => e.stopPropagation()}>
      <span className={s.label}>Don't forget</span>
      {lines.map(({ diner, line }) => (
        <ReminderChips key={line.id} order={order} line={line} who={dinerName(diner).split(' ')[0]} />
      ))}
    </div>
  );
}
