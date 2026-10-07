import { Fragment } from 'react';
import { ShoppingBag } from 'lucide-react';
import { clockLabel } from '../../../domain/pickup';
import { EmptyState } from '../../../ui';
import {
  groupSlots,
  nowLineIndex,
  readyDeliveries,
  slotHeading,
  slotSummary,
  statusCounts,
  type QueueActionKind,
  type QueueFilter,
  type QueueRow,
} from '../queue/queue';
import type { TextContext } from '../service/texts';
import { DeliveryRun } from './DeliveryRun';
import { NocMeals } from './NocMeals';
import { QueueRowCard } from './QueueRowCard';
import { SummaryTiles, type SummaryTile, type TileTone } from './SummaryTiles';
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

/** Open orders: status summary, one-trip suggestion, then each 15 minute range in order. */
export function OpenQueue({ rows, filter, at, ctx, leadMinutes, tracksPickups, onOpen, onAction, onTakeAll }: OpenQueueProps) {
  const c = statusCounts(rows, at);
  const tone = (v: number, t: TileTone): TileTone => (v > 0 ? t : 'off');
  const tiles: SummaryTile[] = [
    { value: c.late, label: 'late', tone: tone(c.late, 'danger') },
    { value: c.ready, label: 'ready to hand off', tone: tone(c.ready, 'flora') },
    { value: c.waiting, label: 'waiting at the counter', tone: tone(c.waiting, 'clay') },
    { value: c.out, label: 'out for delivery', tone: tone(c.out, 'coast') },
    { value: c.cooking, label: 'in the kitchen', tone: tone(c.cooking, 'clayDeep') },
    { value: c.later, label: 'scheduled later', tone: tone(c.later, 'ink') },
  ];
  const runs = filter === 'pickup' ? [] : readyDeliveries(rows);
  const slots = groupSlots(rows);
  const nowAt = nowLineIndex(slots, at);
  return (
    <>
      <SummaryTiles tiles={tiles} label="Where orders are" />
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
            <h2 className={s.slotHead}>
              <span className={s.range}>{slotHeading(slot)}</span>
              <span className={s.summary}>{slotSummary(slot.rows)}</span>
            </h2>
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
