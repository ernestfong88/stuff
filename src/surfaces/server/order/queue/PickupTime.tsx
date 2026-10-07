import { useEffect } from 'react';
import { Clock } from 'lucide-react';
import { pickupLeadMinutes } from '../../../../domain/pickup';
import type { Order, QueueType } from '../../../../domain/types';
import { now } from '../../../../lib/clock';
import { useConfig } from '../../../../store/config';
import { useDining } from '../../../../store/dining';
import { useSetting } from '../../../../store/serviceConfig';
import { cx } from '../../../../ui';
import { cutoffMinutes, loadTag, orderDate, rangeLabel, rangesOn, windowLoad, windowsFor, type WindowLoad } from './pickupWindows';
import s from './PickupTime.module.css';

/** Pick up or delivery time: one of the venue's 15 minute ranges, or as soon as it is ready. */
export function PickupTime({ order: o }: { order: Order & { queueType: QueueType } }) {
  const { orders, history, assocOrders, setOrderSchedule } = useDining();
  const cfg = useConfig();
  useSetting('win');
  const type = o.queueType;
  const on = rangesOn(type);
  const cut = cutoffMinutes();
  const chosen = o.readyAt && o.readyAt !== 'ASAP' ? o.readyAt : null;
  const d = new Date(now());
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const windows: Array<{ s: number; at: string; load?: WindowLoad }> = on
    ? windowsFor(type, o.room, o.meal)
        .filter((w) => w.s >= nowMin + cut)
        .map((w) => ({ ...w, load: windowLoad(type, o.room, w.s, orderDate(o), o.id, { orders, history, assoc: assocOrders }) }))
    : [];
  const open = windows.filter((w) => !w.load?.full);
  if (chosen && on && !windows.some((w) => w.at === chosen)) windows.unshift({ s: -1, at: chosen });
  const firstOpen = open[0]?.at;

  // Book the first open range, or ASAP where the community does not book ranges.
  useEffect(() => {
    if (on) {
      if (!chosen && firstOpen) setOrderSchedule(o.id, firstOpen);
    } else if (o.readyAt !== 'ASAP') setOrderSchedule(o.id, 'ASAP');
  }, [o.id, chosen, on, firstOpen, o.readyAt, setOrderSchedule]);

  return (
    <div className={s.box}>
      <div className={s.head}>
        <Clock size={13} aria-hidden />
        {type === 'delivery' ? 'Delivery time' : 'Pick up time'}
      </div>
      {!on ? (
        <p className={s.asap}>
          As soon as it is ready. This community does not book ranges for {type === 'delivery' ? 'delivery.' : 'pick up.'}
        </p>
      ) : windows.length ? (
        <div className={s.chips}>
          {windows.map((w) => {
            const sel = chosen === w.at;
            const full = !sel && !!w.load?.full;
            const tag = loadTag(w.load);
            return (
              <button
                key={w.at}
                className={cx(s.chip, sel && s.chipOn, full && s.chipFull)}
                disabled={full}
                aria-pressed={sel}
                title={full ? 'This window is full' : undefined}
                onClick={() => setOrderSchedule(o.id, w.at)}
              >
                {rangeLabel(w.at)}
                {tag && <span className={cx(s.tag, w.load?.full && s.tagFull)}>{tag}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className={s.asap}>No times left for {String(o.meal || 'this meal').toLowerCase()} today.</p>
      )}
      {on && (
        <p className={s.fine}>
          Each time is a 15 minute range. Orders go in at least {cut} minutes before the range starts, and the kitchen fires about{' '}
          {pickupLeadMinutes([...orders, ...history], cfg)} minutes before so it is ready at the start.{' '}
          {type === 'pickup'
            ? 'The resident gets one text, when it is packed and set out.'
            : 'The resident or family gets one text, when it leaves the kitchen.'}
        </p>
      )}
    </div>
  );
}
