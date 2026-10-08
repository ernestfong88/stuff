import { Coffee, MessageSquareText } from 'lucide-react';
import type { AssocMeal } from '../../domain/types';
import { Chip } from '../../ui';
import { lastTexted } from '../../domain/assocMeals/meals';
import { CLOSED_TEXT, type ClosedReason } from '../../domain/assocMeals/menu';
import { planLabel, shortDate, type Shift } from '../../domain/assocMeals/shifts';
import { windowTag } from '../../domain/assocMeals/windows';
import s from './ShiftCard.module.css';

interface ShiftCardProps {
  shift: Shift;
  dayName: string;
  /** Salaried view: any day, any time, so the shift hours don't apply. */
  anyTime: boolean;
  planned: AssocMeal | undefined;
  closed: ClosedReason | null;
  /** No pickup range left to order for this shift today. */
  orderingOver: boolean;
  /** The planned meal's range is still open, so it can be changed or cancelled. */
  canChange: boolean;
  onPlan: () => void;
  onChange: (meal: AssocMeal) => void;
  onCancel: (meal: AssocMeal) => void;
}

export function ShiftCard({ shift, dayName, anyTime, planned, closed, orderingOver, canChange, onPlan, onChange, onCancel }: ShiftCardProps) {
  const texted = planned && lastTexted(planned);
  const showDate = dayName === 'Today' || dayName === 'Tomorrow';
  return (
    <article className={s.card} aria-label={dayName}>
      <header className={s.head}>
        <h3 className={s.day}>{dayName}</h3>
        <span className={s.when}>
          {[showDate ? shortDate(shift.date) : null, anyTime ? null : `${shift.start}–${shift.end}`].filter(Boolean).join(' · ')}
        </span>
      </header>
      {!anyTime && (
        <div className={s.break}>
          <Coffee size={13} strokeWidth={2.4} aria-hidden /> Break {shift.breakAt}
        </div>
      )}

      {planned ? (
        <div className={s.planned}>
          <Chip tone="success" size="xs">
            Planned
          </Chip>
          <span className={s.item}>
            {planned.item}
            {planned.note ? ` (${planned.note})` : ''} · {windowTag(planned.window)}
          </span>
          {canChange ? (
            <span className={s.actions}>
              <button className={s.change} onClick={() => onChange(planned)} aria-label={`Change ${planned.item} on ${dayName}`}>
                Change
              </button>
              <button className={s.cancel} onClick={() => onCancel(planned)} aria-label={`Cancel ${planned.item} on ${dayName}`}>
                Cancel
              </button>
            </span>
          ) : (
            <p className={s.locked}>Ordering has closed, so the kitchen is making it. To change it now, ask the kitchen.</p>
          )}
          {texted && (
            <p className={s.texted}>
              <MessageSquareText size={13} strokeWidth={2.2} aria-hidden /> {texted}
            </p>
          )}
        </div>
      ) : closed ? (
        <p className={s.closed}>{CLOSED_TEXT[closed]}</p>
      ) : orderingOver ? (
        <p className={s.closed}>Ordering for this shift has closed.</p>
      ) : (
        <button className={s.plan} onClick={onPlan}>
          {planLabel(shift.meal)}
        </button>
      )}
    </article>
  );
}
