import { useState } from 'react';
import { Check, CircleHelp } from 'lucide-react';
import type { Order } from '../../../../domain/types';
import { playedAt, useTrivia } from '../../../../store/trivia';
import { cx } from '../../../../ui';
import { TriviaDialog } from './TriviaDialog';
import s from './TriviaButton.module.css';

/**
 * "Trivia" button on a table card; opens the table trivia question.
 * variant "icon" is the square "?" used on closed checks in Shift Review.
 */
export function TriviaButton({ order, variant = 'label' }: { order: Order; variant?: 'label' | 'icon' }) {
  const state = useTrivia();
  const [open, setOpen] = useState(false);
  const played = playedAt(state, order.id);
  const label = played ? 'Trivia played at this table' : 'Play trivia of the day with this table';
  return (
    <>
      <button
        type="button"
        className={cx(variant === 'icon' ? s.icon : s.label, played && s.played)}
        title={label}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {variant === 'icon' ? <CircleHelp size={20} aria-hidden /> : played ? <Check size={14} strokeWidth={3} aria-hidden /> : null}
        {variant === 'label' && 'Trivia'}
        {variant === 'icon' && played && (
          <span className={s.tick} aria-hidden>
            <Check size={12} strokeWidth={3.4} />
          </span>
        )}
      </button>
      {open && <TriviaDialog order={order} onClose={() => setOpen(false)} />}
    </>
  );
}
