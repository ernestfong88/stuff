import { dinerPills } from '../../domain/residents';
import type { Diner } from '../../domain/types';
import { cx } from '../../ui';
import s from './DinerPills.module.css';

/** Allergy (red) and diet or texture (gold) tags for a seat. */
export function DinerPills({ diner, size = 'md' }: { diner: Diner | undefined; size?: 'sm' | 'md' }) {
  const pills = dinerPills(diner);
  if (!pills.length) return null;
  return (
    <>
      {pills.map((p) => (
        <span key={p.kind + p.text} className={cx(s.pill, s[size], p.kind === 'allergy' ? s.allergy : s.diet)}>
          {p.kind === 'allergy' && <span className="sr-only">Allergy: </span>}
          {p.text}
        </span>
      ))}
    </>
  );
}
