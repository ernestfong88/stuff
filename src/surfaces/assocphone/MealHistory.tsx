import type { AssocMeal } from '../../domain/types';
import { EmptyState, cx } from '../../ui';
import { dayName } from '../../domain/assocMeals/shifts';
import { windowTag } from '../../domain/assocMeals/windows';
import s from './MealHistory.module.css';

/** Meals picked up or cancelled, newest first. */
export function MealHistory({ meals, todayIso }: { meals: AssocMeal[]; todayIso: string }) {
  if (!meals.length) return <EmptyState compact title="No meals yet">Meals you pick up or cancel show here.</EmptyState>;
  return (
    <ul className={s.list}>
      {meals.map((m) => (
        <li key={m.id} className={s.row}>
          <span className={s.day}>{dayName(m.date, todayIso)}</span>
          <span className={s.item}>
            {m.item} · {windowTag(m.window)}
          </span>
          <span className={cx(s.status, m.status.startsWith('Cancelled') && s.cancelled)}>{m.status}</span>
        </li>
      ))}
    </ul>
  );
}
