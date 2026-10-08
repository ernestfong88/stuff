import { dinerPills } from '../../domain/residents';
import type { Diner } from '../../domain/types';
import { useKitchenNote } from '../backoffice/kit/residentRecords';
import { cx } from '../../ui';
import s from './DinerPills.module.css';

/** Allergy (red) and diet or texture (gold) tags for a seat, then the resident's kitchen note. */
export function DinerPills({ diner, size = 'md' }: { diner: Diner | undefined; size?: 'sm' | 'md' }) {
  const pills = dinerPills(diner);
  // Dining Plans & Notes: "The cook line sees this on every ticket." Never a guest's host's note.
  const note = useKitchenNote(diner && diner.kind === 'resident' && !diner.isGuest ? diner.refId : null);
  if (!pills.length && !note) return null;
  return (
    <>
      {pills.map((p) => (
        <span key={p.kind + p.text} className={cx(s.pill, s[size], p.kind === 'allergy' ? s.allergy : s.diet)}>
          {p.kind === 'allergy' && <span className="sr-only">Allergy: </span>}
          {p.text}
        </span>
      ))}
      {note && (
        <span className={cx(s.pill, s[size], s.note)} title="Kitchen note from Dining Plans & Notes">
          <span className="sr-only">Kitchen note: </span>
          {note}
        </span>
      )}
    </>
  );
}
