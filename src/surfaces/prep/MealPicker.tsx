import { PREP_MEALS, type PrepMeal } from '../../store/production';
import { cx } from '../../ui';
import s from './MealPicker.module.css';

/** How far ahead the kitchen preps: today and the six days after it. */
export const PREP_DAYS = 7;

export interface MealSelection {
  /** Days from today: 0 today, 1 tomorrow, up to PREP_DAYS − 1. */
  offset: number;
  meal: PrepMeal;
}

interface MealPickerProps {
  value: MealSelection;
  onChange: (next: MealSelection) => void;
  /** Today on the demo clock. */
  base: Date;
}

/** "Today", "Tomorrow", then the weekday and date ("Sat 10/10"). */
export function prepDayName(base: Date, offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getMonth() + 1}/${d.getDate()}`;
}

/** The day (a week ahead at most), then the meal. */
export function MealPicker({ value, onChange, base }: MealPickerProps) {
  return (
    <div className={s.picker}>
      <div role="group" aria-label="Prep day" className={s.group}>
        {Array.from({ length: PREP_DAYS }, (_, offset) => (
          <button
            key={offset}
            aria-pressed={value.offset === offset}
            className={cx(s.meal, value.offset === offset && s.on, offset === 0 && s.today)}
            onClick={() => onChange({ ...value, offset })}
          >
            {prepDayName(base, offset)}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Meal" className={s.group}>
        {PREP_MEALS.map((meal) => (
          <button
            key={meal}
            aria-pressed={value.meal === meal}
            className={cx(s.meal, value.meal === meal && s.on)}
            onClick={() => onChange({ ...value, meal })}
          >
            {meal}
          </button>
        ))}
      </div>
    </div>
  );
}
