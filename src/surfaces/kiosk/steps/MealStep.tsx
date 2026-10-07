import { useServiceSettings, windowSettings } from '../../../domain/pickupService/settings';
import { minuteLabel, windowCutoff } from '../../../domain/pickupService/windows';
import { MEAL_ANSWERS } from '../model/flow';
import type { KioskMeal } from '../model/times';
import { KButton } from '../ui/KButton';
import { Question } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './MealStep.module.css';

/** Which meal, today (or tomorrow once today's ordering has closed). */
export function MealStep({ flow, meals }: { flow: KioskFlow; meals: KioskMeal[] }) {
  const cut = windowCutoff(windowSettings(useServiceSettings()));
  const pick = (m: KioskMeal) => {
    const changed = flow.s.meal !== m.meal || flow.s.date !== m.date;
    flow.advance({ meal: m.meal, date: m.date, win: null, ...(changed ? MEAL_ANSWERS : {}) });
  };
  return (
    <div>
      <Question
        title="Which meal?"
        sub={meals[0]?.tomorrow ? "Today's ordering has closed, so these are for tomorrow." : `Orders close ${cut} minutes before each time.`}
      />
      {meals.length ? (
        <div className={s.list}>
          {meals.map((m) => {
            const first = m.windows[0].start;
            const last = m.windows[m.windows.length - 1].start;
            const on = flow.s.edit && flow.s.meal === m.meal && flow.s.date === m.date;
            return (
              <KButton key={m.meal + m.date} look={on ? 'selected' : 'secondary'} className={s.meal} onClick={() => pick(m)}>
                <span className={s.text}>
                  <span className={s.name}>
                    {m.meal} {m.tomorrow ? 'tomorrow' : 'today'}
                  </span>
                  <span className={s.range}>
                    Times from {minuteLabel(first)} to {minuteLabel(last + 15)}
                  </span>
                </span>
                <span className={s.last}>Last order by {minuteLabel(last - cut)}</span>
              </KButton>
            );
          })}
        </div>
      ) : (
        <p className={s.none}>Sorry, there are no times left to order right now. Please ask a staff member.</p>
      )}
    </div>
  );
}
