import { Fragment } from 'react';
import { ShoppingBag } from 'lucide-react';
import { clockLabel } from '../../../domain/pickup';
import { EmptyState, cx } from '../../../ui';
import {
  groupSlots,
  nowLineIndex,
  readyDeliveries,
  slotHeading,
  statusCounts,
  type QueueActionKind,
  type QueueFilter,
  type QueueRow,
} from '../queue/queue';
import type { TextContext } from '../../../domain/pickupService/texts';
import { DeliveryRun } from './DeliveryRun';
import { NocMeals } from './NocMeals';
import { QueueRowCard } from './QueueRowCard';
import s from './OpenQueue.module.css';

export interface OpenQueueProps {
  rows: QueueRow[];
  filter: QueueFilter;
  at: number;
  ctx: TextContext;
  leadMinutes: number;
  tracksPickups: (room: string) => boolean;
  onOpen: (orderId: string) => void;
  onAction: (kind: QueueActionKind, row: QueueRow) => void;
  onTakeAll: (rows: QueueRow[]) => void;
}

/** Open orders: what needs attention, one-trip suggestion, then each 15 minute range in order. */
export function OpenQueue({ rows, filter, at, ctx, leadMinutes, tracksPickups, onOpen, onAction, onTakeAll }: OpenQueueProps) {
  const c = statusCounts(rows, at);
  // Only what needs someone now; the rest is already on each row.
  const attention = [
    { n: c.late, label: 'late', tone: s.danger },
    { n: c.ready, label: 'ready to go', tone: s.flora },
    { n: c.out, label: 'out for delivery', tone: s.coast },
  ].filter((a) => a.n > 0);
  const runs = filter === 'pickup' ? [] : readyDeliveries(rows);
  const slots = groupSlots(rows);
  const nowAt = nowLineIndex(slots, at);
  return (
    <>
      {attention.length > 0 && (
        <ul className={s.attention} aria-label="Needs attention">
          {attention.map((a) => (
            <li key={a.label} className={cx(s.pill, a.tone)}>
              <b>{a.n}</b> {a.label}
            </li>
          ))}
        </ul>
      )}
      {runs.length > 1 && <DeliveryRun runs={runs} ctx={ctx} onTakeAll={() => onTakeAll(runs)} />}
      {rows.length === 0 && (
        <EmptyState icon={<ShoppingBag size={30} strokeWidth={1.5} />} title="No open orders">
          New orders line up here by the time they are promised.
        </EmptyState>
      )}
      {slots.map((slot, i) => (
        <Fragment key={slot.due}>
          {i === nowAt && (
            <div className={s.now} role="separator" aria-label={`Now, ${clockLabel(at)}`}>
              <span className={s.nowLabel}>NOW · {clockLabel(at)}</span>
              <span className={s.nowLine} />
            </div>
          )}
          <section className={s.slot} aria-label={slotHeading(slot)}>
            <h2 className={s.slotHead}>{slotHeading(slot)}</h2>
            <div className={s.rows}>
              {slot.rows.map((r) => (
                <QueueRowCard
                  key={r.order.id}
                  row={r}
                  at={at}
                  ctx={ctx}
                  leadMinutes={leadMinutes}
                  tracksPickups={tracksPickups(r.order.room)}
                  onOpen={onOpen}
                  onAction={onAction}
                />
              ))}
            </div>
          </section>
        </Fragment>
      ))}
      {filter !== 'delivery' && <NocMeals />}
    </>
  );
}
