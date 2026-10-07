import { Check, ChevronRight } from 'lucide-react';
import { formatTime } from '../../lib/format';
import { SPECIAL_KIND_LABEL, setPrepped, type PrepMeal, type PrepSpecial, type SpecialAmount, type Stamp } from '../../store/production';
import { PrepNotes } from './PrepNotes';
import s from './SpecialCard.module.css';

interface SpecialCardProps {
  special: PrepSpecial;
  amount: SpecialAmount;
  prepped: Stamp | null;
  venueId: string;
  iso: string;
  meal: PrepMeal;
  cook: string;
  onOpen: (special: PrepSpecial) => void;
}

/**
 * One special and how many to make. A prepped special shrinks to a grey
 * line until it is unchecked.
 */
export function SpecialCard({ special, amount, prepped, venueId, iso, meal, cook, onOpen }: SpecialCardProps) {
  if (prepped) {
    return (
      <button
        className={s.doneRow}
        aria-pressed
        title="Tap to uncheck"
        onClick={() => setPrepped(venueId, iso, meal, special.slot, false, cook)}
      >
        <span className={s.doneBox}>
          <Check size={16} strokeWidth={3} aria-hidden />
        </span>
        <span className={s.doneText}>
          <span className={s.doneName}>
            {amount.n} · {special.name}
          </span>
          <span className={s.doneMeta}>
            Prepped · {prepped.by} · {formatTime(prepped.at)}
          </span>
        </span>
        <span className={s.undo}>Undo</span>
      </button>
    );
  }

  return (
    <article className={s.card} aria-label={special.name}>
      <button className={s.open} onClick={() => onOpen(special)}>
        <span className={s.kind}>{SPECIAL_KIND_LABEL[special.kind]}</span>
        <span className={s.titleRow}>
          <span className={s.name}>{special.name}</span>
          <span className={s.amount} aria-label={`Make ${amount.n}`}>
            {amount.n}
          </span>
        </span>
        {special.sides.length > 0 && <span className={s.sides}>with {special.sides.join(', ')}</span>}
        {special.from && (
          <span className={s.swapped}>
            Swapped in for {special.from} by {special.swapBy}
          </span>
        )}
        <span className={amount.set ? s.setBy : s.forecast}>
          {amount.set ? `Set by ${amount.by}. Make only this many.` : "Forecast. The director hasn't set an amount yet."}
        </span>
        <span className={s.more}>
          {special.recipe ? `Recipe scaled to ${amount.n}` : 'Cook notes'}
          <ChevronRight size={14} strokeWidth={2.6} aria-hidden />
        </span>
      </button>
      <button className={s.mark} aria-pressed={false} onClick={() => setPrepped(venueId, iso, meal, special.slot, true, cook)}>
        <span className={s.markBox} aria-hidden />
        Mark prepped
      </button>
      <PrepNotes venueId={venueId} iso={iso} meal={meal} dish={special.name} cook={cook} />
    </article>
  );
}
