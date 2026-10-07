import { PREP_MEALS, type PrepMeal } from '../../store/production';
import { cx } from '../../ui';
import { dayLabel } from './logic';
import s from './MealPicker.module.css';

export interface MealSelection {
  /** 0 today, 1 tomorrow. */
  offset: number;
  meal: PrepMeal;
}

interface MealPickerProps {
  value: MealSelection;
  onChange: (next: MealSelection) => void;
  /** Today on the demo clock. */
  base: Date;
}

/** Six meals: today's and tomorrow's breakfast, lunch and dinner. */
export function MealPicker({ value, onChange, base }: MealPickerProps) {
  return (
    <div className={s.picker}>
      {[0, 1].map((offset) => {
        const label = `${offset ? 'Tomorrow' : 'Today'} · ${dayLabel(base, offset)}`;
        return (
          <div key={offset} role="group" aria-label={label} className={s.group}>
            <span className={cx(s.day, offset ? s.tomorrow : s.today)}>{label}</span>
            {PREP_MEALS.map((meal) => {
              const on = value.offset === offset && value.meal === meal;
              return (
                <button key={meal} aria-pressed={on} className={cx(s.meal, on && s.on)} onClick={() => onChange({ offset, meal })}>
                  {meal}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
