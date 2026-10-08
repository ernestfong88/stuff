import { useState } from 'react';
import { ChevronDown, ShoppingBag } from 'lucide-react';
import { EmptyState, cx } from '../../../ui';
import {
  groupSlots,
  isLate,
  nextStepGroups,
  readyDeliveries,
  slotHeading,
  slotSummary,
  type NextStepGroup,
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

/** Open orders split by what needs doing now, most urgent at the top; later bookings fold away. */
export function OpenQueue({ rows, filter, at, ctx, leadMinutes, tracksPickups, onOpen, onAction, onTakeAll }: OpenQueueProps) {
  const [showLater, setShowLater] = useState(false);
  const groups = nextStepGroups(rows, at);
  const runs = filter === 'pickup' ? [] : readyDeliveries(rows);

  const card = (r: QueueRow) => (
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
  );

  const section = (g: NextStepGroup) => {
    const late = g.rows.filter((r) => isLate(r, at)).length;
    if (g.id === 'later') {
      return (
        <section key={g.id} className={cx(s.section, s.later)} aria-label={`${g.title}, ${g.rows.length}`}>
          <button className={s.laterToggle} aria-expanded={showLater} onClick={() => setShowLater((v) => !v)}>
            <span className={s.title}>{g.title}</span>
            <span className={s.count}>{g.rows.length}</span>
            <span className={s.hint}>{slotSummary(g.rows)}</span>
            <span className={s.grow} />
            <span className={s.toggleText}>{showLater ? 'Hide' : 'Show'}</span>
            <ChevronDown size={18} strokeWidth={2.5} className={cx(s.chev, showLater && s.chevOpen)} aria-hidden />
          </button>
          {showLater &&
            groupSlots(g.rows).map((slot) => (
              <div key={slot.due} className={s.slot}>
                <h3 className={s.slotHead}>{slotHeading(slot)}</h3>
                <div className={s.rows}>{slot.rows.map(card)}</div>
              </div>
            ))}
        </section>
      );
    }
    return (
      <section key={g.id} className={cx(s.section, s[`sec_${g.id}`])} aria-label={`${g.title}, ${g.rows.length}`}>
        <h2 className={s.head}>
          <span className={s.title}>{g.title}</span>
          <span className={s.count}>{g.rows.length}</span>
          {late > 0 && <span className={s.lateCount}>{late} late</span>}
          <span className={s.hint}>{g.hint}</span>
        </h2>
        {g.id === 'takeOut' && runs.length > 1 && <DeliveryRun runs={runs} ctx={ctx} onTakeAll={() => onTakeAll(runs)} />}
        <div className={s.rows}>{g.rows.map(card)}</div>
      </section>
    );
  };

  return (
    <>
      {rows.length === 0 && (
        <EmptyState icon={<ShoppingBag size={30} strokeWidth={1.5} />} title="No open orders">
          New orders show up here, sorted by what needs doing next.
        </EmptyState>
      )}
      {groups.map(section)}
      {filter !== 'delivery' && <NocMeals />}
    </>
  );
}
