import { Milestone } from 'lucide-react';
import { phaseOf, usePhasePlan } from '../phases';
import s from './PhaseBanner.module.css';

/** A strip above a Phase 2 page, so nobody mistakes it for something in the first release. */
export function PhaseBanner({ pageId, goto }: { pageId: string; goto: (pageId: string) => void }) {
  const plan = usePhasePlan();
  if (phaseOf(pageId, plan) !== 2) return null;
  return (
    <div className={s.banner} role="note">
      <Milestone size={16} className={s.icon} aria-hidden />
      <span className={s.text}>
        <strong>Phase 2.</strong> This page is planned for a later release, not the first one.
      </span>
      {pageId !== 'phases' && (
        <button className={s.link} onClick={() => goto('phases')}>
          Release Phases
        </button>
      )}
    </div>
  );
}
