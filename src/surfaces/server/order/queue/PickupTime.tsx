import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { aheadDayLabel, pickupLeadMinutes } from '../../../../domain/pickup';
import type { MealName, Order, QueueType } from '../../../../domain/types';
import { useConfig } from '../../../../store/config';
import { useDining } from '../../../../store/dining';
import { useSetting } from '../../../../store/serviceConfig';
import { cx } from '../../../../ui';
import { anySent, bookableDays, dayChipLabel, dayTimes, landing, timeContext, type TimeChoice } from './orderWhen';
import { loadTag, orderDate, rangeLabel, rangesOn } from './pickupWindows';
import type { WhenTarget } from './useOrderWhen';
import s from './PickupTime.module.css';

/**
 * Pick up or delivery day and time: today or a later day, and one of the
 * venue's 15 minute ranges in any meal that day (or as soon as it is ready).
 * A time in another meal, or another day, moves the order to that meal's and
 * day's menu (onWhen asks about lines the new menu doesn't have).
 */
export function PickupTime({ order: o, onWhen }: { order: Order & { queueType: QueueType }; onWhen: (t: WhenTarget) => void }) {
  const { orders, history, assocOrders, setOrderSchedule } = useDining();
  const cfg = useConfig();
  useSetting('win');
  const [openMeal, setOpenMeal] = useState<MealName | null>(null);
  const type = o.queueType;
  const on = rangesOn(type);
  const chosen = o.readyAt && o.readyAt !== 'ASAP' ? o.readyAt : null;
  // An associate meal closes on the Associate Meals cutoff, as on the manager's list and the Associate App.
  const ctx = timeContext(o, { orders, history, assoc: assocOrders });
  const cut = ctx.cut;
  const date = orderDate(o);
  const ahead = aheadDayLabel(date);
  // A later day books a range, so it never goes to the kitchen today; an associate's meal and a sent order stay put.
  const canPickDay = on && !o.assoc && !anySent(o);
  const byMeal = on ? dayTimes(o, date, ctx) : [];
  const windows: TimeChoice[] = [...(byMeal.find((m) => m.meal === o.meal)?.times ?? [])];
  const open = windows.filter((w) => !w.load?.full);
  if (chosen && on && !windows.some((w) => w.at === chosen)) windows.unshift({ s: -1, at: chosen });
  const firstOpen = open[0]?.at;
  const others = byMeal.filter((m) => m.meal !== o.meal);
  const dayWords = ahead ? (ahead === 'Tomorrow' ? 'tomorrow' : `on ${ahead}`) : 'today';

  // Book the first open range, or ASAP where the community does not book ranges.
  useEffect(() => {
    if (on) {
      if (!chosen && firstOpen) setOrderSchedule(o.id, firstOpen);
    } else if (o.readyAt !== 'ASAP') setOrderSchedule(o.id, 'ASAP');
  }, [o.id, chosen, on, firstOpen, o.readyAt, setOrderSchedule]);

  // A new order opened after its meal's last range (lunch at 2 PM) starts on the next meal with a time open, once.
  const moved = useRef(false);
  const empty = !o.diners.some((x) => x.items.length > 0);
  const next = on && !chosen && !firstOpen && empty && !moved.current ? landing(o, byMeal, {}) : null;
  useEffect(() => {
    if (!next?.readyAt || next.meal === o.meal) return;
    moved.current = true;
    onWhen({ date, meal: next.meal, readyAt: next.readyAt });
  }, [next?.meal, next?.readyAt, o.meal, date, onWhen]);

  const pickDay = (day: string) => {
    if (day === date) return;
    const l = landing(o, dayTimes(o, day, ctx), {});
    setOpenMeal(null);
    onWhen({ date: day, ...l });
  };

  const chip = (w: TimeChoice, pick: () => void) => {
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
        onClick={pick}
      >
        {rangeLabel(w.at)}
        {tag && <span className={cx(s.tag, w.load?.full && s.tagFull)}>{tag}</span>}
      </button>
    );
  };

  return (
    <div className={s.box}>
      <div className={s.head}>
        <Clock size={13} aria-hidden />
        {type === 'delivery' ? 'Delivery day and time' : 'Pick up day and time'}
      </div>
      {canPickDay ? (
        <div className={s.days} role="radiogroup" aria-label="Day">
          {bookableDays().map((day) => (
            <button key={day} role="radio" aria-checked={day === date} className={cx(s.day, day === date && s.dayOn)} onClick={() => pickDay(day)}>
              {dayChipLabel(day)}
            </button>
          ))}
        </div>
      ) : (
        ahead && <p className={s.forDay}>For {ahead === 'Tomorrow' ? 'tomorrow' : ahead}</p>
      )}
      {!on ? (
        <p className={s.asap}>
          As soon as it is ready. This community does not book ranges for {type === 'delivery' ? 'delivery.' : 'pick up.'}
        </p>
      ) : (
        <>
          <div className={s.meal}>{o.meal}</div>
          {windows.length ? (
            <div className={s.chips}>{windows.map((w) => chip(w, () => setOrderSchedule(o.id, w.at)))}</div>
          ) : (
            <p className={s.asap}>
              No {String(o.meal || 'meal').toLowerCase()} times left {dayWords}.
            </p>
          )}
          {others.map((m) => {
            const shown = openMeal === m.meal;
            return (
              <div key={m.meal}>
                <button className={s.other} aria-expanded={shown} onClick={() => setOpenMeal(shown ? null : m.meal)}>
                  {m.meal} times
                  <span className={s.otherCount}>{m.times.length}</span>
                  <ChevronDown size={16} strokeWidth={2.5} className={cx(s.chev, shown && s.chevOpen)} aria-hidden />
                </button>
                {shown && <div className={s.chips}>{m.times.map((w) => chip(w, () => onWhen({ date, meal: m.meal, readyAt: w.at })))}</div>}
              </div>
            );
          })}
        </>
      )}
      {on && (
        <p className={s.fine}>
          Each time is a 15 minute range. Orders go in at least {cut} minutes before the range starts, and the kitchen fires about{' '}
          {pickupLeadMinutes([...orders, ...history], cfg)} minutes before so it is ready at the start.{' '}
          {type === 'pickup'
            ? 'The resident gets one text, when it is packed and set out.'
            : 'The resident or family gets one text, when it leaves the kitchen.'}
          {others.length > 0 && ' A time in another meal switches the order to that meal’s menu.'}
        </p>
      )}
    </div>
  );
}
