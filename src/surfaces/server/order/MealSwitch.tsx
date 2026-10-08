import { Moon, Sun, Sunrise } from 'lucide-react';
import type { MealName } from '../../../domain/types';
import { cx } from '../../../ui';
import { currentMeal } from '../shared/meal';
import s from './MealSwitch.module.css';

const MEALS: Array<{ id: MealName; icon: typeof Sun }> = [
  { id: 'Breakfast', icon: Sunrise },
  { id: 'Lunch', icon: Sun },
  { id: 'Dinner', icon: Moon },
];

/** Which meal's menu the check orders from; the one being served now is marked NOW. */
export function MealSwitch({ meal, compact, onChange }: { meal: MealName; compact?: boolean; onChange: (m: MealName) => void }) {
  const now = currentMeal();
  return (
    <span className={cx(s.switch, compact && s.compact)} role="radiogroup" aria-label="Meal">
      {MEALS.map(({ id, icon: Icon }) => {
        const on = meal === id;
        return (
          <button
            key={id}
            role="radio"
            aria-checked={on}
            className={cx(s.meal, on && s.on)}
            title={id === now ? `${id} · current meal period` : `Switch this order to ${id.toLowerCase()}`}
            onClick={() => onChange(id)}
          >
            <Icon size={15} strokeWidth={2.25} aria-hidden />
            {id}
            {id === now && !on && <span className={s.now}>NOW</span>}
          </button>
        );
      })}
    </span>
  );
}
