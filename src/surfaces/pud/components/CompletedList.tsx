import { CheckCircle2, Pencil } from 'lucide-react';
import { clockLabel } from '../../../domain/pickup';
import type { Order } from '../../../domain/types';
import { EmptyState, cx } from '../../../ui';
import { completedSummary, completedView, handedOffAt } from '../queue/queue';
import type { MobileOverrides } from '../../../domain/pickupService/phones';
import { OrderWho } from './OrderWho';
import s from './CompletedList.module.css';

function CompletedRow({ order, mobile, onReopen }: { order: Order; mobile: MobileOverrides; onReopen: (o: Order) => void }) {
  const at = clockLabel(handedOffAt(order));
  const v = completedView(order);
  return (
    <article className={s.row}>
      <div className={s.time}>
        <span className={s.clock}>{at.slice(0, -3)}</span>
        <span className={s.ampm}>{at.slice(-2)}</span>
      </div>
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
      {list.length > 0 && (
        <p className={s.summary}>
          <b>{sum.count}</b> handed off today
          {sum.onTimePercent != null && (
            <>
              {' · '}
              <b>{sum.onTimePercent}%</b> on time
            </>
          )}
          {' · '}
          {sum.pickedUp} picked up · {sum.delivered} delivered
        </p>
      )}
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
