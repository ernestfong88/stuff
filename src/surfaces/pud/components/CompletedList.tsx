import { CheckCircle2, Pencil } from 'lucide-react';
import { clockLabel } from '../../../domain/pickup';
import { dinerPerson } from '../../../domain/orders';
import type { Order } from '../../../domain/types';
import { Avatar, EmptyState, cx } from '../../../ui';
import { completedSummary, completedView, handedOffAt } from '../queue/queue';
import type { MobileOverrides } from '../service/phones';
import { OrderWho } from './OrderWho';
import { QueueTypeIcon } from './QueueTypeIcon';
import { SummaryTiles } from './SummaryTiles';
import s from './CompletedList.module.css';

function CompletedRow({ order, mobile, onReopen }: { order: Order; mobile: MobileOverrides; onReopen: (o: Order) => void }) {
  const at = clockLabel(handedOffAt(order));
  const v = completedView(order);
  const type = order.queueType ?? 'pickup';
  const person = order.diners[0] ? dinerPerson(order.diners[0]) : undefined;
  return (
    <article className={s.row}>
      <div className={s.time}>
        <span className={s.clock}>{at.slice(0, -3)}</span>
        <span className={s.ampm}>{at.slice(-2)}</span>
      </div>
      <QueueTypeIcon type={type} />
      {person && <Avatar person={person} size={38} />}
      <OrderWho order={order} mobile={mobile} />
      <div className={s.result}>
        <div className={cx(s.headline, v.late ? s.late : s.onTime)}>{v.headline}</div>
        <div className={s.detail}>{v.detail}</div>
      </div>
      <button className={s.reopen} onClick={() => onReopen(order)}>
        <Pencil size={13} strokeWidth={2.25} aria-hidden />
        Reopen
      </button>
    </article>
  );
}

/** Today's handed-off orders, latest first, with how on time they were. */
export function CompletedList({ list, mobile, onReopen }: { list: Order[]; mobile: MobileOverrides; onReopen: (o: Order) => void }) {
  const sum = completedSummary(list);
  return (
    <>
      <SummaryTiles
        label="Today so far"
        tiles={[
          { value: sum.count, label: 'handed off today', tone: 'ink' },
          { value: sum.onTimePercent == null ? '–' : `${sum.onTimePercent}%`, label: 'on time', tone: 'flora' },
          { value: sum.pickedUp, label: 'picked up', tone: 'clay' },
          { value: sum.delivered, label: 'delivered', tone: 'coast' },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState icon={<CheckCircle2 size={30} strokeWidth={1.5} />} title="Nothing handed off yet today." />
      ) : (
        <div className={s.list}>
          {list.map((o) => (
            <CompletedRow key={o.id} order={o} mobile={mobile} onReopen={onReopen} />
          ))}
        </div>
      )}
    </>
  );
}
