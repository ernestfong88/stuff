import { Plus } from 'lucide-react';
import type { MealName, Order } from '../../../domain/types';
import { Button, EmptyState, cx } from '../../../ui';
import { dayFromToday, dayLabel, dayWord, hmAmPm, mealSummary, partyName, RESV_HOURS, RESV_MEALS, type Reservation } from './model';
import { ReservationRow, type ResvAction } from './ReservationRow';
import s from './ReservationList.module.css';

interface Props {
  room: string;
  list: Reservation[];
  live: Order[];
  at: number;
  day: string;
  setDay: (d: string) => void;
  meal: MealName;
  setMeal: (m: MealName) => void;
  labelOf: (id: string) => string | undefined;
  name: (o: Order) => string;
  onSeat: (r: Reservation) => void;
  onEdit: (r: Reservation) => void;
  onNew: () => void;
  onOpen: (o: Order) => void;
  onAct: (k: ResvAction, r: Reservation) => void;
}

/** __KResvList: the book for one day and meal, in time order. */
export function ReservationList(p: Props) {
  const t0 = dayFromToday(0);
  const t1 = dayFromToday(1);
  const mine = p.list.filter((r) => r.room === p.room && r.date === p.day);
  const count = (m: MealName) => mine.filter((r) => r.meal === m && !r.cancelledAt && !r.noShowAt).length;
  const rows = mine.filter((r) => r.meal === p.meal).sort((a, b) => a.time - b.time || partyName(a).localeCompare(partyName(b)));
  const sum = mealSummary(rows);
  const [from, to] = RESV_HOURS[p.meal];
  const other = p.day !== t0 && p.day !== t1;

  return (
    <div className={s.wrap}>
      <div className={s.bar}>
        <div className={s.group} role="group" aria-label="Day">
          <button className={cx(s.chip, p.day === t0 && s.on)} aria-pressed={p.day === t0} onClick={() => p.setDay(t0)}>
            Today
          </button>
          <button className={cx(s.chip, p.day === t1 && s.on)} aria-pressed={p.day === t1} onClick={() => p.setDay(t1)}>
            Tomorrow
          </button>
          <input type="date" className={cx(s.chip, s.date, other && s.on)} value={p.day} min={t0} aria-label="Pick a day" onChange={(e) => e.target.value && p.setDay(e.target.value)} />
        </div>
        <div className={s.group} role="group" aria-label="Meal">
          {RESV_MEALS.map((m) => (
            <button key={m} className={cx(s.chip, p.meal === m && s.on)} aria-pressed={p.meal === m} onClick={() => p.setMeal(m)}>
              {m}
              <span className={s.count}>{count(m)}</span>
            </button>
          ))}
        </div>
        <Button variant="primary" className={s.new} icon={<Plus size={16} strokeWidth={2.5} />} onClick={p.onNew}>
          New reservation
        </Button>
      </div>
      <div className={s.summary}>
        {dayLabel(p.day)} · {p.meal} {hmAmPm(from)} to {hmAmPm(to)} · {sum.parties === 1 ? '1 party' : `${sum.parties} parties`}, {sum.covers} {sum.covers === 1 ? 'guest' : 'guests'}
        {sum.seated ? `, ${sum.seated} seated` : ''}
      </div>
      <div className={s.list}>
        {rows.length ? (
          rows.map((r) => (
            <ReservationRow
              key={r.id}
              r={r}
              at={p.at}
              list={p.list}
              live={p.live}
              isToday={p.day === t0}
              labelOf={p.labelOf}
              name={p.name}
              onSeat={p.onSeat}
              onEdit={p.onEdit}
              onOpen={p.onOpen}
              onAct={p.onAct}
            />
          ))
        ) : (
          <EmptyState title={`No reservations for ${p.meal.toLowerCase()} ${dayWord(p.day)}.`} action={<Button onClick={p.onNew}>Book one</Button>} />
        )}
      </div>
    </div>
  );
}
