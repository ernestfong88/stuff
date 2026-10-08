import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Order } from '../../../../domain/types';
import { playedAt, triviaOn, useTrivia } from '../../../../store/trivia';
import { cx } from '../../../../ui';
import { TriviaDialog } from './TriviaDialog';
import s from './TriviaButton.module.css';

/** "Trivia" button on a table card or a closed check; opens the table trivia question. Hidden when Back Office turns trivia off. */
export function TriviaButton({ order }: { order: Order }) {
  const state = useTrivia();
  const [open, setOpen] = useState(false);
  const played = playedAt(state, order.id);
  if (!triviaOn(state)) return null;
  const label = played ? 'Trivia played at this table' : 'Play trivia of the day with this table';
  return (
    <>
      <button
        type="button"
        className={cx(s.label, played && s.played)}
        title={label}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {played && <Check size={14} strokeWidth={3} aria-hidden />}
        Trivia
      </button>
      {open && <TriviaDialog order={order} onClose={() => setOpen(false)} />}
    </>
  );
}
